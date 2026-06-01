alter table public.profiles
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivated_reason text;

create index if not exists profiles_deactivated_at_idx
on public.profiles (deactivated_at);

create or replace function public.is_current_mcc_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.app_role
  )
  or exists (
    select 1
    from public.club_members cm
    where cm.user_id = auth.uid()
      and cm.role = 'admin'::public.club_member_role
  );
$$;

create or replace function public.deactivate_club_member(
  target_user_id uuid,
  reason text default 'Von Admin deaktiviert'
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

  if target_user_id = auth.uid() then
    raise exception 'Admins cannot deactivate themselves';
  end if;

  update public.profiles
  set
    deactivated_at = now(),
    deactivated_reason = coalesce(nullif(reason, ''), 'Von Admin deaktiviert')
  where id = target_user_id;

  return found;
end;
$$;

create or replace function public.admin_upsert_sport(
  target_sport_id uuid,
  sport_name text,
  sport_category text,
  sport_intensity public.sport_intensity_level,
  sport_location_type public.sport_location_type,
  sport_tags text[] default '{}'::text[]
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
    insert into public.sports (name, category, intensity_level, location_type, combinable_tags, created_by)
    values (
      trim(sport_name),
      coalesce(nullif(trim(sport_category), ''), 'cardio'),
      sport_intensity,
      sport_location_type,
      coalesce(sport_tags, '{}'::text[]),
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
      combinable_tags = coalesce(sport_tags, combinable_tags)
    where id = target_sport_id
    returning * into saved_sport;
  end if;

  if saved_sport.id is null then
    raise exception 'sport not found';
  end if;

  return saved_sport;
end;
$$;

create or replace function public.admin_delete_sport(target_sport_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  delete from public.sports
  where id = target_sport_id;

  return found;
end;
$$;

notify pgrst, 'reload schema';
