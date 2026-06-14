-- Remove an ORPHANED phone signup that blocks re-registration.
--
-- Why this is needed: Supabase's auth.signUp() obfuscates an already-existing
-- phone number — it returns a success-shaped response and sends NO new SMS. So a
-- signup that created an auth.users row but never finished onboarding (no
-- club_members row) leaves the number permanently stuck: every later attempt
-- silently sends nothing (no Twilio entry) and the person cannot proceed.
--
-- This happens whether or not the phone was confirmed: a member can verify the
-- SMS (phone_confirmed_at gets set) but still never complete the invite/profile
-- step, leaving a confirmed-but-membership-less auth user. The guard below is
-- therefore "no club membership" — it deletes orphaned signups in either state
-- and NEVER touches a real member. Deleting the auth user cascades to
-- public.profiles (on delete cascade).
--
-- Run in the Supabase SQL editor. Replace the number with the affected one in
-- E.164 form; matching ignores +, spaces and other formatting.

-- 1) Inspect first (recommended): see what would be removed and whether it is
--    truly orphaned (no club membership).
select
  u.id,
  u.phone,
  u.created_at,
  u.phone_confirmed_at,
  exists (select 1 from public.club_members m where m.user_id = u.id) as has_club_membership
from auth.users u
where regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = regexp_replace('+49 160 2953470', '\D', '', 'g')
order by u.created_at desc;

-- 2) Delete only orphaned signups for that number (no club membership).
delete from auth.users u
where regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = regexp_replace('+49 160 2953470', '\D', '', 'g')
  and not exists (select 1 from public.club_members m where m.user_id = u.id);
