-- Two pieces of pet state that the client gained when the care loop was closed,
-- and that the server row has to carry for a second device to restore correctly.
--
-- Both are genuinely pet state rather than device preference, which is why they
-- live here and not in a local settings store:
--
--   * The mess schedule IS the reason a pile can appear while the app is closed.
--     Losing it on sync would mean meals eaten on one device never come back out
--     on another.
--   * The sleep window describes the owner's routine, and re-entering it on every
--     new install is exactly the kind of small papercut that makes a restore feel
--     incomplete. It follows `diet`, which is on the pet for the same reason.

alter table public.pets
  -- Minutes after local midnight. Local to the *player*, deliberately: the server
  -- stores the two numbers and never interprets them, because only the device
  -- knows its timezone and a stored UTC instant would drift on travel.
  add column sleep_start_minute smallint not null default 1320
    constraint pets_sleep_start_minute_range
      check (sleep_start_minute between 0 and 1439),

  add column sleep_end_minute smallint not null default 420
    constraint pets_sleep_end_minute_range
      check (sleep_end_minute between 0 and 1439),

  -- When each eaten meal is due to come back out. Kept as timestamps rather than
  -- a count so a mess lands at the right moment rather than all at once on the
  -- next launch.
  add column pending_messes_at timestamptz[] not null default '{}'
    constraint pets_pending_messes_bounded
      check (array_length(pending_messes_at, 1) is null
             or array_length(pending_messes_at, 1) <= 64);

comment on column public.pets.sleep_start_minute is
  'Quiet hours start, minutes after local midnight. Default 22:00.';
comment on column public.pets.sleep_end_minute is
  'Quiet hours end, minutes after local midnight. Default 07:00.';
comment on column public.pets.pending_messes_at is
  'Scheduled messes owed by meals already eaten, ascending. Bounded so a runaway client cannot grow the row without limit.';
