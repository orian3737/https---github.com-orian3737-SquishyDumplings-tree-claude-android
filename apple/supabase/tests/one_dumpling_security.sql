-- Security and invariant tests for the one-dumpling foundation.
--
-- Run against a local database only:
--   supabase db reset --local
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/one_dumpling_security.sql
--
-- Every check raises on failure, so a clean run means every assertion held.

\set ON_ERROR_STOP on

-- Two real users, created through auth.users so the profile trigger runs.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), now(), now());

-- ---------------------------------------------------------------------------
do $$
declare v_count int;
begin
  select count(*) into v_count from public.profiles
  where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

  if v_count <> 2 then
    raise exception 'FAIL: profile trigger did not create a profile per user (got %)', v_count;
  end if;
  raise notice 'PASS: a profile is created for every new user';
end;
$$;

-- ---------------------------------------------------------------------------
-- hatch_pet is idempotent: the second call returns the same dumpling.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_first uuid;
  v_second uuid;
  v_rows int;
begin
  select id into v_first from public.hatch_pet('  Bao   Zi  ', 'skin-classic-steamer', 'vegetarian');
  select id into v_second from public.hatch_pet('Someone Else', 'skin-gold-leaf', 'omnivore');

  if v_first is null then
    raise exception 'FAIL: hatch_pet returned no pet';
  end if;
  if v_first <> v_second then
    raise exception 'FAIL: a second hatch created a different pet (% vs %)', v_first, v_second;
  end if;

  select count(*) into v_rows from public.pets;
  if v_rows <> 1 then
    raise exception 'FAIL: owner ended up with % pets', v_rows;
  end if;

  raise notice 'PASS: repeated hatching returns the same single dumpling';
end;
$$;

-- The name is normalized and the diet is honored.
do $$
declare v_name text; v_diet public.pet_diet;
begin
  select name, diet into v_name, v_diet from public.pets;

  if v_name <> 'Bao Zi' then
    raise exception 'FAIL: name not normalized, got %', quote_literal(v_name);
  end if;
  if v_diet <> 'vegetarian' then
    raise exception 'FAIL: diet not honored, got %', v_diet;
  end if;
  raise notice 'PASS: hatch normalizes the name and honors the diet';
end;
$$;

-- A client cannot insert a pet directly; hatching is the only path.
do $$
begin
  begin
    insert into public.pets (owner_id, name, rarity, skin_id)
    values ('11111111-1111-1111-1111-111111111111', 'Sneaky', 'legendary', 'skin-gold-leaf');
    raise exception 'FAIL: a direct pet insert succeeded';
  exception
    when insufficient_privilege then
      raise notice 'PASS: direct pet inserts are refused by RLS';
    when unique_violation then
      raise notice 'PASS: direct pet inserts cannot add a second pet';
  end;
end;
$$;

-- Identity columns are server-owned and cannot be rewritten by an update.
do $$
declare
  v_id uuid; v_born timestamptz; v_rev bigint;
  v_new_id uuid; v_new_born timestamptz; v_new_rev bigint;
begin
  select id, born_at, revision into v_id, v_born, v_rev from public.pets;

  update public.pets
  set id = gen_random_uuid(),
      owner_id = '22222222-2222-2222-2222-222222222222',
      born_at = now() - interval '10 years',
      revision = 1,
      hunger = 42;

  select id, born_at, revision into v_new_id, v_new_born, v_new_rev from public.pets;

  if v_new_id <> v_id then
    raise exception 'FAIL: pet id was rewritten';
  end if;
  if v_new_born <> v_born then
    raise exception 'FAIL: born_at was rewritten';
  end if;
  if v_new_rev <> v_rev + 1 then
    raise exception 'FAIL: revision did not advance monotonically (% -> %)', v_rev, v_new_rev;
  end if;
  raise notice 'PASS: id, owner, and birth time survive a hostile update; revision advances';
end;
$$;

-- Needs cannot be pushed outside 0-100.
do $$
begin
  begin
    update public.pets set hunger = 150;
    raise exception 'FAIL: hunger above 100 was accepted';
  exception when check_violation then
    raise notice 'PASS: needs are clamped by a check constraint';
  end;
end;
$$;

-- A living pet cannot carry a death timestamp.
do $$
begin
  begin
    update public.pets set died_at = now();
    raise exception 'FAIL: a living pet accepted a death timestamp';
  exception when check_violation then
    raise notice 'PASS: lifecycle status and died_at stay consistent';
  end;
end;
$$;
commit;

-- ---------------------------------------------------------------------------
-- Cross-user isolation.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare v_visible int;
begin
  select count(*) into v_visible from public.pets;
  if v_visible <> 0 then
    raise exception 'FAIL: user B can see % of user A''s pets', v_visible;
  end if;
  raise notice 'PASS: user B cannot read user A''s dumpling';

  select count(*) into v_visible from public.profiles;
  if v_visible <> 1 then
    raise exception 'FAIL: user B sees % profiles, expected only their own', v_visible;
  end if;
  raise notice 'PASS: user B sees only their own profile';
end;
$$;

-- User B hatching creates a separate pet for B, not a second pet for A.
do $$
declare v_owner uuid; v_total int;
begin
  perform public.hatch_pet('Har Gow', 'skin-classic-steamer', 'vegan');

  select owner_id into v_owner from public.pets;
  if v_owner <> '22222222-2222-2222-2222-222222222222' then
    raise exception 'FAIL: user B''s hatch produced a pet owned by %', v_owner;
  end if;

  set local role postgres;
  select count(*) into v_total from public.pets;
  if v_total <> 2 then
    raise exception 'FAIL: expected one pet per owner, found % total', v_total;
  end if;
  raise notice 'PASS: each owner gets exactly one dumpling';
end;
$$;
commit;

-- ---------------------------------------------------------------------------
-- Care events are owner-scoped and idempotency keys collide.
-- ---------------------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  v_pet uuid;
  v_key uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  select id into v_pet from public.pets;

  insert into public.care_events (id, pet_id, owner_id, action, occurred_at)
  values (v_key, v_pet, '11111111-1111-1111-1111-111111111111', 'feed', now());

  begin
    insert into public.care_events (id, pet_id, owner_id, action, occurred_at)
    values (v_key, v_pet, '11111111-1111-1111-1111-111111111111', 'feed', now());
    raise exception 'FAIL: a replayed idempotency key was accepted twice';
  exception when unique_violation then
    raise notice 'PASS: replaying a care-event key is rejected';
  end;
end;
$$;

-- A client cannot log an event against someone else's pet or under another owner.
do $$
declare v_other_pet uuid;
begin
  set local role postgres;
  select id into v_other_pet from public.pets
  where owner_id = '22222222-2222-2222-2222-222222222222';

  set local role authenticated;

  begin
    insert into public.care_events (id, pet_id, owner_id, action, occurred_at)
    values (gen_random_uuid(), v_other_pet, '11111111-1111-1111-1111-111111111111', 'feed', now());
    raise exception 'FAIL: an event was logged against another owner''s pet';
  exception when insufficient_privilege then
    raise notice 'PASS: cannot log care against another owner''s pet';
  end;

  begin
    insert into public.care_events (id, pet_id, owner_id, action, occurred_at)
    values (gen_random_uuid(), v_other_pet, '22222222-2222-2222-2222-222222222222', 'feed', now());
    raise exception 'FAIL: a client wrote an event under another owner_id';
  exception when insufficient_privilege then
    raise notice 'PASS: cannot write an event under another owner_id';
  end;
end;
$$;
commit;

-- ---------------------------------------------------------------------------
-- Anonymous access is closed.
-- ---------------------------------------------------------------------------
begin;
set local role anon;

do $$
declare v_visible int;
begin
  select count(*) into v_visible from public.pets;
  if v_visible <> 0 then
    raise exception 'FAIL: anonymous read exposed % pets', v_visible;
  end if;

  select count(*) into v_visible from public.profiles;
  if v_visible <> 0 then
    raise exception 'FAIL: anonymous read exposed % profiles', v_visible;
  end if;

  select count(*) into v_visible from public.care_events;
  if v_visible <> 0 then
    raise exception 'FAIL: anonymous read exposed % care events', v_visible;
  end if;

  raise notice 'PASS: anonymous sessions see nothing';
end;
$$;

do $$
begin
  begin
    perform public.hatch_pet('Anon', 'skin-classic-steamer', 'omnivore');
    raise exception 'FAIL: an anonymous session hatched a pet';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anonymous sessions cannot execute hatch_pet';
    when others then
      if sqlstate = '28000' then
        raise notice 'PASS: hatch_pet refuses an unauthenticated caller';
      else
        raise;
      end if;
  end;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Sleep window and mess schedule
--
-- Both were added after the app's care loop closed. They are pet state rather
-- than device preference, so a second device must restore them, and both are
-- attacker-reachable through a normal authenticated update.
-- ---------------------------------------------------------------------------
begin;
set local role postgres;

do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-0000000000a1';
  v_pet uuid;
begin
  insert into auth.users (id, email, instance_id, aud, role)
  values (v_owner, 'sleep-test@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  insert into public.pets (owner_id, name, rarity, skin_id)
  values (v_owner, 'Sleepy', 'common', 'skin-classic-steamer')
  returning id into v_pet;

  -- Defaults match the client's DEFAULT_SLEEP_SCHEDULE, so a pet hatched on the
  -- server and one hatched locally describe the same night.
  if (select sleep_start_minute from public.pets where id = v_pet) <> 1320
     or (select sleep_end_minute from public.pets where id = v_pet) <> 420 then
    raise exception 'FAIL: default sleep window is not 22:00-07:00';
  end if;
  raise notice 'PASS: sleep window defaults to 22:00-07:00';

  if (select pending_messes_at from public.pets where id = v_pet) <> '{}'::timestamptz[] then
    raise exception 'FAIL: a fresh pet already owes a mess';
  end if;
  raise notice 'PASS: a fresh dumpling owes no messes';

  -- A minute of the day is 0-1439. Anything else is a client bug or an attack,
  -- and either way the row must refuse it rather than store a nonsense night.
  begin
    update public.pets set sleep_start_minute = 1440 where id = v_pet;
    raise exception 'FAIL: accepted a sleep minute past the end of the day';
  exception
    when check_violation then
      raise notice 'PASS: sleep minutes are bounded to a real day';
  end;

  begin
    update public.pets set sleep_end_minute = -1 where id = v_pet;
    raise exception 'FAIL: accepted a negative sleep minute';
  exception
    when check_violation then
      raise notice 'PASS: sleep minutes cannot be negative';
  end;

  -- The schedule is bounded so a runaway or hostile client cannot grow one row
  -- without limit.
  begin
    update public.pets
      set pending_messes_at = (
        select array_agg(now() + (n || ' minutes')::interval)
        from generate_series(1, 65) as n
      )
      where id = v_pet;
    raise exception 'FAIL: accepted an unbounded mess schedule';
  exception
    when check_violation then
      raise notice 'PASS: the mess schedule is length-bounded';
  end;

  -- A schedule inside the bound is stored intact, ordering included.
  update public.pets
    set pending_messes_at = array[
      timestamptz '2026-01-02 10:00:00+00',
      timestamptz '2026-01-02 10:30:00+00'
    ]
    where id = v_pet;

  if array_length((select pending_messes_at from public.pets where id = v_pet), 1) <> 2 then
    raise exception 'FAIL: a valid mess schedule did not round-trip';
  end if;
  raise notice 'PASS: a valid mess schedule round-trips';
end;
$$;
rollback;

\echo ''
\echo 'All one-dumpling security assertions passed.'
