alter table public.sports
add column if not exists is_active boolean not null default true;

create table if not exists public.sport_profile_sports (
  profile_id uuid not null references public.sport_profiles (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, sport_id)
);

insert into public.sport_profile_sports (profile_id, sport_id)
select id, sport_id
from public.sport_profiles
on conflict (profile_id, sport_id) do nothing;

create index if not exists sport_profile_sports_sport_idx
on public.sport_profile_sports (sport_id, profile_id);

alter table public.sport_profile_sports enable row level security;

drop policy if exists "sport profile links visible to authenticated users" on public.sport_profile_sports;
create policy "sport profile links visible to authenticated users"
on public.sport_profile_sports for select
to authenticated
using (true);

drop policy if exists "sport profile links managed by admins" on public.sport_profile_sports;
create policy "sport profile links managed by admins"
on public.sport_profile_sports for all
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());

create or replace function public.admin_upsert_sport(
  target_sport_id uuid,
  sport_name text,
  sport_category text,
  sport_intensity public.sport_intensity_level,
  sport_location_type public.sport_location_type,
  sport_tags text[] default '{}'::text[],
  sport_description text default null,
  sport_location_description text default null,
  sport_is_active boolean default true
)
returns public.sports
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_sport public.sports;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  if nullif(trim(sport_name), '') is null then
    raise exception 'sport name is required';
  end if;

  if target_sport_id is null then
    insert into public.sports (name, category, intensity_level, location_type, combinable_tags, description, location_description, is_active, created_by)
    values (
      trim(sport_name),
      coalesce(nullif(trim(sport_category), ''), 'unknown'),
      sport_intensity,
      sport_location_type,
      coalesce(sport_tags, '{}'::text[]),
      nullif(trim(coalesce(sport_description, '')), ''),
      nullif(trim(coalesce(sport_location_description, '')), ''),
      coalesce(sport_is_active, true),
      auth.uid()
    )
    returning * into saved_sport;
  else
    update public.sports
    set
      name = trim(sport_name),
      category = coalesce(nullif(trim(sport_category), ''), category),
      intensity_level = sport_intensity,
      location_type = sport_location_type,
      combinable_tags = coalesce(sport_tags, combinable_tags),
      description = nullif(trim(coalesce(sport_description, '')), ''),
      location_description = nullif(trim(coalesce(sport_location_description, '')), ''),
      is_active = coalesce(sport_is_active, is_active)
    where id = target_sport_id
    returning * into saved_sport;
  end if;

  if saved_sport.id is null then
    raise exception 'sport not found';
  end if;

  return saved_sport;
end;
$$;
