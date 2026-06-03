create table if not exists public.direct_chats (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.direct_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.direct_chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists direct_chats_requester_status_idx
on public.direct_chats (requester_id, status, last_message_at desc);

create index if not exists direct_chats_admin_status_idx
on public.direct_chats (admin_id, status, last_message_at desc);

create index if not exists direct_chat_messages_chat_created_idx
on public.direct_chat_messages (chat_id, created_at asc);

alter table public.direct_chats enable row level security;
alter table public.direct_chat_messages enable row level security;

drop policy if exists "Direct chats participants can read" on public.direct_chats;
create policy "Direct chats participants can read"
on public.direct_chats for select
using (
  requester_id = auth.uid()
  or admin_id = auth.uid()
  or public.is_admin_user(auth.uid())
);

drop policy if exists "Members can create direct chats with admins" on public.direct_chats;
create policy "Members can create direct chats with admins"
on public.direct_chats for insert
with check (
  requester_id = auth.uid()
  and public.is_admin_user(admin_id)
);

drop policy if exists "Admins can close direct chats" on public.direct_chats;
create policy "Admins can close direct chats"
on public.direct_chats for update
using (admin_id = auth.uid() or public.is_admin_user(auth.uid()))
with check (admin_id = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists "Direct chat participants can read messages" on public.direct_chat_messages;
create policy "Direct chat participants can read messages"
on public.direct_chat_messages for select
using (
  exists (
    select 1
    from public.direct_chats dc
    where dc.id = chat_id
      and (dc.requester_id = auth.uid() or dc.admin_id = auth.uid() or public.is_admin_user(auth.uid()))
  )
);

drop policy if exists "Direct chat participants can send messages" on public.direct_chat_messages;
create policy "Direct chat participants can send messages"
on public.direct_chat_messages for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.direct_chats dc
    where dc.id = chat_id
      and dc.status = 'open'
      and (dc.requester_id = auth.uid() or dc.admin_id = auth.uid())
  )
);

create or replace function public.touch_direct_chat_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.direct_chats
  set
    updated_at = now(),
    last_message_at = new.created_at
  where id = new.chat_id;

  return new;
end;
$$;

drop trigger if exists touch_direct_chat_after_message on public.direct_chat_messages;
create trigger touch_direct_chat_after_message
after insert on public.direct_chat_messages
for each row execute function public.touch_direct_chat_after_message();

notify pgrst, 'reload schema';
