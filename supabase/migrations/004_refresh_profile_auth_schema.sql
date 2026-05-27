alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.app_role not null default 'member';

update public.profiles p
set
  email = coalesce(p.email, u.email),
  role = case
    when lower(coalesce(u.email, p.email, '')) = 'messertitus@outlook.com' then 'admin'::public.app_role
    else p.role
  end
from auth.users u
where u.id = p.id;

notify pgrst, 'reload schema';
