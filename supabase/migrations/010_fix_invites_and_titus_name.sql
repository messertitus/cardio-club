update public.profiles
set display_name = 'Titus'
where lower(coalesce(email, '')) = 'messertitus@outlook.com'
  and (
    display_name in ('Messertitus', 'Mitglied', 'Cardio-Mitglied')
    or lower(display_name) = 'messertitus'
  );

create or replace function public.create_invitation_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  created_count integer;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  insert into public.profiles (id, display_name, email, role)
  select
    auth.uid(),
    coalesce(p.display_name, 'Mitglied'),
    u.email,
    case when lower(u.email) = 'messertitus@outlook.com' then 'admin'::public.app_role else coalesce(p.role, 'member'::public.app_role) end
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = auth.uid()
  on conflict (id) do update
  set
    email = excluded.email,
    role = case when lower(excluded.email) = 'messertitus@outlook.com' then 'admin'::public.app_role else public.profiles.role end;

  if not public.is_admin_user(auth.uid()) then
    select count(*)
    into created_count
    from public.invitation_codes ic
    where ic.created_by = auth.uid();

    if created_count >= 3 then
      raise exception 'Invite limit reached.';
    end if;
  end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    begin
      insert into public.invitation_codes (code, created_by)
      values (new_code, auth.uid());
      return new_code;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
