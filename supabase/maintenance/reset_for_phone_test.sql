-- Run this manually in the Supabase SQL editor after migrations 012 and 013.
-- It removes existing users, memberships, invitations, events, chat, votes,
-- attendance, and sport ideas, then creates one single-use admin invite PIN.

begin;

delete from public.clubs;
delete from public.sport_ideas;
delete from public.invitation_codes;
delete from auth.users;

with admin_code as (
  select lpad((floor(random() * 1000000000000)::bigint)::text, 12, '0') as code
)
insert into public.invitation_codes (code, created_by, grants_role)
select code, null, 'admin'
from admin_code
returning code as admin_invite_pin;

commit;
