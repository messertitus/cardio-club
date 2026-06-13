-- 056: Privacy-first analytics & statistics foundation.
--
-- WHY: Until now engagement signals (sessions, app opens, onboarding, install
-- hint) lived only in per-device AsyncStorage and were neither aggregatable nor
-- admin-manageable. Later sub-projects (gamification, milestones, activity
-- levels, club insights, personal progress) need a neutral, auditable,
-- data-minimal server-side log to build on. This migration only ADDS that
-- foundation. It touches no decision/voting/fairness logic and no existing
-- table semantics.
--
-- PRIVACY BY DESIGN:
--   * Data minimisation: only app-relevant counters + a thin event log. The
--     `context` jsonb is size-capped and must hold non-sensitive identifiers
--     only (eventId, sportId, screen name) — never message content, no GPS
--     history, no free text.
--   * Purpose binding: metric_key / event_type follow a strict key format so
--     arbitrary or sensitive blobs cannot be smuggled in.
--   * Transparency & erasure: every value is resettable; admins can wipe a
--     user's whole test statistic; admin changes are written to an audit log.
--   * Least privilege: regular users may read only their OWN stats and may
--     write only their own activity events. All counter writes and every admin
--     action go through SECURITY DEFINER RPCs gated by is_admin_user().

-- ---------------------------------------------------------------------------
-- Shared key-format guard. Lowercase dotted/underscored keys, e.g.
-- "app.session_started", "vote.rank1". Keeps the namespace clean and prevents
-- free-text leaking into a "key".
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_stat_key(value text)
returns boolean
language sql
immutable
as $$
  select value is not null
    and char_length(value) between 2 and 80
    and value ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$';
$$;

-- ---------------------------------------------------------------------------
-- 1) Append-only activity event log. Thin, non-sensitive breadcrumbs.
-- ---------------------------------------------------------------------------
create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (public.is_valid_stat_key(event_type)),
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 2048),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_activity_events_user_time_idx
  on public.user_activity_events (user_id, occurred_at desc);
create index if not exists user_activity_events_type_idx
  on public.user_activity_events (event_type);

alter table public.user_activity_events enable row level security;

drop policy if exists "users read own activity" on public.user_activity_events;
create policy "users read own activity"
  on public.user_activity_events for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists "users insert own activity" on public.user_activity_events;
create policy "users insert own activity"
  on public.user_activity_events for insert to authenticated
  with check (user_id = auth.uid() and public.is_valid_stat_key(event_type));

-- ---------------------------------------------------------------------------
-- 2) Aggregated per-user counters. The workhorse for later stats.
-- ---------------------------------------------------------------------------
create table if not exists public.user_stat_counters (
  user_id uuid not null references public.profiles (id) on delete cascade,
  metric_key text not null check (public.is_valid_stat_key(metric_key)),
  value bigint not null default 0,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, metric_key)
);

alter table public.user_stat_counters enable row level security;

-- Read-only for the owner (+ admins). All writes go through record_user_metric
-- and the admin RPCs (SECURITY DEFINER), so users get no write policy at all.
drop policy if exists "users read own counters" on public.user_stat_counters;
create policy "users read own counters"
  on public.user_stat_counters for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3) Point-in-time snapshots (e.g. weekly active rollups). Prepared for trend
--    analysis; written only by future jobs / admin RPCs.
-- ---------------------------------------------------------------------------
create table if not exists public.user_stat_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_kind text not null check (period_kind in ('day', 'week', 'month', 'all')),
  period_start date not null,
  metrics jsonb not null default '{}'::jsonb check (pg_column_size(metrics) <= 8192),
  created_at timestamptz not null default now(),
  unique (user_id, period_kind, period_start)
);

create index if not exists user_stat_snapshots_user_idx
  on public.user_stat_snapshots (user_id, period_kind, period_start desc);

alter table public.user_stat_snapshots enable row level security;

drop policy if exists "users read own snapshots" on public.user_stat_snapshots;
create policy "users read own snapshots"
  on public.user_stat_snapshots for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4) Achievement progress — PREPARATORY ONLY. No achievements are defined or
--    shown in this run; the table exists so gamification can land later
--    without a schema migration. unlocked_at stays null until then.
-- ---------------------------------------------------------------------------
create table if not exists public.user_achievement_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_key text not null check (public.is_valid_stat_key(achievement_key)),
  progress numeric not null default 0,
  target numeric,
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

alter table public.user_achievement_progress enable row level security;

drop policy if exists "users read own achievements" on public.user_achievement_progress;
create policy "users read own achievements"
  on public.user_achievement_progress for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user(auth.uid()));

-- ---------------------------------------------------------------------------
-- 5) Admin audit log. Every manual admin change to a user's statistic is
--    recorded here. Admin-readable; never written directly (only via the
--    SECURITY DEFINER admin RPCs below).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_stat_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('set', 'reset', 'reset_all')),
  metric_key text,
  old_value bigint,
  new_value bigint,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists admin_stat_audit_log_target_idx
  on public.admin_stat_audit_log (target_user_id, created_at desc);

alter table public.admin_stat_audit_log enable row level security;

drop policy if exists "admins read stat audit" on public.admin_stat_audit_log;
create policy "admins read stat audit"
  on public.admin_stat_audit_log for select to authenticated
  using (public.is_admin_user(auth.uid()));

-- ===========================================================================
-- RPCs
-- ===========================================================================

-- Self-tracking entry point. Always writes for the CALLER (auth.uid()), so a
-- user can never record events/counters for someone else. Optionally bumps a
-- counter and/or appends an activity event in one atomic call. Best-effort:
-- callers fire-and-forget; the function validates keys and ignores blanks.
create or replace function public.record_user_metric(
  p_metric_key text default null,
  p_increment bigint default 1,
  p_event_type text default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_context jsonb := coalesce(p_context, '{}'::jsonb);
begin
  if v_user is null then
    return;
  end if;

  if p_metric_key is null and p_event_type is null then
    return;
  end if;

  if p_metric_key is not null then
    if not public.is_valid_stat_key(p_metric_key) then
      raise exception 'Invalid metric key: %', p_metric_key;
    end if;

    insert into public.user_stat_counters (user_id, metric_key, value, last_event_at, updated_at)
    values (v_user, p_metric_key, coalesce(p_increment, 1), now(), now())
    on conflict (user_id, metric_key)
    do update set value = public.user_stat_counters.value + coalesce(p_increment, 1),
                  last_event_at = now(),
                  updated_at = now();
  end if;

  if p_event_type is not null then
    if not public.is_valid_stat_key(p_event_type) then
      raise exception 'Invalid event type: %', p_event_type;
    end if;
    if pg_column_size(v_context) > 2048 then
      raise exception 'Activity context too large';
    end if;

    insert into public.user_activity_events (user_id, event_type, context)
    values (v_user, p_event_type, v_context);
  end if;
end;
$$;

grant execute on function public.record_user_metric(text, bigint, text, jsonb) to authenticated;

-- Read aggregated stats. Self for any authenticated user; any target for admins.
-- Returns a compact jsonb summary so the client has a single typed shape.
create or replace function public.get_user_stats(target_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid := coalesce(target_user_id, auth.uid());
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if v_target <> auth.uid() and not public.is_admin_user(auth.uid()) then
    raise exception 'Not allowed to read other users statistics';
  end if;

  select jsonb_build_object(
    'userId', v_target,
    'lastActiveAt', (select max(last_event_at) from public.user_stat_counters where user_id = v_target),
    'totalEvents', (select count(*) from public.user_activity_events where user_id = v_target),
    'counters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'metricKey', c.metric_key,
        'value', c.value,
        'lastEventAt', c.last_event_at
      ) order by c.metric_key)
      from public.user_stat_counters c
      where c.user_id = v_target
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_user_stats(uuid) to authenticated;

-- Admin: manually set one counter to an exact value (test/admin only). Audited.
create or replace function public.admin_set_user_metric(
  target_user_id uuid,
  p_metric_key text,
  p_value bigint,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old bigint;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can change user statistics';
  end if;
  if not public.is_valid_stat_key(p_metric_key) then
    raise exception 'Invalid metric key: %', p_metric_key;
  end if;
  if p_value is null or p_value < 0 then
    raise exception 'Value must be zero or positive';
  end if;

  select value into v_old from public.user_stat_counters
   where user_id = target_user_id and metric_key = p_metric_key;

  insert into public.user_stat_counters (user_id, metric_key, value, last_event_at, updated_at)
  values (target_user_id, p_metric_key, p_value, now(), now())
  on conflict (user_id, metric_key)
  do update set value = excluded.value, updated_at = now();

  insert into public.admin_stat_audit_log (admin_id, target_user_id, action, metric_key, old_value, new_value, note)
  values (auth.uid(), target_user_id, 'set', p_metric_key, v_old, p_value, p_note);
end;
$$;

grant execute on function public.admin_set_user_metric(uuid, text, bigint, text) to authenticated;

-- Admin: reset one counter to zero (test/admin only). Audited.
create or replace function public.admin_reset_user_metric(
  target_user_id uuid,
  p_metric_key text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old bigint;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can change user statistics';
  end if;
  if not public.is_valid_stat_key(p_metric_key) then
    raise exception 'Invalid metric key: %', p_metric_key;
  end if;

  select value into v_old from public.user_stat_counters
   where user_id = target_user_id and metric_key = p_metric_key;

  update public.user_stat_counters
     set value = 0, updated_at = now()
   where user_id = target_user_id and metric_key = p_metric_key;

  insert into public.admin_stat_audit_log (admin_id, target_user_id, action, metric_key, old_value, new_value, note)
  values (auth.uid(), target_user_id, 'reset', p_metric_key, v_old, 0, p_note);
end;
$$;

grant execute on function public.admin_reset_user_metric(uuid, text, text) to authenticated;

-- Admin: wipe ALL test statistics of a user (counters, activity events,
-- achievement progress, snapshots). Test/admin only. Audited as one row.
create or replace function public.admin_reset_user_stats(
  target_user_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can change user statistics';
  end if;

  delete from public.user_stat_counters where user_id = target_user_id;
  delete from public.user_activity_events where user_id = target_user_id;
  delete from public.user_achievement_progress where user_id = target_user_id;
  delete from public.user_stat_snapshots where user_id = target_user_id;

  insert into public.admin_stat_audit_log (admin_id, target_user_id, action, note)
  values (auth.uid(), target_user_id, 'reset_all', p_note);
end;
$$;

grant execute on function public.admin_reset_user_stats(uuid, text) to authenticated;

-- Admin: recent audit entries for one user (who changed what, when).
create or replace function public.admin_list_stat_audit(
  target_user_id uuid,
  max_rows integer default 50
)
returns setof public.admin_stat_audit_log
language sql
security definer
set search_path = public
as $$
  select *
  from public.admin_stat_audit_log
  where public.is_admin_user(auth.uid())
    and target_user_id = admin_list_stat_audit.target_user_id
  order by created_at desc
  limit greatest(1, least(coalesce(max_rows, 50), 200));
$$;

grant execute on function public.admin_list_stat_audit(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
