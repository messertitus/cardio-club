-- 063: Notify "voting open" only when voting is actually open, and keep the
-- weekly invite reminder to daytime.
--
-- Two issues:
--  (A) The "Neue Cardio-Abstimmung" notification fired from an AFTER INSERT
--      trigger on weekly_events. ensure_mcc_week() creates the Saturday AND
--      Sunday rows for a new week at once, so members got one push per created
--      event — even for an event whose voting window is not open yet. The
--      notification should fire when a member can actually vote, not when the
--      week's rows are created.
--  (B) enqueue_weekly_invite_reminders() had no time-of-day guard. Because the
--      job runner (run_mcc_notification_jobs, via send-push) runs every few
--      minutes around the clock, the invite reminder could be queued at night
--      (reported: a 02:00 push).
--
-- Fix:
--  (A) Drop the insert trigger and instead enqueue from the frequent job runner,
--      gated by weekly_event_is_open_for_voting() and dedup-safe per (user,event).
--  (B) Gate the invite reminder to Berlin daytime (10:00–20:00).

-- (A) Stop notifying on event creation.
drop trigger if exists enqueue_weekly_event_notification_trigger on public.weekly_events;

-- (A) Scheduled, dedup-safe "voting open" notification. Reuses the existing
-- 'event_created' system rule (toggle + wording) and the 'event_created' kind,
-- scoped to the member's city like the old trigger.
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
    coalesce(v_rule.title, 'Neue Cardio-Abstimmung'),
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

-- (B) Daytime-only weekly invite reminder (Berlin 10:00–20:00). Otherwise
-- unchanged: only members with unused codes, at most once per week.
create or replace function public.enqueue_weekly_invite_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
  v_now_berlin time := (now() at time zone 'Europe/Berlin')::time;
begin
  if v_now_berlin < '10:00'::time or v_now_berlin >= '20:00'::time then
    return;
  end if;

  select * into v_rule from public.notification_rules where system_key = 'invite_reminder';
  if found and v_rule.status <> 'active' then
    return;
  end if;

  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'invite_reminder',
    coalesce(v_rule.title, 'Lade Freunde ein'),
    coalesce(v_rule.body, 'Du hast noch freie Einladungscodes. Teile den Cardio Club mit jemandem.'),
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

-- Wire the new "voting open" job into the shared runner.
create or replace function public.run_mcc_notification_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_vote_open_notifications();
  perform public.enqueue_vote_reminders();
  perform public.enqueue_decision_release_notifications();
  perform public.enqueue_weekly_invite_reminders();
  perform public.run_due_notification_rules();
end;
$$;

notify pgrst, 'reload schema';
