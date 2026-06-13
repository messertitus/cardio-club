-- 054: Only create notifications for users who can actually receive a push.
--
-- app_notifications exist solely to be delivered as Web Push (and shown by the
-- in-app bridge, which also needs notification permission). For members without
-- a push subscription they are pure noise that piled up as "pending"/"delivered".
--
-- Instead of rewriting every enqueue function (vote/decision/invite/chat/event/
-- admin-rule, defined across many migrations), a single BEFORE INSERT trigger
-- gates the table: a row is only kept when the recipient has a push subscription.
-- This covers all current and future enqueue paths from one place. Admin "test"
-- sends (payload.test = true) are exempt so an admin can always preview.

create or replace function public.skip_notification_without_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Always allow explicit admin test sends through.
  if coalesce(new.payload->>'test', '') = 'true' then
    return new;
  end if;
  -- Otherwise only keep notifications for members with a push subscription.
  if exists (select 1 from public.push_subscriptions ps where ps.user_id = new.user_id) then
    return new;
  end if;
  return null; -- silently skip: no PWA/push for this user
end;
$$;

drop trigger if exists app_notifications_require_push on public.app_notifications;
create trigger app_notifications_require_push
before insert on public.app_notifications
for each row execute function public.skip_notification_without_push();

-- Re-initialize: clear the backlog that was created for members without a push
-- subscription (both pending and already "delivered"). Notifications for actual
-- push users are kept, so their dedup history stays intact and nothing re-fires.
delete from public.app_notifications a
where not exists (select 1 from public.push_subscriptions ps where ps.user_id = a.user_id);

notify pgrst, 'reload schema';
