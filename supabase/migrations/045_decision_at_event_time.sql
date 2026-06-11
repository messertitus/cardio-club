-- 045: Anchor the decision / voting-close moment to the event's actual time.
--
-- The decision (Auswertung) and voting close happen 2 days before the event, at
-- the event's configured time of day (e.g. 14:00 / 15:00) instead of midnight.
-- Push notifications therefore fire at that exact moment. We derive it from the
-- event's starts_at (which already carries the configured time), falling back to
-- the weekday offset at midnight only if starts_at is missing.

create or replace function public.mcc_decision_release_at(starts_at timestamptz, week_start date, weekday text)
returns timestamptz
language sql
immutable
as $$
  select coalesce(
    starts_at,
    ((week_start + public.mcc_event_weekday_offset(weekday))::timestamp at time zone 'UTC')
  ) - interval '2 days';
$$;

grant execute on function public.mcc_decision_release_at(timestamptz, date, text) to authenticated;

-- #2 Vote reminder — within 12h before voting closes (= the decision moment, at event time).
create or replace function public.enqueue_vote_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'vote_reminder', 'Stimme bald fällig',
    'Die Abstimmung für deinen Cardiotag läuft in Kürze ab. Stimm jetzt ab.',
    '/',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.club_members cm on cm.club_id = we.club_id
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    and now() >= (public.mcc_decision_release_at(we.starts_at, we.week_start_date, we.event_day) - interval '12 hours')
    and now() <  public.mcc_decision_release_at(we.starts_at, we.week_start_date, we.event_day)
    and not exists (select 1 from public.attendance a where a.event_id = we.id and a.user_id = cm.user_id and a.status = 'not_going'::public.attendance_status)
    and not exists (select 1 from public.sport_votes v where v.event_id = we.id and v.user_id = cm.user_id)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = cm.user_id and n.kind = 'vote_reminder' and n.payload->>'eventId' = we.id::text
    );
end;
$$;

-- #3 Decision released — fires at the event time, 2 days before the event.
create or replace function public.enqueue_decision_release_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'decision_released', 'Auswertung ist da',
    'Die Entscheidung für deinen Cardiotag ist jetzt sichtbar.',
    '/events/' || we.id || '/decision',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.attendance a on a.event_id = we.id and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
  where we.status <> 'cancelled'::public.weekly_event_status
    and we.week_start_date >= (public.current_week_start(current_date) - 7)
    and now() >= public.mcc_decision_release_at(we.starts_at, we.week_start_date, we.event_day)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = a.user_id and n.kind = 'decision_released' and n.payload->>'eventId' = we.id::text
    );
end;
$$;

-- #7 Skip events with fewer than two voters at the decision moment (event time).
create or replace function public.cancel_underused_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.weekly_events we
  set status = 'cancelled'::public.weekly_event_status
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    and now() >= public.mcc_decision_release_at(we.starts_at, we.week_start_date, we.event_day)
    and (
      select count(distinct v.user_id)
      from public.sport_votes v
      join public.attendance a
        on a.event_id = v.event_id
       and a.user_id = v.user_id
       and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
      where v.event_id = we.id
    ) < 2;
end;
$$;

notify pgrst, 'reload schema';
