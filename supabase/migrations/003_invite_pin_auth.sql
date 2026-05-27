do $$
begin
  create type public.app_role as enum ('admin', 'member');
exception
  when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.app_role not null default 'member';

update public.profiles
set role = 'admin'
where lower(coalesce(email, '')) = 'messertitus@outlook.com';

create table if not exists public.invitation_codes (
  code text primary key check (char_length(code) between 8 and 16),
  created_by uuid references public.profiles (id) on delete set null,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz,
  check ((used_by is null and used_at is null) or (used_by is not null and used_at is not null))
);

create index if not exists invitation_codes_created_by_idx on public.invitation_codes (created_by);
create index if not exists invitation_codes_used_by_idx on public.invitation_codes (used_by);

create or replace function public.is_admin_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Cardio-Mitglied'),
    new.email,
    case when lower(new.email) = 'messertitus@outlook.com' then 'admin'::public.app_role else 'member'::public.app_role end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case when lower(excluded.email) = 'messertitus@outlook.com' then 'admin'::public.app_role else public.profiles.role end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.validate_invitation_code(input_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invitation_codes ic
    where upper(ic.code) = upper(trim(input_code))
      and ic.used_by is null
      and (ic.expires_at is null or ic.expires_at > now())
  );
$$;

create or replace function public.consume_invitation_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(input_code));
  matched_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  select ic.code
  into matched_code
  from public.invitation_codes ic
  where upper(ic.code) = normalized_code
    and ic.used_by is null
    and (ic.expires_at is null or ic.expires_at > now())
  for update;

  if matched_code is null then
    return false;
  end if;

  update public.invitation_codes
  set used_by = auth.uid(), used_at = now()
  where code = matched_code;

  return true;
end;
$$;

create or replace function public.create_invitation_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  created_count integer;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  if not public.is_admin_user(auth.uid()) then
    select count(*)
    into created_count
    from public.invitation_codes ic
    where ic.created_by = auth.uid();

    if created_count >= 3 then
      raise exception 'Invite limit reached.';
    end if;
  end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    begin
      insert into public.invitation_codes (code, created_by)
      values (new_code, auth.uid());
      return new_code;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

alter table public.invitation_codes enable row level security;

drop policy if exists "invitation codes can be read by creator or admin" on public.invitation_codes;
create policy "invitation codes can be read by creator or admin"
on public.invitation_codes for select
to authenticated
using (created_by = auth.uid() or public.is_admin_user(auth.uid()));

drop policy if exists "profiles can be updated by owner" on public.profiles;
create policy "profiles can be updated by owner"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
);
