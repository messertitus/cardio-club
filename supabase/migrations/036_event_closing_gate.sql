-- 036: Event closing gate
--
-- An event must have results AND a completed attendance review before it can be
-- closed (status -> 'completed'). Closing is restricted to admins and the event
-- or activity contact persons (AP / moderator). While a previous event is still
-- open, ensure_mcc_week does not open voting for the following week.

-- Readiness: which close requirements are already met for an event.
create or replace function public.event_close_readiness(target_event_id uuid)
returns table (has_results boolean, attendance_reviewed boolean, can_close boolean)
language sql
stable
security definer
set search_path = public
as $$
  with results as (
    select exists (select 1 from public.event_results r where r.event_id = target_event_id) as ok
  ),
  attendance as (
    select not exists (
      select 1
      from public.attendance a
      where a.event_id = target_event_id
        and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
        and (a.actual_status is null or a.actual_status = 'unknown'::public.actual_attendance_status)
    ) as ok
  )
  select
    results.ok as has_results,
    attendance.ok as attendance_reviewed,
    (results.ok and attendance.ok) as can_close
  from results, attendance;
$$;

-- Permission: admins, club admins, event contact or activity contact may close.
create or replace function public.event_can_be_closed_by(target_event_id uuid, actor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_current_mcc_admin()
    or public.is_club_admin(public.event_club_id(target_event_id))
    or exists (
      select 1 from public.weekly_events we
      where we.id = target_event_id and we.activity_contact_id = actor_id
    )
    or exists (
      select 1 from public.event_activities ea
      where ea.event_id = target_event_id and ea.activity_contact_id = actor_id
    );
$$;

-- Close an event after results and attendance review are complete.
create or replace function public.close_weekly_event(target_event_id uuid)
returns public.weekly_events
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.weekly_events;
  readiness record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.event_can_be_closed_by(target_event_id, auth.uid()) then
    raise exception 'not authorized to close this event';
  end if;

  select * into readiness from public.event_close_readiness(target_event_id);
  if not readiness.can_close then
    raise exception 'Ergebnisse und Anwesenheit muessen vor dem Abschluss vollstaendig sein.';
  end if;

  update public.weekly_events
  set status = 'completed'::public.weekly_event_status
  where id = target_event_id
  returning * into saved;

  if saved.id is null then
    raise exception 'event not found';
  end if;

  return saved;
end;
$$;

-- Re-create the weekly bootstrap with a gate: do not open a new week while a
-- previous event is still open (not completed/cancelled). Returns the open
-- previous event instead, so the club must close it first.
drop function if exists public.ensure_mcc_week();

create or replace function public.ensure_mcc_week()
returns table (mcc_club_id uuid, mcc_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
  resolved_event_id uuid;
  open_previous_event_id uuid;
  current_week date := public.current_week_start(current_date);
  creator_role public.club_member_role := 'member'::public.club_member_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  insert into public.profiles (id, display_name, email, phone, role)
  select
    auth.uid(),
    coalesce(
      nullif(raw_user_meta_data->>'display_name', ''),
      nullif(phone, ''),
      nullif(split_part(email, '@', 1), ''),
      'Cardio-Mitglied'
    ),
    email,
    phone,
    case
      when lower(coalesce(email, '')) = 'messertitus@outlook.com' then 'admin'::public.app_role
      else 'member'::public.app_role
    end
  from auth.users
  where id = auth.uid()
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    display_name = case
      when public.profiles.display_name is null or public.profiles.display_name = '' or public.profiles.display_name = 'Cardio-Mitglied'
      then excluded.display_name
      else public.profiles.display_name
    end;

  select c.id
  into resolved_club_id
  from public.clubs c
  where c.name = 'Messers Cardio Club'
  order by c.created_at asc
  limit 1;

  if resolved_club_id is null then
    insert into public.clubs (name, description, created_by)
    values ('Messers Cardio Club', 'Exklusiver woechentlicher Cardio-Club.', auth.uid())
    returning id into resolved_club_id;
    creator_role := 'owner'::public.club_member_role;
  elsif public.is_admin_user(auth.uid()) then
    creator_role := 'admin'::public.club_member_role;
  end if;

  insert into public.club_members (club_id, user_id, role)
  values (resolved_club_id, auth.uid(), creator_role)
  on conflict (club_id, user_id) do nothing;

  -- Gate: while a prior event is still open, keep showing it instead of opening
  -- the following week. No new voting until the previous event is closed.
  select we.id
  into open_previous_event_id
  from public.weekly_events we
  where we.club_id = resolved_club_id
    and we.week_start_date < current_week
    and we.status not in ('completed'::public.weekly_event_status, 'cancelled'::public.weekly_event_status)
  order by we.week_start_date desc
  limit 1;

  if open_previous_event_id is not null then
    mcc_club_id := resolved_club_id;
    mcc_event_id := open_previous_event_id;
    return next;
    return;
  end if;

  insert into public.weekly_events (
    club_id,
    week_start_date,
    status,
    location,
    starts_at,
    notes,
    activity_contact_id
  )
  values (
    resolved_club_id,
    current_week,
    'voting',
    'Seepark Freiburg',
    (current_week::timestamp + interval '6 days 11 hours')::timestamptz,
    'Teilnahme und Voting laufen Montag bis Mittwoch. Am Donnerstag erscheint die Auswertung.',
    null
  )
  on conflict (club_id, week_start_date) do update
  set
    starts_at = coalesce(public.weekly_events.starts_at, excluded.starts_at),
    notes = excluded.notes
  returning id into resolved_event_id;

  insert into public.sport_proposals (event_id, sport_id, proposed_by, note)
  select resolved_event_id, s.id, auth.uid(), 'Standardauswahl fuer die Testphase'
  from public.sports s
  where s.id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000008'
  )
  on conflict (event_id, sport_id) do nothing;

  mcc_club_id := resolved_club_id;
  mcc_event_id := resolved_event_id;
  return next;
end;
$$;

notify pgrst, 'reload schema';
