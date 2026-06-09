-- 038: Event page always shows this week AND next week (Saturday + Sunday each).
--
-- Closed/past events drop off the event page and live in the archive instead.
-- There is no longer a "previous week must be closed first" gate. The fairness
-- algorithm is unchanged; it still runs per event.

-- Idempotent: ensure the day column + uniqueness exist even if 037 was skipped.
alter table public.weekly_events
  add column if not exists event_day text not null default 'sunday'
  check (event_day in ('saturday', 'sunday'));

alter table public.weekly_events drop constraint if exists weekly_events_club_id_week_start_date_key;
create unique index if not exists weekly_events_club_week_day_key
  on public.weekly_events (club_id, week_start_date, event_day);

drop function if exists public.ensure_mcc_week();

create or replace function public.ensure_mcc_week()
returns table (mcc_club_id uuid, mcc_event_id uuid, mcc_event_day text)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
  current_week date := public.current_week_start(current_date);
  next_week date := public.current_week_start(current_date) + 7;
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

  -- Provision a Saturday and a Sunday event for this week and next week.
  insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day)
  values
    (resolved_club_id, current_week, 'voting', 'Seepark Freiburg', (current_week::timestamp + interval '5 days 11 hours')::timestamptz, 'Cardio-Samstag.', null, 'saturday'),
    (resolved_club_id, current_week, 'voting', 'Seepark Freiburg', (current_week::timestamp + interval '6 days 11 hours')::timestamptz, 'Cardio-Sonntag.', null, 'sunday'),
    (resolved_club_id, next_week, 'voting', 'Seepark Freiburg', (next_week::timestamp + interval '5 days 11 hours')::timestamptz, 'Cardio-Samstag.', null, 'saturday'),
    (resolved_club_id, next_week, 'voting', 'Seepark Freiburg', (next_week::timestamp + interval '6 days 11 hours')::timestamptz, 'Cardio-Sonntag.', null, 'sunday')
  on conflict (club_id, week_start_date, event_day) do update
  set
    starts_at = coalesce(public.weekly_events.starts_at, excluded.starts_at),
    notes = excluded.notes;

  insert into public.sport_proposals (event_id, sport_id, proposed_by, note)
  select we.id, s.id, auth.uid(), 'Standardauswahl fuer die Testphase'
  from public.weekly_events we
  cross join public.sports s
  where we.club_id = resolved_club_id
    and we.week_start_date in (current_week, next_week)
    and s.id in (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000008'
    )
  on conflict (event_id, sport_id) do nothing;

  return query
    select resolved_club_id, we.id, we.event_day
    from public.weekly_events we
    where we.club_id = resolved_club_id
      and we.week_start_date in (current_week, next_week)
    order by we.week_start_date, we.event_day;
end;
$$;

notify pgrst, 'reload schema';
