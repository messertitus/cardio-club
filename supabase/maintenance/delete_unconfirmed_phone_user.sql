-- Remove a stale, UNCONFIRMED phone signup that blocks re-registration.
--
-- Why this is needed: Supabase's auth.signUp() obfuscates an already-existing
-- phone number — it returns a success-shaped response with an empty identities
-- array and sends NO new SMS. So if a member starts signing up (which creates an
-- auth.users row and sends the first SMS) but never verifies, every later attempt
-- silently sends nothing (no Twilio entry) and they can never get a new code.
-- They also cannot log in or reset their PIN, because the phone was never
-- confirmed. The fix is to delete that half-finished, unconfirmed auth user so a
-- clean signUp can send a fresh code.
--
-- Run this in the Supabase SQL editor. Replace the number with the affected one
-- in E.164 form. Matching ignores formatting (+, spaces) and only ever deletes a
-- user whose phone was NEVER confirmed — fully registered members are untouched.
-- Deleting the auth user cascades to public.profiles (on delete cascade).

-- 1) Inspect first (recommended): see what would be removed.
select id, phone, phone_confirmed_at, created_at
from auth.users
where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace('+49 160 2953470', '\D', '', 'g')
order by created_at desc;

-- 2) Delete only the unconfirmed signup for that number.
delete from auth.users
where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = regexp_replace('+49 160 2953470', '\D', '', 'g')
  and phone_confirmed_at is null;
