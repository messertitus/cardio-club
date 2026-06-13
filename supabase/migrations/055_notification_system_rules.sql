-- 055: Surface the built-in automatic notifications as manageable "system rules".
--
-- The five automatic notifications (voting opened, vote reminder, decision
-- released, chat message, weekly invite reminder) were hardcoded SQL jobs and
-- could not be seen or controlled from the admin UI. We seed one notification_rules
-- row per built-in (marked with system_key) and make the jobs read their on/off
-- status and title/body from that row. The bespoke audience/timing logic of each
-- job is unchanged — only the toggle and the wording become admin-editable.
--
-- System rules can be toggled and reworded, but not deleted, in the UI. If a row
-- is missing the job falls back to its default text and stays active, so removing
-- a row can never silently break a notification.

alter table public.notification_rules add column if not exists system_key text;
create unique index if not exists notification_rules_system_key_key on public.notification_rules (system_key);

-- Allow the weekly invite reminder as a rule kind.
alter table public.notification_rules drop constraint if exists notification_rules_kind_check;
alter table public.notification_rules
  add constraint notification_rules_kind_check
  check (kind in ('vote_open', 'vote_closing', 'decision_available', 'event_reminder', 'idea_proposed', 'chat_hint', 'manual', 'invite_reminder'));

insert into public.notification_rules (system_key, kind, title, body, href, status, conditions, schedule)
values
  ('event_created', 'vote_open', 'Neue Cardio-Abstimmung', 'Die neue Woche ist offen: Teilnahme und Voting laufen bis zur Entscheidung.', '/', 'active', '{}'::jsonb, '{}'::jsonb),
  ('vote_reminder', 'vote_closing', 'Stimme bald fällig', 'Die Abstimmung für deinen Cardiotag läuft heute ab. Stimm jetzt ab.', '/', 'active', '{}'::jsonb, '{}'::jsonb),
  ('decision_released', 'decision_available', 'Auswertung ist da', 'Die Entscheidung für deinen Cardiotag ist jetzt sichtbar.', '/', 'active', '{}'::jsonb, '{}'::jsonb),
  ('chat_message', 'chat_hint', 'Neue Chat-Nachricht', 'Es gibt eine neue Nachricht in einem deiner Event-Chats.', '/chat', 'active', '{}'::jsonb, '{}'::jsonb),
  ('invite_reminder', 'invite_reminder', 'Lade Freunde ein', 'Du hast noch freie Einladungscodes. Teile den Cardio Club mit jemandem.', '/invites', 'active', '{}'::jsonb, '{}'::jsonb)
on conflict (system_key) do nothing;

-- #1 Voting opened (trigger on weekly_events insert).
create or replace function public.enqueue_weekly_event_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
  select * into v_rule from public.notification_rules where system_key = 'event_created';
  if found and v_rule.status <> 'active' then
    return new;
  end if;

  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'event_created',
    coalesce(v_rule.title, 'Neue Cardio-Abstimmung'),
    coalesce(v_rule.body, 'Die neue Woche ist offen: Teilnahme und Voting laufen bis zur Entscheidung.'),
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

-- #2 Vote reminder (~5h before voting closes).
create or replace function public.enqueue_vote_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
  select * into v_rule from public.notification_rules where system_key = 'vote_reminder';
  if found and v_rule.status <> 'active' then
    return;
  end if;

  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'vote_reminder',
    coalesce(v_rule.title, 'Stimme bald fällig'),
    coalesce(v_rule.body, 'Die Abstimmung für deinen Cardiotag läuft heute ab. Stimm jetzt ab.'),
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

-- #3a Decision released (time-based job).
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
    coalesce(v_rule.title, 'Auswertung ist da'),
    coalesce(v_rule.body, 'Die Entscheidung für deinen Cardiotag ist jetzt sichtbar.'),
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

-- #3b Decision released (explicit finalize trigger).
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
      coalesce(v_rule.title, 'Auswertung ist da'),
      coalesce(v_rule.body, 'Die Entscheidung für deinen Cardiotag ist jetzt sichtbar.'),
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

-- #4 Chat message (trigger). Body stays the message text; only title/toggle are editable.
create or replace function public.enqueue_chat_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
  select * into v_rule from public.notification_rules where system_key = 'chat_message';
  if found and v_rule.status <> 'active' then
    return new;
  end if;

  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'chat_message', coalesce(v_rule.title, 'Neue Chat-Nachricht'), left(new.body, 120), '/chat',
    jsonb_build_object('messageId', new.id, 'eventId', new.event_id, 'sportId', new.sport_id)
  from public.attendance a
  where a.event_id = new.event_id
    and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
    and a.user_id <> new.user_id
  on conflict do nothing;
  return new;
end;
$$;

-- #5 Weekly invite reminder.
create or replace function public.enqueue_weekly_invite_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.notification_rules;
begin
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

notify pgrst, 'reload schema';
