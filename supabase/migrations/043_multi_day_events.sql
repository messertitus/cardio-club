-- 043: Allow Cardiotage on any weekday (not just Saturday/Sunday).
--
-- Event days become admin-configurable: a club can run an event on any weekday,
-- each with its own start time. Same voting logic as before — voting is open
-- until the decision releases 3 days before the event. ensure_mcc_week now
-- provisions events for every active weekday × active city. The fairness
-- algorithm is unchanged.

-- 1) Allow all weekdays on the event_day column.
alter table public.weekly_events drop constraint if exists weekly_events_event_day_check;
alter table public.weekly_events
  add constraint weekly_events_event_day_check
  check (event_day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));

-- 2) Per-weekday schedule (presence of a row = that weekday runs).
create table if not exists public.mcc_event_days (
  club_id uuid not null references public.clubs (id) on delete cascade,
  weekday text not null check (weekday in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  start_time time not null default '14:00',
  primary key (club_id, weekday)
);

alter table public.mcc_event_days enable row level security;

drop policy if exists "event days readable by members" on public.mcc_event_days;
create policy "event days readable by members"
on public.mcc_event_days for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists "event days managed by admins" on public.mcc_event_days;
create policy "event days managed by admins"
on public.mcc_event_days for all
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());

-- Seed from the existing Saturday/Sunday schedule so the current setup carries over.
insert into public.mcc_event_days (club_id, weekday, start_time)
select c.id, 'saturday', coalesce(s.saturday_time, '14:00')
from public.clubs c
left join public.club_event_settings s on s.club_id = c.id
where c.name = 'Messers Cardio Club' and (s.saturday_enabled is null or s.saturday_enabled = true)
on conflict do nothing;

insert into public.mcc_event_days (club_id, weekday, start_time)
select c.id, 'sunday', coalesce(s.sunday_time, '15:00')
from public.clubs c
left join public.club_event_settings s on s.club_id = c.id
where c.name = 'Messers Cardio Club' and (s.sunday_enabled is null or s.sunday_enabled = true)
on conflict do nothing;

-- 3) Admin RPC: replace the active weekday schedule. days = [{ "weekday": "...", "time": "HH:MM" }].
create or replace function public.set_mcc_event_days(days jsonb)
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

  delete from public.mcc_event_days where club_id = resolved_club_id;
  insert into public.mcc_event_days (club_id, weekday, start_time)
  select resolved_club_id, elem->>'weekday', coalesce(nullif(elem->>'time', ''), '14:00')::time
  from jsonb_array_elements(days) as elem
  where (elem->>'weekday') in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  on conflict do nothing;
end;
$$;

grant execute on function public.set_mcc_event_days(jsonb) to authenticated;

-- 4) Provision events for every active weekday × active city.
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
  active_cities text[];
  wk date;
  city_name text;
  day_row record;
  day_offset int;
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

  -- Active cities (test phase: Konstanz).
  insert into public.mcc_active_cities (club_id, city) values (resolved_club_id, 'Konstanz') on conflict do nothing;
  select coalesce(array_agg(ac.city), array['Konstanz']) into active_cities
  from public.mcc_active_cities ac
  where ac.club_id = resolved_club_id;

  -- Default weekday schedule for a fresh club (Saturday + Sunday). Admin edits
  -- (including removing a day) are preserved: only seed when nothing is set.
  if not exists (select 1 from public.mcc_event_days where club_id = resolved_club_id) then
    insert into public.mcc_event_days (club_id, weekday, start_time)
    values (resolved_club_id, 'saturday', '14:00'), (resolved_club_id, 'sunday', '15:00')
    on conflict do nothing;
  end if;

  foreach wk in array array[current_week, next_week] loop
    for day_row in select weekday, start_time from public.mcc_event_days where club_id = resolved_club_id loop
      day_offset := case day_row.weekday
        when 'monday' then 0
        when 'tuesday' then 1
        when 'wednesday' then 2
        when 'thursday' then 3
        when 'friday' then 4
        when 'saturday' then 5
        else 6
      end;

      foreach city_name in array active_cities loop
        insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day, city)
        values (
          resolved_club_id, wk, 'voting', city_name,
          ((wk + day_offset) + day_row.start_time)::timestamptz,
          'Cardiotag.', null, day_row.weekday, city_name
        )
        on conflict (club_id, week_start_date, event_day, city) do update
        set starts_at = excluded.starts_at;
      end loop;
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

notify pgrst, 'reload schema';
