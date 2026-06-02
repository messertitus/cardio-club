alter table public.sports
  add column if not exists description text,
  add column if not exists location_description text;

drop function if exists public.admin_upsert_sport(
  uuid,
  text,
  text,
  public.sport_intensity_level,
  public.sport_location_type,
  text[]
);

create or replace function public.admin_upsert_sport(
  target_sport_id uuid,
  sport_name text,
  sport_category text,
  sport_intensity public.sport_intensity_level,
  sport_location_type public.sport_location_type,
  sport_tags text[] default '{}'::text[],
  sport_description text default null,
  sport_location_description text default null
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
    insert into public.sports (
      name,
      category,
      intensity_level,
      location_type,
      combinable_tags,
      description,
      location_description,
      created_by
    )
    values (
      trim(sport_name),
      coalesce(nullif(trim(sport_category), ''), 'cardio'),
      sport_intensity,
      sport_location_type,
      coalesce(sport_tags, '{}'::text[]),
      nullif(trim(coalesce(sport_description, '')), ''),
      nullif(trim(coalesce(sport_location_description, '')), ''),
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
      location_description = nullif(trim(coalesce(sport_location_description, '')), '')
    where id = target_sport_id
    returning * into saved_sport;
  end if;

  if saved_sport.id is null then
    raise exception 'sport not found';
  end if;

  return saved_sport;
end;
$$;

notify pgrst, 'reload schema';
