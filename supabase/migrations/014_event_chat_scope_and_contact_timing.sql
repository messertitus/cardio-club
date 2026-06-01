alter table public.chat_messages
  add column if not exists sport_id uuid references public.sports (id) on delete cascade;

alter table public.event_subgroups
  add column if not exists activity_contact_id uuid references public.profiles (id) on delete set null;

create index if not exists chat_messages_event_sport_created_idx
on public.chat_messages (event_id, sport_id, created_at desc);

drop function if exists public.ensure_mcc_week();

create or replace function public.ensure_mcc_week()
returns table (mcc_club_id uuid, mcc_event_id uuid)
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

  insert into public.profiles (id, display_name, email, phone, role)
  select
    auth.uid(),
    coalesce(
      nullif(raw_user_meta_data->>'display_name', ''),
      nullif(phone, ''),
      nullif(split_part(email, '@', 1), ''),
      'Cardio-Mitglied'
    ),
    email,
    phone,
    case
      when lower(coalesce(email, '')) = 'messertitus@outlook.com' then 'admin'::public.app_role
      else 'member'::public.app_role
    end
  from auth.users
  where id = auth.uid()
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    display_name = case
      when public.profiles.display_name is null or public.profiles.display_name = '' or public.profiles.display_name = 'Cardio-Mitglied'
      then excluded.display_name
      else public.profiles.display_name
    end;

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

  mcc_club_id := resolved_club_id;
  mcc_event_id := resolved_event_id;
  return next;
end;
$$;

notify pgrst, 'reload schema';
