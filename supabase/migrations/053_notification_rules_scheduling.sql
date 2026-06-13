-- 053: Richer notification-rule conditions, scheduled sending, and admin queue
-- management.
--
-- - More audience conditions (push/no-push, city, role, voted, attendance).
-- - A schedule that supports a concrete time/date for one-time rules and a
--   weekday + time for recurring rules.
-- - run_due_notification_rules() auto-sends ACTIVE rules whose scheduled moment
--   has arrived (one-time rules fire once and deactivate themselves). It is wired
--   into run_mcc_notification_jobs(), the dedup-safe runner the app/scheduler
--   already calls — so nothing fires unless an admin has explicitly activated it.
-- - Admins can read and delete rows in app_notifications to manage the queue.

-- Admins may inspect and prune the whole notification queue.
drop policy if exists "admins read all app notifications" on public.app_notifications;
create policy "admins read all app notifications"
on public.app_notifications for select
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "admins delete app notifications" on public.app_notifications;
create policy "admins delete app notifications"
on public.app_notifications for delete
to authenticated
using (public.is_admin_user(auth.uid()));

-- Internal: enqueue a rule for its matching audience. No admin check (callers
-- guard), security definer so it can read members/votes/attendance. Dedup-safe.
create or replace function public.enqueue_notification_rule(rule_id uuid)
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
  select * into rule from public.notification_rules where id = rule_id;
  if not found then
    return 0;
  end if;

  cond := rule.conditions;

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
      and (coalesce((cond->>'noPush')::boolean, false) = false
           or not exists (select 1 from public.push_subscriptions ps where ps.user_id = cm.user_id))
      and (coalesce((cond->>'hasCity')::boolean, false) = false or coalesce(btrim(p.city), '') <> '')
      and (coalesce((cond->>'noCity')::boolean, false) = false or coalesce(btrim(p.city), '') = '')
      and (coalesce((cond->>'adminsOnly')::boolean, false) = false or p.role = 'admin')
      and (coalesce((cond->>'notVoted')::boolean, false) = false
           or (current_event is not null and not exists (select 1 from public.sport_votes v where v.event_id = current_event and v.user_id = cm.user_id)))
      and (coalesce((cond->>'voted')::boolean, false) = false
           or (current_event is not null and exists (select 1 from public.sport_votes v where v.event_id = current_event and v.user_id = cm.user_id)))
      and (coalesce((cond->>'attendanceNotSet')::boolean, false) = false
           or (current_event is not null and not exists (select 1 from public.attendance a where a.event_id = current_event and a.user_id = cm.user_id)))
      and (coalesce((cond->>'goingOrMaybe')::boolean, false) = false
           or (current_event is not null and exists (
                 select 1 from public.attendance a
                 where a.event_id = current_event and a.user_id = cm.user_id
                   and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status))))
      and (coalesce((cond->>'notGoing')::boolean, false) = false
           or (current_event is not null and exists (
                 select 1 from public.attendance a
                 where a.event_id = current_event and a.user_id = cm.user_id
                   and a.status = 'not_going'::public.attendance_status)))
  )
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select a.user_id, 'admin_rule', rule.title, rule.body, rule.href,
         jsonb_build_object('ruleId', rule.id, 'ruleKind', rule.kind)
  from audience a
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

-- Admin-initiated send: test goes only to the caller; a real send requires the
-- rule to be active and delegates to enqueue_notification_rule.
create or replace function public.admin_send_notification_rule(rule_id uuid, test_only boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rule public.notification_rules;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can send notifications.';
  end if;

  select * into rule from public.notification_rules where id = rule_id;
  if not found then
    raise exception 'Notification rule not found.';
  end if;

  if test_only then
    insert into public.app_notifications (user_id, kind, title, body, href, payload)
    values (auth.uid(), 'admin_rule', rule.title, rule.body, rule.href,
            jsonb_build_object('ruleId', rule.id, 'ruleKind', rule.kind, 'test', true));
    return 1;
  end if;

  if rule.status <> 'active' then
    raise exception 'Only active rules can be sent.';
  end if;

  return public.enqueue_notification_rule(rule.id);
end;
$$;

-- Auto-send active rules whose scheduled moment (Berlin time) has arrived.
-- One-time rules fire once and deactivate; recurring rules fire at most once per
-- matching day. Per-rule errors are swallowed so a bad schedule never blocks the
-- shared job runner.
create or replace function public.run_due_notification_rules()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rule public.notification_rules;
  sched jsonb;
  now_berlin timestamp;
  due_at timestamp;
  rule_dow int;
begin
  now_berlin := (now() at time zone 'Europe/Berlin');

  for rule in select * from public.notification_rules where status = 'active' loop
    begin
      sched := rule.schedule;

      if coalesce(sched->>'mode', 'once') = 'recurring' then
        if sched->>'weekday' is null then
          continue;
        end if;
        rule_dow := case sched->>'weekday'
          when 'sunday' then 0 when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3
          when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6 else -1 end;
        if rule_dow <> extract(dow from now_berlin)::int then
          continue;
        end if;
        if sched->>'time' is not null and now_berlin::time < (sched->>'time')::time then
          continue;
        end if;
        -- Already fired today?
        if rule.last_sent_at is not null and (rule.last_sent_at at time zone 'Europe/Berlin')::date >= now_berlin::date then
          continue;
        end if;
        perform public.enqueue_notification_rule(rule.id);
      else
        -- One-time: needs a concrete date; fire once, then deactivate.
        if sched->>'date' is null or rule.last_sent_at is not null then
          continue;
        end if;
        due_at := (sched->>'date')::date + coalesce((sched->>'time')::time, '00:00'::time);
        if now_berlin >= due_at then
          perform public.enqueue_notification_rule(rule.id);
          update public.notification_rules set status = 'inactive' where id = rule.id;
        end if;
      end if;
    exception when others then
      -- ignore this rule and continue with the rest
      null;
    end;
  end loop;
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
  perform public.run_due_notification_rules();
end;
$$;

grant execute on function public.run_mcc_notification_jobs() to authenticated;

notify pgrst, 'reload schema';
