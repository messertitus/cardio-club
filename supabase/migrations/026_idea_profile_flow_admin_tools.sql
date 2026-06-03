alter table public.sport_profiles
  add column if not exists map_url text,
  add column if not exists postal_code text,
  add column if not exists location_city text;

alter table public.sport_ideas
  add column if not exists sport_id uuid references public.sports (id) on delete set null,
  add column if not exists profile_name text,
  add column if not exists location_mode text not null default 'fixed' check (location_mode in ('fixed', 'flexible')),
  add column if not exists postal_code text,
  add column if not exists location_city text,
  add column if not exists map_url text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_type public.sport_location_type,
  add column if not exists minimum_group_size integer,
  add column if not exists maximum_group_size integer,
  add column if not exists required_equipment text[] not null default '{}',
  add column if not exists available_equipment text[] not null default '{}',
  add column if not exists cost_note text,
  add column if not exists opening_notes text,
  add column if not exists transit_notes text,
  add column if not exists amenity_notes text,
  add column if not exists reservation_required boolean,
  add column if not exists lighting_available boolean,
  add column if not exists safety_notes text,
  add column if not exists location_rules text,
  add column if not exists ap_required boolean not null default false,
  add column if not exists weather_rules jsonb not null default '{}'::jsonb,
  add column if not exists is_draft boolean not null default false,
  add column if not exists draft_step text not null default 'location',
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.sport_ideas
  alter column name drop not null;

alter table public.sport_ideas
  drop constraint if exists sport_ideas_name_check;

alter table public.sport_ideas
  add constraint sport_ideas_name_required_when_submitted
  check (
    is_draft
    or (name is not null and char_length(trim(name)) between 2 and 80)
  );

create index if not exists sport_ideas_suggested_draft_idx
on public.sport_ideas (suggested_by, is_draft, created_at desc);

create index if not exists sport_ideas_location_city_idx
on public.sport_ideas (location_city);

create index if not exists sport_profiles_location_city_idx
on public.sport_profiles (location_city);

drop policy if exists "members can update own sport idea drafts" on public.sport_ideas;
create policy "members can update own sport idea drafts"
on public.sport_ideas for update
to authenticated
using (suggested_by = auth.uid() and is_draft = true)
with check (suggested_by = auth.uid());

create or replace function public.admin_update_profile_display_name(
  target_user_id uuid,
  next_display_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_profile public.profiles;
begin
  if not public.is_current_mcc_admin() then
    raise exception 'admin only';
  end if;

  if target_user_id is null or nullif(trim(next_display_name), '') is null or char_length(trim(next_display_name)) < 2 then
    raise exception 'display name must have at least 2 characters';
  end if;

  update public.profiles
  set display_name = trim(next_display_name)
  where id = target_user_id
  returning * into saved_profile;

  if saved_profile.id is null then
    raise exception 'profile not found';
  end if;

  return saved_profile;
end;
$$;

notify pgrst, 'reload schema';
