-- Make admin_upsert_sport idempotent on the sport name.
--
-- Previously, calling admin_upsert_sport with a null target_sport_id always ran
-- a plain INSERT. When an abstract sport with that name already existed (e.g. an
-- inactive one, or one without an active profile so it never appears in the
-- pickers), this hit the unique constraint "sports_name_key" and the admin saw
-- "duplicate key value violates unique constraint sports_name_key" when approving
-- a sport idea that requested a "new" sport that actually already exists.
--
-- Now, when no target id is given we first look for an existing sport with the
-- same (case-insensitive, trimmed) name and update/reactivate it instead of
-- inserting a duplicate.

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
  resolved_sport_id uuid := target_sport_id;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'not authorized';
  end if;

  if nullif(trim(sport_name), '') is null then
    raise exception 'sport name is required';
  end if;

  -- When no explicit target is given, reuse an existing sport with the same name
  -- (case-insensitive) rather than inserting a duplicate.
  if resolved_sport_id is null then
    select id into resolved_sport_id
    from public.sports
    where lower(name) = lower(trim(sport_name))
    limit 1;
  end if;

  if resolved_sport_id is null then
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
    where id = resolved_sport_id
    returning * into saved_sport;
  end if;

  if saved_sport.id is null then
    raise exception 'sport not found';
  end if;

  return saved_sport;
end;
$$;
