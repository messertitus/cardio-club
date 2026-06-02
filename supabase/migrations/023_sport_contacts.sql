create table if not exists public.sport_contacts (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text,
  is_primary boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (sport_id, user_id)
);

create unique index if not exists sport_contacts_one_primary_per_sport_idx
on public.sport_contacts (sport_id)
where is_primary;

create index if not exists sport_contacts_user_idx
on public.sport_contacts (user_id);

alter table public.sport_contacts enable row level security;

drop policy if exists "sport contacts visible to authenticated users" on public.sport_contacts;
create policy "sport contacts visible to authenticated users"
on public.sport_contacts for select
to authenticated
using (true);

drop policy if exists "sport contacts managed by admins" on public.sport_contacts;
create policy "sport contacts managed by admins"
on public.sport_contacts for all
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());

create or replace function public.admin_upsert_sport_contact(
  target_sport_id uuid,
  target_user_id uuid,
  contact_note text default null,
  primary_contact boolean default true
)
returns public.sport_contacts
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_contact public.sport_contacts;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  if target_sport_id is null or target_user_id is null then
    raise exception 'sport and user are required';
  end if;

  if primary_contact then
    update public.sport_contacts
    set is_primary = false
    where sport_id = target_sport_id;
  end if;

  insert into public.sport_contacts (sport_id, user_id, note, is_primary, created_by)
  values (target_sport_id, target_user_id, nullif(trim(contact_note), ''), primary_contact, auth.uid())
  on conflict (sport_id, user_id)
  do update set
    note = excluded.note,
    is_primary = excluded.is_primary
  returning * into saved_contact;

  return saved_contact;
end;
$$;

create or replace function public.admin_delete_sport_contact(
  target_sport_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.sport_contacts
  where sport_id = target_sport_id
    and user_id = target_user_id;

  return found;
end;
$$;

insert into public.sport_contacts (sport_id, user_id, is_primary, created_by)
select distinct on (sp.id)
  sp.id,
  sp.created_by,
  true,
  sp.created_by
from public.sports sp
where sp.created_by is not null
on conflict (sport_id, user_id) do nothing;

notify pgrst, 'reload schema';
