-- 064: Name the event's weekday in notifications + (delivery-side) quiet hours.
--
-- (A) Notifications now say which day they are about, e.g.
--       "Neue Abstimmung für Samstag", "Stimme für Sonntag fällig",
--       "Auswertung für Samstag ist da".
--     A small German-label helper maps the event_day enum text to a weekday
--     name. Admin-customized titles (notification_rules) are preserved and get
--     the day appended as "<title> – Samstag"; the default texts read naturally.
--
-- (B) "No pushes at night": members should only receive pushes during the day
--     (Berlin 09:00–22:00). The time gate lives in the *delivery* code (the
--     send-push edge function and the in-app AppNotificationBridge), not here, so
--     a notification enqueued at night simply waits in app_notifications until
--     morning instead of being dropped. This migration only changes the text.

-- (A) German weekday label for an event_day value.
create or replace function public.mcc_event_day_label_de(weekday text)
returns text
language sql
immutable
as $$
  select case weekday
    when 'monday' then 'Montag'
    when 'tuesday' then 'Dienstag'
    when 'wednesday' then 'Mittwoch'
    when 'thursday' then 'Donnerstag'
    when 'friday' then 'Freitag'
    when 'saturday' then 'Samstag'
    when 'sunday' then 'Sonntag'
    else 'Cardiotag'
  end;
$$;

grant execute on function public.mcc_event_day_label_de(text) to authenticated;

-- #1 Voting open — name the day (baseline: migration 063).
create or replace function public.enqueue_vote_open_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
  select * into v_rule from public.notification_rules where system_key = 'event_created';
  if found and v_rule.status <> 'active' then
    return;
  end if;

  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'event_created',
    coalesce(v_rule.title || ' – ' || public.mcc_event_day_label_de(we.event_day),
             'Neue Abstimmung für ' || public.mcc_event_day_label_de(we.event_day)),
    coalesce(v_rule.body, 'Die neue Woche ist offen: Teilnahme und Voting laufen bis zur Entscheidung.'),
    '/',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id, 'city', we.city)
  from public.weekly_events we
  join public.club_members cm on cm.club_id = we.club_id
  join public.profiles p on p.id = cm.user_id
  where public.weekly_event_is_open_for_voting(we.id)
    and (we.city is null or p.city is null or p.city = we.city)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = cm.user_id
        and n.kind = 'event_created'
        and n.payload->>'eventId' = we.id::text
    );
end;
$$;

-- #2 Vote reminder — name the day (baseline: migration 050, still ~5h before close).
create or replace function public.enqueue_vote_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'vote_reminder',
    'Stimme für ' || public.mcc_event_day_label_de(we.event_day) || ' fällig',
    'Die Abstimmung für ' || public.mcc_event_day_label_de(we.event_day) || ' läuft heute ab. Stimm jetzt ab.',
    '/',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.club_members cm on cm.club_id = we.club_id
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    and now() >= (public.mcc_voting_close_at(we.starts_at, we.week_start_date, we.event_day) - interval '5 hours')
    and now() <  public.mcc_voting_close_at(we.starts_at, we.week_start_date, we.event_day)
    and not exists (select 1 from public.attendance a where a.event_id = we.id and a.user_id = cm.user_id and a.status = 'not_going'::public.attendance_status)
    and not exists (select 1 from public.sport_votes v where v.event_id = we.id and v.user_id = cm.user_id)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = cm.user_id and n.kind = 'vote_reminder' and n.payload->>'eventId' = we.id::text
    );
end;
$$;

-- #3 Decision released (time-based) — name the day (baseline: migration 055).
create or replace function public.enqueue_decision_release_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
  select * into v_rule from public.notification_rules where system_key = 'decision_released';
  if found and v_rule.status <> 'active' then
    return;
  end if;

  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'decision_released',
    coalesce(v_rule.title || ' – ' || public.mcc_event_day_label_de(we.event_day),
             'Auswertung für ' || public.mcc_event_day_label_de(we.event_day) || ' ist da'),
    coalesce(v_rule.body, 'Die Entscheidung für ' || public.mcc_event_day_label_de(we.event_day) || ' ist jetzt sichtbar.'),
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

-- #3b Decision released (explicit admin finalize trigger) — name the day
-- (baseline: migration 055).
create or replace function public.enqueue_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
  select * into v_rule from public.notification_rules where system_key = 'decision_released';
  if found and v_rule.status <> 'active' then
    return new;
  end if;

  if new.status = 'decided' and old.status is distinct from new.status then
    insert into public.app_notifications (user_id, kind, title, body, href, payload)
    select a.user_id, 'decision_released',
      coalesce(v_rule.title || ' – ' || public.mcc_event_day_label_de(new.event_day),
               'Auswertung für ' || public.mcc_event_day_label_de(new.event_day) || ' ist da'),
      coalesce(v_rule.body, 'Die Entscheidung für ' || public.mcc_event_day_label_de(new.event_day) || ' ist jetzt sichtbar.'),
      '/events/' || new.id || '/decision',
      jsonb_build_object('eventId', new.id, 'clubId', new.club_id)
    from public.attendance a
    where a.event_id = new.id
      and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
      and not exists (
        select 1 from public.app_notifications n
        where n.user_id = a.user_id and n.kind = 'decision_released' and n.payload->>'eventId' = new.id::text
      );
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
