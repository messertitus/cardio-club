create or replace function public.weekly_event_is_open_for_voting(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.weekly_events we
    where we.id = target_event_id
      and we.status in ('proposing', 'voting')
      and current_date >= we.week_start_date
      and current_date < (we.week_start_date + interval '3 days')::date
  );
$$;

drop policy if exists "attendance can be created by attendee" on public.attendance;
create policy "attendance can be created by attendee"
on public.attendance for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
  and public.weekly_event_is_open_for_voting(event_id)
  and (
    subgroup_id is null
    or public.subgroup_event_id(subgroup_id) = event_id
  )
);

drop policy if exists "attendance can be updated by attendee or club admins" on public.attendance;
create policy "attendance can be updated by attendee or club admins"
on public.attendance for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_club_admin(public.event_club_id(event_id))
)
with check (
  public.is_club_member(public.event_club_id(event_id))
  and public.weekly_event_is_open_for_voting(event_id)
  and (
    subgroup_id is null
    or public.subgroup_event_id(subgroup_id) = event_id
  )
  and (
    user_id = auth.uid()
    or public.is_club_admin(public.event_club_id(event_id))
  )
);

alter table public.chat_messages
  add column if not exists reply_to_message_id uuid references public.chat_messages (id) on delete set null;

alter table public.direct_chat_messages
  add column if not exists reply_to_message_id uuid references public.direct_chat_messages (id) on delete set null;

create index if not exists chat_messages_reply_idx
on public.chat_messages (reply_to_message_id);

create index if not exists direct_chat_messages_reply_idx
on public.direct_chat_messages (reply_to_message_id);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('event_created', 'decision_released', 'chat_message')),
  title text not null,
  body text not null,
  href text not null default '/',
  payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_user_created_idx
on public.app_notifications (user_id, created_at desc);

create index if not exists app_notifications_user_undelivered_idx
on public.app_notifications (user_id, created_at desc)
where delivered_at is null;

alter table public.app_notifications enable row level security;

drop policy if exists "users can read own app notifications" on public.app_notifications;
create policy "users can read own app notifications"
on public.app_notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can update own app notifications" on public.app_notifications;
create policy "users can update own app notifications"
on public.app_notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.enqueue_club_notification(
  target_club_id uuid,
  actor_id uuid,
  next_kind text,
  next_title text,
  next_body text,
  next_href text,
  next_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, next_kind, next_title, next_body, next_href, next_payload
  from public.club_members cm
  where cm.club_id = target_club_id
    and (actor_id is null or cm.user_id <> actor_id)
  on conflict do nothing;
end;
$$;

create or replace function public.enqueue_weekly_event_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_club_notification(
    new.club_id,
    null,
    'event_created',
    'Neue Cardio-Abstimmung',
    'Die neue Woche ist offen: Teilnahme und Voting laufen bis Mittwoch.',
    '/',
    jsonb_build_object('eventId', new.id, 'clubId', new.club_id)
  );
  return new;
end;
$$;

drop trigger if exists enqueue_weekly_event_notification_trigger on public.weekly_events;
create trigger enqueue_weekly_event_notification_trigger
after insert on public.weekly_events
for each row execute function public.enqueue_weekly_event_notification();

create or replace function public.enqueue_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'decided' and old.status is distinct from new.status then
    perform public.enqueue_club_notification(
      new.club_id,
      null,
      'decision_released',
      'Auswertung ist da',
      'Die Entscheidung fuer den Cardiotag ist jetzt sichtbar.',
      '/events/' || new.id || '/decision',
      jsonb_build_object('eventId', new.id, 'clubId', new.club_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_decision_notification_trigger on public.weekly_events;
create trigger enqueue_decision_notification_trigger
after update on public.weekly_events
for each row execute function public.enqueue_decision_notification();

create or replace function public.enqueue_chat_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_club_notification(
    new.club_id,
    new.user_id,
    'chat_message',
    'Neue Chat-Nachricht',
    left(new.body, 120),
    '/chat',
    jsonb_build_object('messageId', new.id, 'eventId', new.event_id, 'sportId', new.sport_id)
  );
  return new;
end;
$$;

drop trigger if exists enqueue_chat_notification_trigger on public.chat_messages;
create trigger enqueue_chat_notification_trigger
after insert on public.chat_messages
for each row execute function public.enqueue_chat_notification();

create or replace function public.enqueue_direct_chat_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  select case when dc.requester_id = new.user_id then dc.admin_id else dc.requester_id end
  into target_user_id
  from public.direct_chats dc
  where dc.id = new.chat_id;

  if target_user_id is not null then
    insert into public.app_notifications (user_id, kind, title, body, href, payload)
    values (
      target_user_id,
      'chat_message',
      'Neue Direktnachricht',
      left(new.body, 120),
      '/chat',
      jsonb_build_object('directChatId', new.chat_id, 'messageId', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists enqueue_direct_chat_notification_trigger on public.direct_chat_messages;
create trigger enqueue_direct_chat_notification_trigger
after insert on public.direct_chat_messages
for each row execute function public.enqueue_direct_chat_notification();

drop function if exists public.ensure_mcc_week();

create or replace function public.ensure_mcc_week()
returns table (mcc_club_id uuid, mcc_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
  resolved_event_id uuid;
  current_week date := public.current_week_start(current_date);
  creator_role public.club_member_role := 'member'::public.club_member_role;
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

  insert into public.weekly_events (
    club_id,
    week_start_date,
    status,
    location,
    starts_at,
    notes,
    activity_contact_id
  )
  values (
    resolved_club_id,
    current_week,
    'voting',
    'Seepark Freiburg',
    (current_week::timestamp + interval '6 days 11 hours')::timestamptz,
    'Teilnahme und Voting laufen Montag bis Mittwoch. Am Donnerstag erscheint die Auswertung.',
    null
  )
  on conflict (club_id, week_start_date) do update
  set
    starts_at = coalesce(public.weekly_events.starts_at, excluded.starts_at),
    notes = excluded.notes
  returning id into resolved_event_id;

  insert into public.sport_proposals (event_id, sport_id, proposed_by, note)
  select resolved_event_id, s.id, auth.uid(), 'Standardauswahl fuer die Testphase'
  from public.sports s
  where s.id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000008'
  )
  on conflict (event_id, sport_id) do nothing;

  mcc_club_id := resolved_club_id;
  mcc_event_id := resolved_event_id;
  return next;
end;
$$;

notify pgrst, 'reload schema';
