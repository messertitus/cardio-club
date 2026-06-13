-- 052: Admin-managed notification rules.
--
-- Admins define notification templates (title/body/link), a target kind, an
-- audience + conditions, an optional schedule, and an explicit status
-- (draft/active/inactive). Sending is ALWAYS admin-initiated through
-- admin_send_notification_rule() and only allowed for 'active' rules — nothing
-- fires automatically here, so no notification is ever sent uncontrolled.
--
-- Delivery reuses the existing pipeline: the function enqueues rows into
-- app_notifications, which the send-push edge function delivers to push
-- subscribers and the in-app bridge surfaces. No service-role key leaves the
-- server; the RPC is security definer and gated by is_admin_user().

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references public.clubs (id) on delete cascade,
  kind text not null default 'manual'
    check (kind in ('vote_open', 'vote_closing', 'decision_available', 'event_reminder', 'idea_proposed', 'chat_hint', 'manual')),
  title text not null,
  body text not null,
  href text not null default '/',
  conditions jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  last_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_rules_status_idx on public.notification_rules (status);

alter table public.notification_rules enable row level security;

-- Admins only. Normal users have no policy at all and therefore no access
-- (neither read nor write) to notification rules.
drop policy if exists "admins manage notification rules" on public.notification_rules;
create policy "admins manage notification rules"
on public.notification_rules for all
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

create or replace function public.touch_notification_rule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notification_rules_touch on public.notification_rules;
create trigger notification_rules_touch
before update on public.notification_rules
for each row execute function public.touch_notification_rule_updated_at();

-- Allow rule-sent notifications into the existing queue.
alter table public.app_notifications drop constraint if exists app_notifications_kind_check;
alter table public.app_notifications
  add constraint app_notifications_kind_check
  check (kind in ('event_created', 'decision_released', 'chat_message', 'vote_reminder', 'invite_reminder', 'admin_rule'));

-- Controlled, admin-initiated send. Enqueues app_notifications for the audience
-- that matches the rule's conditions. test_only restricts delivery to the calling
-- admin (live preview) and ignores status, so admins can try a draft safely.
create or replace function public.admin_send_notification_rule(rule_id uuid, test_only boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rule public.notification_rules;
  cond jsonb;
  current_event uuid;
  inserted integer;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can send notifications.';
  end if;

  select * into rule from public.notification_rules where id = rule_id;
  if not found then
    raise exception 'Notification rule not found.';
  end if;

  -- Test send: only to the calling admin, regardless of status. No spam risk.
  if test_only then
    insert into public.app_notifications (user_id, kind, title, body, href, payload)
    values (auth.uid(), 'admin_rule', rule.title, rule.body, rule.href,
            jsonb_build_object('ruleId', rule.id, 'ruleKind', rule.kind, 'test', true));
    return 1;
  end if;

  -- Real send requires an explicitly activated rule.
  if rule.status <> 'active' then
    raise exception 'Only active rules can be sent.';
  end if;

  cond := rule.conditions;

  -- The club's current open event, used by the vote/attendance conditions.
  select we.id into current_event
  from public.weekly_events we
  where (rule.club_id is null or we.club_id = rule.club_id)
    and we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
  order by we.week_start_date desc
  limit 1;

  with audience as (
    select distinct cm.user_id
    from public.club_members cm
    join public.profiles p on p.id = cm.user_id
    where (rule.club_id is null or cm.club_id = rule.club_id)
      and (coalesce((cond->>'activeOnly')::boolean, false) = false or p.deactivated_at is null)
      and (coalesce((cond->>'pushOnly')::boolean, false) = false
           or exists (select 1 from public.push_subscriptions ps where ps.user_id = cm.user_id))
      and (coalesce((cond->>'notVoted')::boolean, false) = false
           or (current_event is not null and not exists (select 1 from public.sport_votes v where v.event_id = current_event and v.user_id = cm.user_id)))
      and (coalesce((cond->>'attendanceNotSet')::boolean, false) = false
           or (current_event is not null and not exists (select 1 from public.attendance a where a.event_id = current_event and a.user_id = cm.user_id)))
      and (coalesce((cond->>'goingOrMaybe')::boolean, false) = false
           or (current_event is not null and exists (
                 select 1 from public.attendance a
                 where a.event_id = current_event and a.user_id = cm.user_id
                   and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status))))
  )
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'admin_rule', rule.title, rule.body, rule.href,
         jsonb_build_object('ruleId', rule.id, 'ruleKind', rule.kind)
  from audience a
  -- De-dupe: never re-queue the same rule for a user within the last hour, so an
  -- accidental double click cannot spam.
  where not exists (
    select 1 from public.app_notifications n
    where n.user_id = a.user_id
      and n.kind = 'admin_rule'
      and n.payload->>'ruleId' = rule.id::text
      and n.created_at > now() - interval '1 hour'
  );

  get diagnostics inserted = row_count;
  update public.notification_rules set last_sent_at = now() where id = rule.id;
  return inserted;
end;
$$;

grant execute on function public.admin_send_notification_rule(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
