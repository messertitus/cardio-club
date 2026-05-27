create extension if not exists pgcrypto;

do $$
begin
  create type public.club_member_role as enum ('owner', 'admin', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sport_intensity_level as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sport_location_type as enum ('indoor', 'outdoor', 'water', 'field', 'flexible');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.weekly_event_status as enum ('proposing', 'voting', 'decided', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attendance_status as enum ('going', 'maybe', 'not_going');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  category text not null check (char_length(trim(category)) between 1 and 80),
  intensity_level public.sport_intensity_level not null,
  location_type public.sport_location_type not null,
  combinable_tags text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  week_start_date date not null,
  selected_sport_id uuid references public.sports (id) on delete set null,
  secondary_sport_id uuid references public.sports (id) on delete set null,
  status public.weekly_event_status not null default 'proposing',
  location text,
  starts_at timestamptz,
  notes text,
  decision_reason text,
  created_at timestamptz not null default now(),
  unique (club_id, week_start_date),
  check (secondary_sport_id is null or secondary_sport_id is distinct from selected_sport_id)
);

create table if not exists public.sport_proposals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (event_id, sport_id),
  unique (event_id, sport_id, proposed_by)
);

create table if not exists public.sport_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  weight integer not null default 1 check (weight between 1 and 5),
  created_at timestamptz not null default now(),
  unique (event_id, sport_id, user_id),
  foreign key (event_id, sport_id) references public.sport_proposals (event_id, sport_id) on delete cascade
);

create table if not exists public.event_subgroups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  title text not null check (char_length(trim(title)) between 1 and 120),
  location text,
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.weekly_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null default 'maybe',
  subgroup_id uuid references public.event_subgroups (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.member_preference_history (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_id uuid not null references public.sports (id) on delete restrict,
  week_start_date date not null,
  was_selected boolean not null default false,
  voted_for boolean not null default false,
  created_at timestamptz not null default now(),
  unique (club_id, user_id, sport_id, week_start_date)
);

create index if not exists clubs_created_by_idx on public.clubs (created_by);
create index if not exists club_members_user_id_idx on public.club_members (user_id);
create index if not exists club_members_club_role_idx on public.club_members (club_id, role);
create index if not exists sports_category_idx on public.sports (category);
create index if not exists sports_location_type_idx on public.sports (location_type);
create index if not exists weekly_events_club_week_idx on public.weekly_events (club_id, week_start_date desc);
create index if not exists weekly_events_selected_sport_idx on public.weekly_events (selected_sport_id);
create index if not exists sport_proposals_event_idx on public.sport_proposals (event_id);
create index if not exists sport_proposals_sport_idx on public.sport_proposals (sport_id);
create index if not exists sport_votes_event_sport_idx on public.sport_votes (event_id, sport_id);
create index if not exists sport_votes_user_idx on public.sport_votes (user_id);
create index if not exists attendance_event_status_idx on public.attendance (event_id, status);
create index if not exists attendance_user_idx on public.attendance (user_id);
create index if not exists preference_history_club_user_week_idx on public.member_preference_history (club_id, user_id, week_start_date desc);
create index if not exists preference_history_club_sport_week_idx on public.member_preference_history (club_id, sport_id, week_start_date desc);
create index if not exists event_subgroups_event_idx on public.event_subgroups (event_id);

create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
  );
$$;

create or replace function public.is_club_admin(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = target_club_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
  );
$$;

create or replace function public.event_club_id(target_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select we.club_id
  from public.weekly_events we
  where we.id = target_event_id;
$$;

create or replace function public.subgroup_event_id(target_subgroup_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select es.event_id
  from public.event_subgroups es
  where es.id = target_subgroup_id;
$$;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.sports enable row level security;
alter table public.weekly_events enable row level security;
alter table public.sport_proposals enable row level security;
alter table public.sport_votes enable row level security;
alter table public.attendance enable row level security;
alter table public.member_preference_history enable row level security;
alter table public.event_subgroups enable row level security;

drop policy if exists "profiles can be created by owner" on public.profiles;
create policy "profiles can be created by owner"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles are visible to self and club members" on public.profiles;
create policy "profiles are visible to self and club members"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.club_members viewer
    join public.club_members subject_member on subject_member.club_id = viewer.club_id
    where viewer.user_id = auth.uid()
      and subject_member.user_id = profiles.id
  )
);

drop policy if exists "profiles can be updated by owner" on public.profiles;
create policy "profiles can be updated by owner"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "clubs can be created by authenticated users" on public.clubs;
create policy "clubs can be created by authenticated users"
on public.clubs for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "clubs are visible to members" on public.clubs;
create policy "clubs are visible to members"
on public.clubs for select
to authenticated
using (public.is_club_member(id) or created_by = auth.uid());

drop policy if exists "clubs can be updated by admins" on public.clubs;
create policy "clubs can be updated by admins"
on public.clubs for update
to authenticated
using (public.is_club_admin(id))
with check (public.is_club_admin(id));

drop policy if exists "clubs can be deleted by owners" on public.clubs;
create policy "clubs can be deleted by owners"
on public.clubs for delete
to authenticated
using (
  exists (
    select 1
    from public.club_members cm
    where cm.club_id = clubs.id
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  )
);

drop policy if exists "club members can view membership" on public.club_members;
create policy "club members can view membership"
on public.club_members for select
to authenticated
using (public.is_club_member(club_id) or user_id = auth.uid());

drop policy if exists "club owners can create initial membership" on public.club_members;
create policy "club owners can create initial membership"
on public.club_members for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.clubs c
      where c.id = club_members.club_id
        and c.created_by = auth.uid()
    )
  )
  or public.is_club_admin(club_id)
);

drop policy if exists "club admins can update membership" on public.club_members;
create policy "club admins can update membership"
on public.club_members for update
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists "club admins can delete membership" on public.club_members;
create policy "club admins can delete membership"
on public.club_members for delete
to authenticated
using (public.is_club_admin(club_id) or user_id = auth.uid());

drop policy if exists "sports are visible to authenticated users" on public.sports;
create policy "sports are visible to authenticated users"
on public.sports for select
to authenticated
using (true);

drop policy if exists "sports can be created by authenticated users" on public.sports;
create policy "sports can be created by authenticated users"
on public.sports for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "sports can be updated by creator" on public.sports;
create policy "sports can be updated by creator"
on public.sports for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "sports can be deleted by creator" on public.sports;
create policy "sports can be deleted by creator"
on public.sports for delete
to authenticated
using (created_by = auth.uid());

drop policy if exists "weekly events are visible to club members" on public.weekly_events;
create policy "weekly events are visible to club members"
on public.weekly_events for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists "weekly events can be created by club admins" on public.weekly_events;
create policy "weekly events can be created by club admins"
on public.weekly_events for insert
to authenticated
with check (public.is_club_admin(club_id));

drop policy if exists "weekly events can be updated by club admins" on public.weekly_events;
create policy "weekly events can be updated by club admins"
on public.weekly_events for update
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists "weekly events can be deleted by club admins" on public.weekly_events;
create policy "weekly events can be deleted by club admins"
on public.weekly_events for delete
to authenticated
using (public.is_club_admin(club_id));

drop policy if exists "sport proposals are visible to event club members" on public.sport_proposals;
create policy "sport proposals are visible to event club members"
on public.sport_proposals for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "sport proposals can be created by event club members" on public.sport_proposals;
create policy "sport proposals can be created by event club members"
on public.sport_proposals for insert
to authenticated
with check (
  public.is_club_member(public.event_club_id(event_id))
  and (
    proposed_by = auth.uid()
    or public.is_club_admin(public.event_club_id(event_id))
  )
);

drop policy if exists "sport proposals can be updated by proposer or club admins" on public.sport_proposals;
create policy "sport proposals can be updated by proposer or club admins"
on public.sport_proposals for update
to authenticated
using (
  proposed_by = auth.uid()
  or public.is_club_admin(public.event_club_id(event_id))
)
with check (
  proposed_by = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
);

drop policy if exists "sport proposals can be deleted by proposer or club admins" on public.sport_proposals;
create policy "sport proposals can be deleted by proposer or club admins"
on public.sport_proposals for delete
to authenticated
using (
  proposed_by = auth.uid()
  or public.is_club_admin(public.event_club_id(event_id))
);

drop policy if exists "sport votes are visible to event club members" on public.sport_votes;
create policy "sport votes are visible to event club members"
on public.sport_votes for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "sport votes can be created by event club members" on public.sport_votes;
create policy "sport votes can be created by event club members"
on public.sport_votes for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
);

drop policy if exists "sport votes can be updated by voter" on public.sport_votes;
create policy "sport votes can be updated by voter"
on public.sport_votes for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
);

drop policy if exists "sport votes can be deleted by voter or club admins" on public.sport_votes;
create policy "sport votes can be deleted by voter or club admins"
on public.sport_votes for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_club_admin(public.event_club_id(event_id))
);

drop policy if exists "event subgroups are visible to event club members" on public.event_subgroups;
create policy "event subgroups are visible to event club members"
on public.event_subgroups for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "event subgroups can be managed by club admins" on public.event_subgroups;
create policy "event subgroups can be managed by club admins"
on public.event_subgroups for all
to authenticated
using (public.is_club_admin(public.event_club_id(event_id)))
with check (public.is_club_admin(public.event_club_id(event_id)));

drop policy if exists "attendance is visible to event club members" on public.attendance;
create policy "attendance is visible to event club members"
on public.attendance for select
to authenticated
using (public.is_club_member(public.event_club_id(event_id)));

drop policy if exists "attendance can be created by attendee" on public.attendance;
create policy "attendance can be created by attendee"
on public.attendance for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_club_member(public.event_club_id(event_id))
  and (
    subgroup_id is null
    or public.subgroup_event_id(subgroup_id) = event_id
  )
);

drop policy if exists "attendance can be updated by attendee or club admins" on public.attendance;
create policy "attendance can be updated by attendee or club admins"
on public.attendance for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_club_admin(public.event_club_id(event_id))
)
with check (
  public.is_club_member(public.event_club_id(event_id))
  and (
    subgroup_id is null
    or public.subgroup_event_id(subgroup_id) = event_id
  )
  and (
    user_id = auth.uid()
    or public.is_club_admin(public.event_club_id(event_id))
  )
);

drop policy if exists "attendance can be deleted by attendee or club admins" on public.attendance;
create policy "attendance can be deleted by attendee or club admins"
on public.attendance for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_club_admin(public.event_club_id(event_id))
);

drop policy if exists "preference history is visible to club members" on public.member_preference_history;
create policy "preference history is visible to club members"
on public.member_preference_history for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists "preference history can be written by club members for self" on public.member_preference_history;
create policy "preference history can be written by club members for self"
on public.member_preference_history for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_club_member(club_id)
);

drop policy if exists "preference history can be managed by club admins" on public.member_preference_history;
create policy "preference history can be managed by club admins"
on public.member_preference_history for update
to authenticated
using (public.is_club_admin(club_id))
with check (public.is_club_admin(club_id));

drop policy if exists "preference history can be deleted by club admins" on public.member_preference_history;
create policy "preference history can be deleted by club admins"
on public.member_preference_history for delete
to authenticated
using (public.is_club_admin(club_id));
