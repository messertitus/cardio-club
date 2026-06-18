-- 066: Aggregated chapter overview (retention + weekly-loop), READ-ONLY.
--
-- Answers exactly two questions for the admin: (1) do people really come back?
-- (2) does the weekly loop run reliably? Everything is COMPUTED from existing
-- data — no new raw counters, no schema change. It deliberately uses REAL
-- attendance only:
--   * real attendance = attendance.actual_status = 'present' (set by the post-
--     event review via review_event_attendance) — NOT screen.event_viewed and
--     NOT the RSVP (attendance.status).
--   * No-Show = RSVP yes (going/maybe) but actual_status = 'absent'.
-- A "held" event = a non-cancelled weekly_event whose date is in the past.
-- p_window_days filters ONLY the per-event list (cards/streak/loyalty stay
-- cumulative, since "returner"/"streak" are inherently all-time facts).
-- Admin-only (is_admin_user); division-by-zero guarded (null instead of NaN).

create or replace function public.get_chapter_overview(p_window_days integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can view the chapter overview';
  end if;

  with held0 as (
    select we.id, we.week_start_date, we.selected_sport_id, we.secondary_sport_id,
      (we.week_start_date + (case we.event_day
         when 'monday' then 0 when 'tuesday' then 1 when 'wednesday' then 2
         when 'thursday' then 3 when 'friday' then 4 when 'saturday' then 5 else 6 end)) as event_date
    from public.weekly_events we
    where we.status <> 'cancelled'::public.weekly_event_status
  ),
  held as (select * from held0 where event_date <= current_date),
  held_nr as (select h.*, row_number() over (order by h.event_date asc, h.id) as event_nr from held h),
  pres as (
    select a.user_id, h.id as event_id, h.event_date
    from public.attendance a
    join held h on h.id = a.event_id
    where a.actual_status = 'present'::public.actual_attendance_status
  ),
  per_user as (
    select user_id, count(distinct event_id) as cnt, min(event_date) as first_date, max(event_date) as last_date
    from pres group by user_id
  ),
  ev_rsvp as (
    select a.event_id,
      count(*) filter (where a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)) as rsvp_yes,
      count(*) filter (where a.actual_status = 'present'::public.actual_attendance_status) as present_cnt,
      count(*) filter (where a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
                         and a.actual_status = 'absent'::public.actual_attendance_status) as no_shows
    from public.attendance a join held h on h.id = a.event_id
    group by a.event_id
  ),
  ev_first as (
    select p.event_id,
      count(*) filter (where p.event_date = pu.first_date) as first_timers,
      count(*) filter (where p.event_date > pu.first_date) as returners
    from pres p join per_user pu on pu.user_id = p.user_id
    group by p.event_id
  ),
  ev_votes as (
    select v.event_id, count(distinct v.user_id) as voters
    from public.sport_votes v join held h on h.id = v.event_id
    group by v.event_id
  ),
  members as (
    select count(distinct cm.user_id) as total
    from public.club_members cm join public.profiles p on p.id = cm.user_id
    where p.deactivated_at is null
  ),
  held_weeks as (select distinct week_start_date from held),
  ranked_weeks as (select week_start_date, row_number() over (order by week_start_date desc) as rn from held_weeks),
  streak as (
    -- consecutive held weeks ending at the most recent one. (rn-1)*7 is bigint;
    -- cast to int because Postgres only has date - integer, not date - bigint.
    select count(*) as weeks from ranked_weeks
    where week_start_date = (select max(week_start_date) from held_weeks) - (((rn - 1) * 7)::int)
  )
  select jsonb_build_object(
    'membersTotal', (select total from members),
    'membersWithPresent', (select count(*) from per_user where cnt >= 1),
    'returners', (select count(*) from per_user where cnt >= 2),
    'returnerPercent', (
      select case when count(*) filter (where cnt >= 1) = 0 then null
        else round(count(*) filter (where cnt >= 2)::numeric * 100 / count(*) filter (where cnt >= 1)) end
      from per_user),
    'active7', (select count(*) from per_user where last_date >= current_date - 7),
    'active30', (select count(*) from per_user where last_date >= current_date - 30),
    'eventStreakWeeks', coalesce((select weeks from streak), 0),
    'heldEventsTotal', (select count(*) from held),
    'loyalty', jsonb_build_object(
      'one', (select count(*) from per_user where cnt = 1),
      'two', (select count(*) from per_user where cnt = 2),
      'three', (select count(*) from per_user where cnt = 3),
      'fourPlus', (select count(*) from per_user where cnt >= 4)
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventNr', hn.event_nr,
        'date', hn.event_date,
        'sport', coalesce(s1.name, '—') || coalesce(' + ' || s2.name, ''),
        'rsvpYes', coalesce(r.rsvp_yes, 0),
        'present', coalesce(r.present_cnt, 0),
        'noShows', coalesce(r.no_shows, 0),
        'firstTimers', coalesce(f.first_timers, 0),
        'returners', coalesce(f.returners, 0),
        'noShowPercent', case when coalesce(r.rsvp_yes, 0) = 0 then null
                              else round(coalesce(r.no_shows, 0)::numeric * 100 / r.rsvp_yes) end,
        'votingPercent', case when (select total from members) = 0 then null
                              else round(coalesce(vv.voters, 0)::numeric * 100 / (select total from members)) end
      ) order by hn.event_date desc, hn.event_nr desc)
      from held_nr hn
      left join ev_rsvp r on r.event_id = hn.id
      left join ev_first f on f.event_id = hn.id
      left join ev_votes vv on vv.event_id = hn.id
      left join public.sports s1 on s1.id = hn.selected_sport_id
      left join public.sports s2 on s2.id = hn.secondary_sport_id
      where (p_window_days is null or hn.event_date >= current_date - p_window_days)
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_chapter_overview(integer) to authenticated;

notify pgrst, 'reload schema';
