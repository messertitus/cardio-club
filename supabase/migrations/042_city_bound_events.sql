-- 042: Bind events to cities.
--
-- Events are local: each weekly_event now belongs to a city. The fairness
-- algorithm only considers sport profiles in that city (filtered in the app
-- layer via sport_profiles.location_city). ensure_mcc_week provisions one set of
-- Cardiotage per ACTIVE city. During the test phase only Konstanz is active, so
-- exactly the Konstanz events are created — members from other cities exist but
-- get no events until their city is activated by an admin. Users can still join
-- another city's events from the app (attendance/votes), which is independent of
-- this provisioning.

-- 1) City column on events + city-aware uniqueness.
alter table public.weekly_events add column if not exists city text;
update public.weekly_events set city = 'Konstanz' where city is null;

drop index if exists public.weekly_events_club_week_day_key;
create unique index if not exists weekly_events_club_week_day_city_key
  on public.weekly_events (club_id, week_start_date, event_day, city);
create index if not exists weekly_events_city_idx on public.weekly_events (city);

-- 2) Active cities for the club.
create table if not exists public.mcc_active_cities (
  club_id uuid not null references public.clubs (id) on delete cascade,
  city text not null,
  created_at timestamptz not null default now(),
  primary key (club_id, city)
);

alter table public.mcc_active_cities enable row level security;

drop policy if exists "active cities readable by members" on public.mcc_active_cities;
create policy "active cities readable by members"
on public.mcc_active_cities for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists "active cities managed by admins" on public.mcc_active_cities;
create policy "active cities managed by admins"
on public.mcc_active_cities for all
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());

-- Seed the test-phase city.
insert into public.mcc_active_cities (club_id, city)
select c.id, 'Konstanz'
from public.clubs c
where c.name = 'Messers Cardio Club'
on conflict do nothing;

-- 3) Admin helpers: list every city that has members, and set the active set.
create or replace function public.list_mcc_member_cities()
returns table (city text, member_count integer, active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
begin
  select c.id into resolved_club_id from public.clubs c where c.name = 'Messers Cardio Club' order by c.created_at asc limit 1;
  if resolved_club_id is null then
    return;
  end if;

  return query
    select p.city,
           count(*)::int as member_count,
           exists (select 1 from public.mcc_active_cities ac where ac.club_id = resolved_club_id and ac.city = p.city) as active
    from public.club_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.club_id = resolved_club_id
      and p.city is not null
      and btrim(p.city) <> ''
    group by p.city
    order by p.city;
end;
$$;

create or replace function public.set_mcc_active_cities(cities text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  select c.id into resolved_club_id from public.clubs c where c.name = 'Messers Cardio Club' order by c.created_at asc limit 1;
  if resolved_club_id is null then
    raise exception 'club not found';
  end if;

  delete from public.mcc_active_cities where club_id = resolved_club_id;
  insert into public.mcc_active_cities (club_id, city)
  select resolved_club_id, btrim(city)
  from unnest(cities) as city
  where btrim(coalesce(city, '')) <> ''
  on conflict do nothing;
end;
$$;

grant execute on function public.list_mcc_member_cities() to authenticated;
grant execute on function public.set_mcc_active_cities(text[]) to authenticated;

-- 4) Provision Cardiotage per active city.
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
  active_cities text[];
  wk date;
   city_name text;
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

  insert into public.mcc_active_cities (club_id, city) values (resolved_club_id, 'Konstanz') on conflict do nothing;
  select coalesce(array_agg(ac.city), array['Konstanz']) into active_cities
  from public.mcc_active_cities ac
  where ac.club_id = resolved_club_id;

  foreach wk in array array[current_week, next_week] loop
    foreach city_name in array active_cities loop
      if settings.saturday_enabled then
        insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day, city)
        values (resolved_club_id, wk, 'voting', city_name, ((wk + 5) + settings.saturday_time)::timestamptz, 'Cardio-Samstag.', null, 'saturday', city_name)
        on conflict (club_id, week_start_date, event_day, city) do update
        set starts_at = excluded.starts_at, notes = excluded.notes;
      end if;

      if settings.sunday_enabled then
        insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day, city)
        values (resolved_club_id, wk, 'voting', city_name, ((wk + 6) + settings.sunday_time)::timestamptz, 'Cardio-Sonntag.', null, 'sunday', city_name)
        on conflict (club_id, week_start_date, event_day, city) do update
        set starts_at = excluded.starts_at, notes = excluded.notes;
      end if;
    end loop;
  end loop;

  -- Seed each event with the currently ACTIVE sports as candidates.
  insert into public.sport_proposals (event_id, sport_id, proposed_by, note)
  select we.id, s.id, auth.uid(), 'Automatische Auswahl fuer den neuen Cardiotag'
  from public.weekly_events we
  cross join public.sports s
  where we.club_id = resolved_club_id
    and we.week_start_date in (current_week, next_week)
    and s.is_active = true
  on conflict (event_id, sport_id) do nothing;

  return query
    select resolved_club_id, we.id, we.event_day
    from public.weekly_events we
    where we.club_id = resolved_club_id
      and we.week_start_date in (current_week, next_week)
    order by we.week_start_date, we.event_day, we.city;
end;
$$;

-- 5) "Voting opened" notification stays local: only notify members of that city.
create or replace function public.enqueue_weekly_event_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'event_created', 'Neue Cardio-Abstimmung',
    'Die neue Woche ist offen: Teilnahme und Voting laufen bis zur Entscheidung.',
    '/',
    jsonb_build_object('eventId', new.id, 'clubId', new.club_id, 'city', new.city)
  from public.club_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.club_id = new.club_id
    and (new.city is null or p.city is null or p.city = new.city)
  on conflict do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';
