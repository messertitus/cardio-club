alter table public.profiles
  add column if not exists favorite_sports text;

create table if not exists public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists profile_change_requests_user_status_idx
on public.profile_change_requests (user_id, status);

alter table public.profile_change_requests enable row level security;

drop policy if exists "profile change requests are visible to owner and admins" on public.profile_change_requests;
create policy "profile change requests are visible to owner and admins"
on public.profile_change_requests for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_current_mcc_admin()
);

drop policy if exists "profile change requests can be created by owner" on public.profile_change_requests;
create policy "profile change requests can be created by owner"
on public.profile_change_requests for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.review_profile_name_change(
  request_id uuid,
  next_status text
)
returns public.profile_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_request public.profile_change_requests;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  if next_status not in ('approved', 'rejected') then
    raise exception 'invalid status';
  end if;

  update public.profile_change_requests
  set
    status = next_status,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = request_id
    and status = 'pending'
  returning * into saved_request;

  if saved_request.id is null then
    raise exception 'request not found';
  end if;

  if next_status = 'approved' then
    update public.profiles
    set display_name = saved_request.requested_display_name
    where id = saved_request.user_id;
  end if;

  return saved_request;
end;
$$;

notify pgrst, 'reload schema';
