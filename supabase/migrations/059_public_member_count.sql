-- 059: Public member count for the (logged-out) auth screen.
--
-- The auth screen wants to show the current number of members, but a visitor is
-- not authenticated yet and club_members/profiles are behind RLS. This exposes
-- ONLY an aggregate integer (no names, no PII) via a SECURITY DEFINER function
-- granted to anon, so the count can be shown before login without opening up any
-- row data. Counts distinct active members (deactivated profiles excluded).

create or replace function public.public_member_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct cm.user_id)::int
  from public.club_members cm
  join public.profiles p on p.id = cm.user_id
  where p.deactivated_at is null;
$$;

grant execute on function public.public_member_count() to anon, authenticated;

notify pgrst, 'reload schema';
