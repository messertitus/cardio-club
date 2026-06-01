alter table public.weekly_events
  add column if not exists activity_contact_id uuid references public.profiles (id) on delete set null;

create table if not exists public.sport_ideas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  note text,
  suggested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  event_id uuid references public.weekly_events (id) on delete cascade,
  sport_id uuid references public.sports (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('web', 'expo')),
  endpoint text not null,
  subscription jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists sport_ideas_status_created_idx on public.sport_ideas (status, created_at desc);
create index if not exists chat_messages_club_created_idx on public.chat_messages (club_id, created_at desc);
create index if not exists chat_messages_event_created_idx on public.chat_messages (event_id, created_at desc);
create index if not exists chat_messages_event_sport_created_idx on public.chat_messages (event_id, sport_id, created_at desc);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index if not exists weekly_events_activity_contact_idx on public.weekly_events (activity_contact_id);

alter table public.sport_ideas enable row level security;
alter table public.chat_messages enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "sport ideas are visible to authenticated users" on public.sport_ideas;
create policy "sport ideas are visible to authenticated users"
on public.sport_ideas for select
to authenticated
using (true);

drop policy if exists "members can suggest sport ideas" on public.sport_ideas;
create policy "members can suggest sport ideas"
on public.sport_ideas for insert
to authenticated
with check (suggested_by = auth.uid());

drop policy if exists "admins can moderate sport ideas" on public.sport_ideas;
create policy "admins can moderate sport ideas"
on public.sport_ideas for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "chat messages visible to club members" on public.chat_messages;
create policy "chat messages visible to club members"
on public.chat_messages for select
to authenticated
using (public.is_club_member(club_id));

drop policy if exists "club members can write chat messages" on public.chat_messages;
create policy "club members can write chat messages"
on public.chat_messages for insert
to authenticated
with check (user_id = auth.uid() and public.is_club_member(club_id));

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions"
on public.push_subscriptions for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

insert into public.sports (id, name, category, intensity_level, location_type, combinable_tags, created_by)
values
  ('10000000-0000-4000-8000-000000000001', 'Laufen', 'endurance', 'medium', 'outdoor', array['park', 'outdoor', 'calisthenics'], null),
  ('10000000-0000-4000-8000-000000000002', 'Schwimmen', 'water', 'medium', 'water', array['lake', 'water', 'beach'], null),
  ('10000000-0000-4000-8000-000000000003', 'Outdoor-Boxen', 'combat', 'high', 'outdoor', array['outdoor', 'lake', 'running'], null),
  ('10000000-0000-4000-8000-000000000004', 'Beachvolleyball', 'field', 'medium', 'outdoor', array['beach', 'lake', 'water'], null),
  ('10000000-0000-4000-8000-000000000005', 'Fußball', 'field', 'high', 'field', array['field', 'team'], null),
  ('10000000-0000-4000-8000-000000000006', 'Hiking', 'endurance', 'medium', 'outdoor', array['outdoor', 'trail'], null),
  ('10000000-0000-4000-8000-000000000007', 'Rudern', 'water', 'high', 'water', array['water', 'team'], null),
  ('10000000-0000-4000-8000-000000000008', 'Calisthenics', 'strength', 'medium', 'flexible', array['park', 'running', 'outdoor'], null),
  ('10000000-0000-4000-8000-000000000009', 'Basketball', 'field', 'high', 'field', array['team', 'court'], null),
  ('10000000-0000-4000-8000-000000000010', 'Radfahren', 'endurance', 'medium', 'outdoor', array['outdoor', 'route'], null)
on conflict (id) do update
set
  name = excluded.name,
  category = excluded.category,
  intensity_level = excluded.intensity_level,
  location_type = excluded.location_type,
  combinable_tags = excluded.combinable_tags;

create or replace function public.current_week_start(input_date date default current_date)
returns date
language sql
stable
as $$
  select (input_date - ((extract(isodow from input_date)::int - 1) * interval '1 day'))::date;
$$;

create or replace function public.ensure_mcc_week()
returns table (club_id uuid, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_club_id uuid;
  resolved_event_id uuid;
  current_week date := public.current_week_start(current_date);
  creator_role public.club_member_role := 'member'::public.club_member_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;

  insert into public.profiles (id, display_name, email, role)
  select
    auth.uid(),
    coalesce(nullif(split_part(u.email, '@', 1), ''), 'Cardio-Mitglied'),
    u.email,
    case when lower(u.email) = 'messertitus@outlook.com' then 'admin'::public.app_role else 'member'::public.app_role end
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do update
  set email = excluded.email;

  select c.id
  into resolved_club_id
  from public.clubs c
  where c.name = 'Messers Cardio Club'
  order by c.created_at asc
  limit 1;

  if resolved_club_id is null then
    insert into public.clubs (name, description, created_by)
    values ('Messers Cardio Club', 'Exklusiver wöchentlicher Cardio-Club.', auth.uid())
    returning id into resolved_club_id;
    creator_role := 'owner'::public.club_member_role;
  elsif public.is_admin_user(auth.uid()) then
    creator_role := 'admin'::public.club_member_role;
  end if;

  insert into public.club_members (club_id, user_id, role)
  values (resolved_club_id, auth.uid(), creator_role)
  on conflict (club_id, user_id) do nothing;

  insert into public.weekly_events (
    club_id,
    week_start_date,
    status,
    location,
    starts_at,
    notes,
    activity_contact_id
  )
  values (
    resolved_club_id,
    current_week,
    'voting',
    'Seepark Freiburg',
    (current_week::timestamp + interval '3 days 18 hours 30 minutes')::timestamptz,
    'Erst Teilnahme, dann Sportwahl. Am Mittwoch wird die Entscheidung ausgewertet.',
    null
  )
  on conflict (club_id, week_start_date) do update
  set club_id = excluded.club_id
  returning id into resolved_event_id;

  insert into public.sport_proposals (event_id, sport_id, proposed_by, note)
  select resolved_event_id, s.id, auth.uid(), 'Standardauswahl für die Testphase'
  from public.sports s
  where s.id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000008'
  )
  on conflict (event_id, sport_id) do nothing;

  club_id := resolved_club_id;
  event_id := resolved_event_id;
  return next;
end;
$$;

create or replace function public.clear_mcc_test_chat()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Only admins can clear chat.';
  end if;

  delete from public.chat_messages cm
  using public.clubs c
  where cm.club_id = c.id
    and c.name = 'Messers Cardio Club';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

notify pgrst, 'reload schema';
