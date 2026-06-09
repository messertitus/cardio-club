-- 039: Admin-configurable event schedule (days, times, active flags).
--
-- Default: Saturday 14:00 and Sunday 15:00. Admins can change the time of each
-- Cardiotag and whether it runs at all. ensure_mcc_week reads these settings, so
-- the events (and the weather snapshot the algorithm consumes) follow the chosen
-- times automatically. The fairness algorithm itself is unchanged.

create table if not exists public.club_event_settings (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  saturday_enabled boolean not null default true,
  saturday_time time not null default '14:00',
  sunday_enabled boolean not null default true,
  sunday_time time not null default '15:00',
  updated_at timestamptz not null default now()
);

alter table public.club_event_settings enable row level security;

drop policy if exists "event settings readable by club members" on public.club_event_settings;
create policy "event settings readable by club members"
on public.club_event_settings for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists "event settings managed by admins" on public.club_event_settings;
create policy "event settings managed by admins"
on public.club_event_settings for all
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());

create or replace function public.set_mcc_event_schedule(
  sat_enabled boolean,
  sat_time time,
  sun_enabled boolean,
  sun_time time
)
returns public.club_event_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
  saved public.club_event_settings;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  select c.id into resolved_club_id
  from public.clubs c
  where c.name = 'Messers Cardio Club'
  order by c.created_at asc
  limit 1;

  if resolved_club_id is null then
    raise exception 'club not found';
  end if;

  insert into public.club_event_settings (club_id, saturday_enabled, saturday_time, sunday_enabled, sunday_time, updated_at)
  values (resolved_club_id, sat_enabled, sat_time, sun_enabled, sun_time, now())
  on conflict (club_id) do update
  set
    saturday_enabled = excluded.saturday_enabled,
    saturday_time = excluded.saturday_time,
    sunday_enabled = excluded.sunday_enabled,
    sunday_time = excluded.sunday_time,
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

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
  settings public.club_event_settings;
  wk date;
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

  insert into public.club_event_settings (club_id) values (resolved_club_id) on conflict (club_id) do nothing;
  select * into settings from public.club_event_settings where club_id = resolved_club_id;

  foreach wk in array array[current_week, next_week] loop
    if settings.saturday_enabled then
      insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day)
      values (resolved_club_id, wk, 'voting', 'Seepark Freiburg', ((wk + 5) + settings.saturday_time)::timestamptz, 'Cardio-Samstag.', null, 'saturday')
      on conflict (club_id, week_start_date, event_day) do update
      set starts_at = excluded.starts_at, notes = excluded.notes;
    end if;

    if settings.sunday_enabled then
      insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day)
      values (resolved_club_id, wk, 'voting', 'Seepark Freiburg', ((wk + 6) + settings.sunday_time)::timestamptz, 'Cardio-Sonntag.', null, 'sunday')
      on conflict (club_id, week_start_date, event_day) do update
      set starts_at = excluded.starts_at, notes = excluded.notes;
    end if;
  end loop;

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
