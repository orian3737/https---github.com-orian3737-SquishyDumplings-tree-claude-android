-- Squishy Dumplings — one-dumpling foundation
--
-- Establishes the canonical shared contract: one profile per user, exactly one
-- pet per owner, and an append-only care-event log keyed by client-generated
-- idempotency keys.
--
-- The product invariant this schema exists to enforce: an account has exactly one
-- persistent dumpling. Skins are appearances for that dumpling. Nothing here may
-- allow a second pet row for an owner, and death and revival update the same row.
--
-- Review notes:
--   * Every user-owned table has RLS enabled and fails closed.
--   * No policy grants anonymous access.
--   * `owner_id` is forced to auth.uid() on insert so a client cannot write
--     someone else's row.
--   * Rollback is at the bottom of this file, commented, so it stays with the
--     migration it undoes.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.pet_rarity as enum (
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary'
);

create type public.pet_lifecycle_status as enum ('alive', 'dead', 'reviving');

create type public.pet_diet as enum ('omnivore', 'vegetarian', 'vegan');

-- Matches the domain's CARE_ACTIONS plus the two lifecycle operations that are
-- also logged as events.
create type public.care_action as enum (
  'feed',
  'clean',
  'attention',
  'rest',
  'evolve',
  'revive'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text
    constraint profiles_display_name_length
      check (display_name is null or char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- A profile row is created for every new user so the client never has to
-- bootstrap one and never has to handle a missing profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------------------

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,

  name text not null
    constraint pets_name_length check (char_length(name) between 1 and 24),
  rarity public.pet_rarity not null,
  evolution_stage smallint not null default 0
    constraint pets_evolution_stage_range check (evolution_stage between 0 and 4),

  -- All four needs are integers 0-100. `cleanliness` is internal only: the app
  -- shows poop-pile concentration, never a cleanliness or stinky meter.
  hunger smallint not null default 80
    constraint pets_hunger_range check (hunger between 0 and 100),
  cleanliness smallint not null default 80
    constraint pets_cleanliness_range check (cleanliness between 0 and 100),
  energy smallint not null default 80
    constraint pets_energy_range check (energy between 0 and 100),
  happiness smallint not null default 80
    constraint pets_happiness_range check (happiness between 0 and 100),

  personality_tags text[] not null default '{}'
    constraint pets_personality_tags_supported check (
      personality_tags <@ array['spicy', 'gentle', 'grumpy', 'playful', 'sleepy', 'chatty']::text[]
    ),

  diet public.pet_diet not null default 'omnivore',
  -- A base-pool item. The app resolves it through the diet substitution, so a
  -- vegetarian whose favorite is the pork chop prefers the mixed vegetables.
  favorite_food text not null default 'pork-chop'
    constraint pets_favorite_food_supported check (
      favorite_food in ('pork-chop', 'mixed-vegetable', 'tofu', 'scallion')
    ),

  skin_id text not null,
  lifecycle_status public.pet_lifecycle_status not null default 'alive',

  born_at timestamptz not null default now(),
  died_at timestamptz,
  last_cared_at timestamptz not null default now(),

  revision bigint not null default 1
    constraint pets_revision_positive check (revision > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A dead pet has a death time; a living one does not. Keeps lifecycle and
  -- timestamps from drifting apart.
  constraint pets_died_at_matches_status check (
    (lifecycle_status = 'dead' and died_at is not null)
    or (lifecycle_status <> 'dead' and died_at is null)
  )
);

-- THE one-dumpling invariant, enforced by the database rather than by trust.
create unique index pets_one_per_owner on public.pets (owner_id);

create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- The revision is a monotonic optimistic-concurrency value. The server owns it,
-- so a client cannot rewind it or hold it still.
create or replace function public.bump_pet_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  new.id = old.id;
  new.owner_id = old.owner_id;
  new.born_at = old.born_at;
  return new;
end;
$$;

create trigger pets_bump_revision
  before update on public.pets
  for each row execute function public.bump_pet_revision();

alter table public.pets enable row level security;

create policy pets_select_own
  on public.pets for select
  to authenticated
  using (owner_id = (select auth.uid()));

-- No client insert policy. Hatching goes through `hatch_pet` so the one-per-owner
-- rule and the rarity roll stay server-side.
create policy pets_update_own
  on public.pets for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- care_events
-- ---------------------------------------------------------------------------

create table public.care_events (
  -- Client-generated idempotency key. Replaying it must apply the effect once.
  id uuid primary key,
  pet_id uuid not null references public.pets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  action public.care_action not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  result_revision bigint
);

create index care_events_owner_received_at
  on public.care_events (owner_id, received_at desc);

create index care_events_pet_occurred_at
  on public.care_events (pet_id, occurred_at desc);

alter table public.care_events enable row level security;

create policy care_events_select_own
  on public.care_events for select
  to authenticated
  using (owner_id = (select auth.uid()));

-- Events are append-only from the client's perspective: no update, no delete.
create policy care_events_insert_own
  on public.care_events for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.pets p
      where p.id = pet_id and p.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- hatch_pet
-- ---------------------------------------------------------------------------

-- Rolls rarity server-side using the documented weights, then creates the
-- caller's one and only pet.
--
-- Idempotent by construction: if the caller already has a pet, the existing row
-- is returned untouched. Concurrent calls resolve to the same single pet because
-- `pets_one_per_owner` makes the second insert fail and we re-read instead.
create or replace function public.hatch_pet(
  p_name text,
  p_skin_id text,
  p_diet public.pet_diet default 'omnivore'
)
returns public.pets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_pet public.pets;
  v_roll numeric;
  v_rarity public.pet_rarity;
  v_name text;
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Already hatched: hand back the same dumpling rather than making another.
  select * into v_pet from public.pets where owner_id = v_owner;
  if found then
    return v_pet;
  end if;

  v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  if char_length(v_name) = 0 then
    raise exception 'a dumpling needs a name' using errcode = '22023';
  end if;
  v_name := left(v_name, 24);

  -- Weights from BUILD_SPEC section 6: common 60, uncommon 25, rare 10, epic 4,
  -- legendary 1. Rolled here because a client roll can be reinstalled and retried.
  v_roll := random() * 100;
  v_rarity := case
    when v_roll < 60 then 'common'
    when v_roll < 85 then 'uncommon'
    when v_roll < 95 then 'rare'
    when v_roll < 99 then 'epic'
    else 'legendary'
  end::public.pet_rarity;

  begin
    insert into public.pets (owner_id, name, rarity, skin_id, diet)
    values (v_owner, v_name, v_rarity, p_skin_id, coalesce(p_diet, 'omnivore'))
    returning * into v_pet;
  exception when unique_violation then
    -- A concurrent hatch won the race. Both callers get that same pet.
    select * into v_pet from public.pets where owner_id = v_owner;
  end;

  return v_pet;
end;
$$;

revoke all on function public.hatch_pet(text, text, public.pet_diet) from public;
revoke all on function public.hatch_pet(text, text, public.pet_diet) from anon;
grant execute on function public.hatch_pet(text, text, public.pet_diet) to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
--
-- drop function if exists public.hatch_pet(text, text, public.pet_diet);
-- drop table if exists public.care_events;
-- drop table if exists public.pets;
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop table if exists public.profiles;
-- drop function if exists public.bump_pet_revision();
-- drop function if exists public.set_updated_at();
-- drop type if exists public.care_action;
-- drop type if exists public.pet_diet;
-- drop type if exists public.pet_lifecycle_status;
-- drop type if exists public.pet_rarity;
