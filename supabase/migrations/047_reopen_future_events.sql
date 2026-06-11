-- 047: Don't keep future events cancelled.
--
-- cancel_underused_events skips events that reach their decision moment with < 2
-- voters. But ensure_mcc_week's `on conflict do update` only refreshed starts_at,
-- so a cancelled event stayed cancelled forever — even after re-provisioning and
-- even if its decision is still days away. For a small/solo test club that empties
-- the home entirely. Re-open any cancelled event whose decision has NOT passed yet,
-- and make ensure_mcc_week do the same on every upsert.

-- One-time repair: bring back wrongly-cancelled upcoming events.
update public.weekly_events we
set status = 'voting'::public.weekly_event_status
where we.status = 'cancelled'::public.weekly_event_status
  and we.starts_at is not null
  and now() < (we.starts_at - interval '2 days');

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

  insert into public.mcc_active_cities (club_id, city) values (resolved_club_id, 'Konstanz') on conflict do nothing;
  select coalesce(array_agg(ac.city), array['Konstanz']) into active_cities
  from public.mcc_active_cities ac
  where ac.club_id = resolved_club_id;

  if not exists (select 1 from public.mcc_event_days where club_id = resolved_club_id) then
    insert into public.mcc_event_days (club_id, weekday, start_time)
    values (resolved_club_id, 'saturday', '14:00'), (resolved_club_id, 'sunday', '15:00')
    on conflict do nothing;
  end if;

  foreach wk in array array[current_week, next_week] loop
    for day_row in select weekday, start_time from public.mcc_event_days where club_id = resolved_club_id loop
      day_offset := public.mcc_event_weekday_offset(day_row.weekday);

      foreach city_name in array active_cities loop
        insert into public.weekly_events (club_id, week_start_date, status, location, starts_at, notes, activity_contact_id, event_day, city)
        values (
          resolved_club_id, wk, 'voting', city_name,
          (((wk + day_offset) + day_row.start_time) at time zone 'Europe/Berlin'),
          'Cardiotag.', null, day_row.weekday, city_name
        )
        on conflict (club_id, week_start_date, event_day, city) do update
        set starts_at = excluded.starts_at,
            status = case
              when public.weekly_events.status = 'cancelled'::public.weekly_event_status
               and now() < (excluded.starts_at - interval '2 days')
              then 'voting'::public.weekly_event_status
              else public.weekly_events.status
            end;
      end loop;
    end loop;
  end loop;

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
