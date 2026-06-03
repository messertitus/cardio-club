do $$
begin
  create type public.event_decision_type as enum ('single', 'multi_sport', 'twin', 'none');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.event_activity_role as enum ('primary', 'secondary');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.actual_attendance_status as enum ('present', 'absent', 'excused', 'unknown');
exception
  when duplicate_object then null;
end $$;

alter table public.weekly_events
  add column if not exists decision_type public.event_decision_type,
  add column if not exists decision_scorecard jsonb,
  add column if not exists weather_snapshot jsonb;

create table if not exists public.sport_profiles (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  location_name text,
  latitude double precision,
  longitude double precision,
  venue_group_key text,
  location_type public.sport_location_type not null default 'flexible',
  is_indoor boolean not null default false,
  minimum_group_size integer not null default 1 check (minimum_group_size >= 1),
  maximum_group_size integer check (maximum_group_size is null or maximum_group_size >= minimum_group_size),
  required_equipment text[] not null default '{}',
  available_equipment text[] not null default '{}',
  cost_note text,
  opening_notes text,
  lighting_available boolean,
  transit_notes text,
  amenity_notes text,
  reservation_required boolean,
  safety_notes text,
  ap_required boolean not null default false,
  weather_rules jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sport_profiles_sport_active_idx
on public.sport_profiles (sport_id, is_active);

create index if not exists sport_profiles_venue_idx
on public.sport_profiles (venue_group_key);

create table if not exists public.sport_no_gos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (event_id, sport_id, user_id),
  foreign key (event_id, sport_id) references public.sport_proposals (event_id, sport_id) on delete cascade
);

create index if not exists sport_no_gos_event_sport_idx
on public.sport_no_gos (event_id, sport_id);

create table if not exists public.event_activities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  sport_profile_id uuid references public.sport_profiles (id) on delete set null,
  role public.event_activity_role not null,
  activity_type public.event_decision_type not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  location text,
  starts_at timestamptz,
  activity_contact_id uuid references public.profiles (id) on delete set null,
  assigned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists event_activities_event_idx
on public.event_activities (event_id, role);

alter table public.attendance
  add column if not exists actual_status public.actual_attendance_status,
  add column if not exists checked_by uuid references public.profiles (id) on delete set null,
  add column if not exists checked_at timestamptz;

alter table public.member_preference_history
  add column if not exists vote_rank integer,
  add column if not exists covered_by_decision boolean not null default false,
  add column if not exists covered_by_activity_type public.event_decision_type;

create or replace function public.enforce_sport_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_vote_count integer;
begin
  if not public.weekly_event_is_open_for_voting(new.event_id) then
    raise exception 'Voting is closed for finalized events.';
  end if;

  if not exists (
    select 1
    from public.attendance a
    where a.event_id = new.event_id
      and a.user_id = new.user_id
      and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
  ) then
    raise exception 'Attendance status must be going or maybe before voting.';
  end if;

  select count(*)
  into existing_vote_count
  from public.sport_votes sv
  where sv.event_id = new.event_id
    and sv.user_id = new.user_id
    and (tg_op = 'INSERT' or sv.id <> new.id);

  if existing_vote_count >= 3 then
    raise exception 'A member can vote for at most three sports per event.';
  end if;

  new.weight := case new.vote_rank
    when 1 then 1.0
    when 2 then 0.6
    when 3 then 0.3
  end;

  return new;
end;
$$;

create or replace function public.event_attendance_can_be_reviewed(
  target_event_id uuid,
  reviewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select reviewer_id = auth.uid()
    and exists (
      select 1
      from public.attendance reviewer_attendance
      where reviewer_attendance.event_id = target_event_id
        and reviewer_attendance.user_id = reviewer_id
        and reviewer_attendance.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
    )
    and (
      public.is_current_mcc_admin()
      or public.is_club_admin(public.event_club_id(target_event_id))
      or exists (
        select 1
        from public.weekly_events we
        where we.id = target_event_id
          and we.activity_contact_id = reviewer_id
      )
      or exists (
        select 1
        from public.event_activities ea
        where ea.event_id = target_event_id
          and ea.activity_contact_id = reviewer_id
      )
    );
$$;

create or replace function public.review_event_attendance(
  target_event_id uuid,
  target_user_id uuid,
  next_actual_status public.actual_attendance_status
)
returns public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_attendance public.attendance;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.event_attendance_can_be_reviewed(target_event_id, auth.uid()) then
    raise exception 'not authorized to review attendance for this event';
  end if;

  update public.attendance
  set
    actual_status = next_actual_status,
    checked_by = auth.uid(),
    checked_at = now()
  where event_id = target_event_id
    and user_id = target_user_id
  returning * into saved_attendance;

  if saved_attendance.id is null then
    raise exception 'attendance row not found';
  end if;

  return saved_attendance;
end;
$$;

create or replace function public.enforce_attendance_review_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.actual_status is distinct from old.actual_status)
    or (new.checked_by is distinct from old.checked_by)
    or (new.checked_at is distinct from old.checked_at) then
    if not public.event_attendance_can_be_reviewed(new.event_id, auth.uid()) then
      raise exception 'not authorized to change attendance review fields';
    end if;

    new.checked_by := auth.uid();
    new.checked_at := coalesce(new.checked_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_attendance_review_rules_trigger on public.attendance;
create trigger enforce_attendance_review_rules_trigger
before update on public.attendance
for each row execute function public.enforce_attendance_review_rules();

update public.member_preference_history
set covered_by_decision = was_selected
where covered_by_decision = false
  and was_selected = true;

alter table public.sport_profiles enable row level security;
alter table public.sport_no_gos enable row level security;
alter table public.event_activities enable row level security;

drop policy if exists "sport profiles visible to authenticated users" on public.sport_profiles;
create policy "sport profiles visible to authenticated users"
on public.sport_profiles for select
to authenticated
using (true);

drop policy if exists "sport profiles managed by admins" on public.sport_profiles;
create policy "sport profiles managed by admins"
on public.sport_profiles for all
to authenticated
using (public.is_current_mcc_admin())
with check (public.is_current_mcc_admin());

drop policy if exists "sport no-gos visible to event club members" on public.sport_no_gos;
create policy "sport no-gos visible to event club members"
on public.sport_no_gos for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "sport no-gos managed by owner while voting" on public.sport_no_gos;
create policy "sport no-gos managed by owner while voting"
on public.sport_no_gos for all
to authenticated
using (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
  and public.weekly_event_is_open_for_voting(event_id)
  and exists (
    select 1
    from public.attendance a
    where a.event_id = public.sport_no_gos.event_id
      and a.user_id = auth.uid()
      and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
  )
)
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
  and public.weekly_event_is_open_for_voting(event_id)
  and exists (
    select 1
    from public.attendance a
    where a.event_id = public.sport_no_gos.event_id
      and a.user_id = auth.uid()
      and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
  )
);

drop policy if exists "event activities visible to event club members" on public.event_activities;
create policy "event activities visible to event club members"
on public.event_activities for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "event activities managed by club admins" on public.event_activities;
create policy "event activities managed by club admins"
on public.event_activities for all
to authenticated
using (public.is_club_admin(public.event_club_id(event_id)) or public.is_current_mcc_admin())
with check (public.is_club_admin(public.event_club_id(event_id)) or public.is_current_mcc_admin());

drop policy if exists "preference history can be inserted by club admins" on public.member_preference_history;
create policy "preference history can be inserted by club admins"
on public.member_preference_history for insert
to authenticated
with check (public.is_club_admin(club_id) or public.is_current_mcc_admin());

insert into public.sport_profiles (
  sport_id,
  name,
  location_name,
  latitude,
  longitude,
  venue_group_key,
  location_type,
  is_indoor,
  minimum_group_size,
  maximum_group_size,
  required_equipment,
  available_equipment,
  lighting_available,
  transit_notes,
  amenity_notes,
  reservation_required,
  ap_required,
  weather_rules
)
select
  s.id,
  s.name || ' · Seepark',
  'Seepark Freiburg',
  48.0104,
  7.8259,
  'seepark-freiburg',
  s.location_type,
  s.location_type = 'indoor',
  case
    when s.name = 'Fußball' then 6
    when s.name = 'Beachvolleyball' then 4
    else 1
  end,
  case
    when s.name = 'Beachvolleyball' then 12
    when s.name = 'Fußball' then 22
    else null
  end,
  '{}'::text[],
  '{}'::text[],
  true,
  'ÖPNV und Parken je nach Treffpunkt prüfen.',
  'Wasser/Toiletten vor Ort prüfen.',
  false,
  false,
  jsonb_build_object(
    'rainSensitive', s.location_type <> 'indoor',
    'windSensitive', s.name in ('Beachvolleyball', 'Radfahren', 'Rudern'),
    'thunderstormUnsafe', s.location_type <> 'indoor'
  )
from public.sports s
where not exists (
  select 1
  from public.sport_profiles sp
  where sp.sport_id = s.id
);

notify pgrst, 'reload schema';
