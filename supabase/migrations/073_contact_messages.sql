-- 073_contact_messages.sql
--
-- Public contact form for the landing page (/kontakt). Like the waitlist:
-- anonymous visitors may only INSERT via a SECURITY DEFINER RPC (basic
-- validation, no read-back); reading is restricted to club admins.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null check (char_length(trim(email)) between 3 and 160),
  message text not null check (char_length(trim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "contact readable by admins" on public.contact_messages;
create policy "contact readable by admins"
on public.contact_messages for select
using (exists (
  select 1 from public.club_members cm
  where cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
));

drop policy if exists "contact managed by admins" on public.contact_messages;
create policy "contact managed by admins"
on public.contact_messages for update
using (exists (
  select 1 from public.club_members cm
  where cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
));

create or replace function public.submit_contact(
  p_name text,
  p_email text,
  p_message text
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
  if position('@' in coalesce(p_email, '')) = 0 or char_length(trim(coalesce(p_email, ''))) < 3 then
    raise exception 'valid email required';
  end if;
  if char_length(trim(coalesce(p_message, ''))) < 1 then
    raise exception 'message required';
  end if;
  insert into public.contact_messages (name, email, message)
  values (
    left(trim(p_name), 120),
    left(trim(p_email), 160),
    left(trim(p_message), 4000)
  );
end;
$$;

comment on function public.submit_contact(text, text, text) is
  'Public contact form for the landing page. Name + email + message, basic validation, no read-back.';

grant execute on function public.submit_contact(text, text, text) to anon, authenticated;
