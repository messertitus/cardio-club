-- 071_waitlist.sql
--
-- Public pre-access waitlist: motivated visitors can request an invitation code
-- by leaving their name + phone number on the landing page. Classic flow —
-- entries land here, an admin reviews them and sends out codes.
--
-- Anonymous visitors get NO direct table access; they may only insert through
-- the SECURITY DEFINER RPC below (basic validation, no read-back). Reading the
-- waitlist is restricted to club admins / service role.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  phone text not null check (char_length(trim(phone)) between 4 and 40),
  note text,
  status text not null default 'new' check (status in ('new', 'invited', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Admins (any club admin) may read and manage the waitlist.
drop policy if exists "waitlist readable by admins" on public.waitlist;
create policy "waitlist readable by admins"
on public.waitlist for select
using (exists (
  select 1 from public.club_members cm
  where cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
));

drop policy if exists "waitlist managed by admins" on public.waitlist;
create policy "waitlist managed by admins"
on public.waitlist for update
using (exists (
  select 1 from public.club_members cm
  where cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
));

-- Anonymous submission path. No direct insert grant on the table.
create or replace function public.request_invite(
  p_name text,
  p_phone text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(coalesce(p_name, ''))) < 1 then
    raise exception 'name required';
  end if;
  if char_length(trim(coalesce(p_phone, ''))) < 4 then
    raise exception 'phone required';
  end if;
  insert into public.waitlist (name, phone, note)
  values (left(trim(p_name), 120), left(trim(p_phone), 40), nullif(left(trim(coalesce(p_note, '')), 500), ''));
end;
$$;

comment on function public.request_invite(text, text, text) is
  'Public waitlist signup for the landing page. Name + phone, basic validation, no read-back.';

grant execute on function public.request_invite(text, text, text) to anon, authenticated;
