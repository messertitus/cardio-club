create or replace function public.create_invitation_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  is_admin_user boolean := false;
  created_count integer;
  new_code text;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = current_user_id
      and p.role = 'admin'
  ) or exists (
    select 1
    from public.club_members cm
    where cm.user_id = current_user_id
      and cm.role = 'admin'
  )
  into is_admin_user;

  if not is_admin_user then
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
