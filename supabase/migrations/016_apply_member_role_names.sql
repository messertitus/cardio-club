update public.club_members
set role = 'mod'::public.club_member_role
where role = 'admin';

update public.club_members
set role = 'admin'::public.club_member_role
where role = 'owner';

create or replace function public.is_club_admin(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
      and cm.role in ('admin'::public.club_member_role, 'mod'::public.club_member_role)
  );
$$;

update public.profiles
set role = 'admin'::public.app_role,
    display_name = case when display_name in ('Cardio-Mitglied', 'Mitglied', 'Messertitus') then 'Titus' else display_name end
where phone = '+4917085627727';

update public.club_members cm
set role = 'admin'::public.club_member_role
from public.profiles p
where p.id = cm.user_id
  and p.phone = '+4917085627727';
