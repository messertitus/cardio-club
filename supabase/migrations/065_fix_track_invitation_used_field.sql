-- 065: Fix the invite-usage analytics trigger that broke invite redemption.
--
-- track_invitation_used() (migration 057) referenced new.id, but
-- public.invitation_codes has NO "id" column — its primary key is "code". So
-- every UPDATE of used_by on invitation_codes (exactly what
-- consume_invitation_code does) fired this trigger, hit "record \"new\" has no
-- field \"id\"" (SQLSTATE 42703), and aborted the update. Result: invite
-- redemption failed for everyone since 057 was applied (~2026-06-13) with
-- "Einladungscode konnte nicht eingelöst werden", even with a valid, free code
-- and an authenticated session.
--
-- Fix: reference new.code (the real identifier) instead of new.id.

create or replace function public.track_invitation_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.used_by is null and new.used_by is not null then
    perform public._record_metric_for(new.created_by, 'invite.used', 1, 'invite.used',
      jsonb_build_object('codeId', new.code));
  end if;
  return new;
end;
$$;
