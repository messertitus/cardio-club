-- 040: Complete the notification queue for the five required cases.
--
-- 1. Voting opened for an event      -> trigger on weekly_events insert (035)
-- 2. Vote closing in ~12h (no vote)  -> enqueue_vote_reminders()
-- 3. Decision released (attendees)   -> enqueue_decision_release_notifications()
-- 4. Chat message (event attendees)  -> refined enqueue_chat_notification()
-- 5. Weekly invite reminder          -> enqueue_weekly_invite_reminders()
--
-- run_mcc_notification_jobs() runs the time-based jobs (2/3/5) and is dedup-safe,
-- so it can be called frequently — by the app on each notification poll and/or by
-- a scheduler. Actual background delivery is done by the send-push edge function.

-- Allow the two new notification kinds.
alter table public.app_notifications drop constraint if exists app_notifications_kind_check;
alter table public.app_notifications
  add constraint app_notifications_kind_check
  check (kind in ('event_created', 'decision_released', 'chat_message', 'vote_reminder', 'invite_reminder'));

-- #4 Chat: notify the event's participants (going/maybe), not the whole club.
create or replace function public.enqueue_chat_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'chat_message', 'Neue Chat-Nachricht', left(new.body, 120), '/chat',
    jsonb_build_object('messageId', new.id, 'eventId', new.event_id, 'sportId', new.sport_id)
  from public.attendance a
  where a.event_id = new.event_id
    and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
    and a.user_id <> new.user_id
  on conflict do nothing;
  return new;
end;
$$;

-- #3 Decision via explicit finalize: notify attendees only (dedup with the job).
create or replace function public.enqueue_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'decided' and old.status is distinct from new.status then
    insert into public.app_notifications (user_id, kind, title, body, href, payload)
    select a.user_id, 'decision_released', 'Auswertung ist da',
      'Die Entscheidung fuer deinen Cardiotag ist jetzt sichtbar.',
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

-- #2 Remind members who have not voted, in the last 12h before voting closes.
create or replace function public.enqueue_vote_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'vote_reminder', 'Stimme bald faellig',
    'Die Abstimmung fuer deinen Cardiotag laeuft in Kuerze ab. Stimm jetzt ab.',
    '/',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.club_members cm on cm.club_id = we.club_id
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    and now() >= ((we.week_start_date + (case we.event_day when 'saturday' then 2 else 3 end))::timestamp - interval '12 hours')
    and now() <  ((we.week_start_date + (case we.event_day when 'saturday' then 2 else 3 end))::timestamp)
    and not exists (select 1 from public.attendance a where a.event_id = we.id and a.user_id = cm.user_id and a.status = 'not_going'::public.attendance_status)
    and not exists (select 1 from public.sport_votes v where v.event_id = we.id and v.user_id = cm.user_id)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = cm.user_id and n.kind = 'vote_reminder' and n.payload->>'eventId' = we.id::text
    );
end;
$$;

-- #3 Notify attendees once the decision is released (time-based, no admin needed).
create or replace function public.enqueue_decision_release_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'decision_released', 'Auswertung ist da',
    'Die Entscheidung fuer deinen Cardiotag ist jetzt sichtbar.',
    '/events/' || we.id || '/decision',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.attendance a on a.event_id = we.id and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
  where we.status <> 'cancelled'::public.weekly_event_status
    and we.week_start_date >= (public.current_week_start(current_date) - 7)
    and now() >= ((we.week_start_date + (case we.event_day when 'saturday' then 2 else 3 end))::timestamp)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = a.user_id and n.kind = 'decision_released' and n.payload->>'eventId' = we.id::text
    );
end;
$$;

-- #5 Weekly reminder for members who still have unused invite codes.
create or replace function public.enqueue_weekly_invite_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'invite_reminder', 'Lade Freunde ein',
    'Du hast noch freie Einladungscodes. Teile den Cardio Club mit jemandem.',
    '/invites',
    '{}'::jsonb
  from public.club_members cm
  where exists (
      select 1 from public.invitation_codes ic where ic.created_by = cm.user_id and ic.used_by is null
    )
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = cm.user_id and n.kind = 'invite_reminder'
        and n.created_at >= public.current_week_start(current_date)::timestamp
    );
end;
$$;

create or replace function public.run_mcc_notification_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_vote_reminders();
  perform public.enqueue_decision_release_notifications();
  perform public.enqueue_weekly_invite_reminders();
end;
$$;

grant execute on function public.run_mcc_notification_jobs() to authenticated;

notify pgrst, 'reload schema';
