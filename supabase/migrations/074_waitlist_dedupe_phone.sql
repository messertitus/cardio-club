-- 074_waitlist_dedupe_phone.sql
--
-- Light bot/abuse protection for the public waitlist: the same phone number can
-- no longer create duplicate entries. request_invite now silently no-ops if the
-- number is already on the list (no info leak about who is on it).

create or replace function public.request_invite(
  p_name text,
  p_phone text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := left(trim(coalesce(p_phone, '')), 40);
begin
  if char_length(trim(coalesce(p_name, ''))) < 1 then
    raise exception 'name required';
  end if;
  if char_length(v_phone) < 4 then
    raise exception 'phone required';
  end if;

  -- already on the list? do nothing (idempotent, no duplicate, no leak)
  if exists (select 1 from public.waitlist where phone = v_phone) then
    return;
  end if;

  insert into public.waitlist (name, phone, note)
  values (left(trim(p_name), 120), v_phone, nullif(left(trim(coalesce(p_note, '')), 500), ''));
end;
$$;

grant execute on function public.request_invite(text, text, text) to anon, authenticated;
