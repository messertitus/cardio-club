-- 064: Make consume_invitation_code idempotent for the same user.
--
-- Symptom: invite validates fine at the start, but after the SMS step the app
-- reports "Einladungscode konnte nicht eingelöst werden". Root cause: the code is
-- consumed during finishAuthenticatedFlow, and if that runs more than once in the
-- same registration (e.g. a second invocation, or a retry by the same just-created
-- user), the first call sets used_by and the second sees used_by != null and
-- returns false — failing a registration whose code was actually used by the very
-- same user.
--
-- Fix: if the code is already used by the CURRENT user, treat it as success
-- (idempotent) and re-apply the admin role if granted. A code used by SOMEONE
-- ELSE still cannot be consumed.

create or replace function public.consume_invitation_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(input_code));
  matched public.invitation_codes;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select * into matched
  from public.invitation_codes ic
  where upper(ic.code) = normalized_code
  for update;

  if not found then
    return false;
  end if;

  -- Expired codes can never be used.
  if matched.expires_at is not null and matched.expires_at <= now() then
    return false;
  end if;

  -- Already consumed by THIS user → idempotent success.
  if matched.used_by = auth.uid() then
    if matched.grants_role = 'admin' then
      update public.profiles set role = 'admin' where id = auth.uid();
    end if;
    return true;
  end if;

  -- Consumed by someone else → cannot be reused.
  if matched.used_by is not null then
    return false;
  end if;

  -- Free → consume it now.
  update public.invitation_codes
  set used_by = auth.uid(), used_at = now()
  where code = matched.code;

  if matched.grants_role = 'admin' then
    update public.profiles set role = 'admin' where id = auth.uid();
  end if;

  return true;
end;
$$;

notify pgrst, 'reload schema';
