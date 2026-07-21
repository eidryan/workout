-- Workout Logger — Supabase schema
--
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Design notes:
--  * Table/column names mirror the local Dexie schema so sync is a direct map.
--  * Every row carries `user_id` (owner) and `updated_at` (last-write-wins).
--  * Primary keys are the SAME ids the client already generates (uuid), so a
--    device can push its existing local data without remapping references.
--  * `deleted` supports tombstones — a row removed on one device must not be
--    resurrected by the other device's next push.
--  * RLS ensures a user can only ever see/modify their own rows.

-- ---------------------------------------------------------------- day_templates
create table if not exists public.day_templates (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  focus       text not null default '',
  "order"     integer not null,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------- exercise_slots
create table if not exists public.exercise_slots (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  day_template_id uuid not null,
  "order"         integer not null,
  name            text not null,
  -- JSON blobs keep the client shape verbatim: {sets, repMin, repMax},
  -- {min, max}, {value, perSide}
  scheme          jsonb not null,
  target_rir      jsonb not null,
  default_weight  jsonb not null,
  muscle_group    text not null,
  rest_seconds    integer,
  alternatives    jsonb not null default '[]'::jsonb,
  note            text,
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- --------------------------------------------------------------------- sessions
create table if not exists public.sessions (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  day_template_id uuid not null,
  date            date not null,
  created_at      timestamptz not null,
  completed_at    timestamptz,
  source          text not null default 'manual',
  deleted         boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- ------------------------------------------------------------ session_slot_logs
create table if not exists public.session_slot_logs (
  session_id       uuid not null,
  slot_id          uuid not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  performed_name   text not null,
  performed_weight jsonb,
  skipped          boolean not null default false,
  deleted          boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (session_id, slot_id)
);

-- --------------------------------------------------------------------- set_logs
create table if not exists public.set_logs (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  uuid not null,
  slot_id     uuid not null,
  set_number  integer not null,
  reps        integer,
  rir         integer,
  weight      jsonb,
  skipped     boolean not null default false,
  logged_at   timestamptz,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- -------------------------------------------------------------------- app_state
-- One settings row per user (the local singleton 'app').
create table if not exists public.app_state (
  user_id                    uuid primary key references auth.users (id) on delete cascade,
  last_completed_day_order   integer not null default 0,
  last_session_id            uuid,
  sound_enabled              boolean not null default true,
  vibration_enabled          boolean not null default true,
  global_default_rest_seconds integer not null default 120,
  volume                     real,
  sound_type                 text,
  vibration_type             text,
  notifications_enabled      boolean not null default false,
  updated_at                 timestamptz not null default now()
);

-- ------------------------------------------------------------------ performance
create index if not exists day_templates_user_idx     on public.day_templates (user_id, updated_at);
create index if not exists exercise_slots_user_idx    on public.exercise_slots (user_id, updated_at);
create index if not exists sessions_user_idx          on public.sessions (user_id, updated_at);
create index if not exists session_slot_logs_user_idx on public.session_slot_logs (user_id, updated_at);
create index if not exists set_logs_user_idx          on public.set_logs (user_id, updated_at);

-- ------------------------------------------------------------------------- RLS
-- Every table: a user may only touch rows where user_id = their auth uid.
alter table public.day_templates     enable row level security;
alter table public.exercise_slots    enable row level security;
alter table public.sessions          enable row level security;
alter table public.session_slot_logs enable row level security;
alter table public.set_logs          enable row level security;
alter table public.app_state         enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'day_templates', 'exercise_slots', 'sessions', 'session_slot_logs', 'set_logs'
  ] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "own settings" on public.app_state;
create policy "own settings" on public.app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
