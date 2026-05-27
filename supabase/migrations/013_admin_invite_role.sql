alter table public.invitation_codes
  add column if not exists grants_role public.app_role not null default 'member';

create or replace function public.consume_invitation_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(input_code));
  matched_code text;
  matched_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select ic.code, ic.grants_role
  into matched_code, matched_role
  from public.invitation_codes ic
  where upper(ic.code) = normalized_code
    and ic.used_by is null
    and (ic.expires_at is null or ic.expires_at > now())
  for update;

  if matched_code is null then
    return false;
  end if;

  update public.invitation_codes
  set used_by = auth.uid(), used_at = now()
  where code = matched_code;

  update public.profiles
  set role = matched_role
  where id = auth.uid()
    and matched_role = 'admin';

  return true;
end;
$$;

create or replace function public.create_invitation_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  current_role public.app_role;
  created_count integer;
  new_code text;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select role
  into current_role
  from public.profiles
  where id = current_user_id;

  if current_role is distinct from 'admin' then
    select count(*)
    into created_count
    from public.invitation_codes
    where created_by = current_user_id;

    if created_count >= 3 then
      raise exception 'invite limit reached';
    end if;
  end if;

  loop
    new_code := lpad((floor(random() * 1000000000000)::bigint)::text, 12, '0');
    exit when not exists (
      select 1
      from public.invitation_codes
      where code = new_code
    );
  end loop;

  insert into public.invitation_codes (code, created_by, grants_role)
  values (new_code, current_user_id, 'member');

  return new_code;
end;
$$;

notify pgrst, 'reload schema';
