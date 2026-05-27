create extension if not exists pgcrypto with schema extensions;

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
    new_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (
      select 1
      from public.invitation_codes
      where code = new_code
    );
  end loop;

  insert into public.invitation_codes (code, created_by)
  values (new_code, current_user_id);

  return new_code;
end;
$$;

notify pgrst, 'reload schema';
