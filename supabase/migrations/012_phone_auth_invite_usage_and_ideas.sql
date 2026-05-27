alter table public.profiles
  add column if not exists phone text;

create unique index if not exists profiles_phone_unique_idx
on public.profiles (phone)
where phone is not null;

alter table public.sport_ideas
  add column if not exists location text,
  add column if not exists preferred_time text;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Cardio-Mitglied'),
    new.email,
    new.phone,
    case when lower(coalesce(new.email, '')) = 'messertitus@outlook.com' then 'admin'::public.app_role else 'member'::public.app_role end
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    display_name = case
      when public.profiles.display_name in ('Cardio-Mitglied', 'Mitglied') then excluded.display_name
      else public.profiles.display_name
    end,
    role = case
      when lower(coalesce(excluded.email, public.profiles.email, '')) = 'messertitus@outlook.com' then 'admin'::public.app_role
      else public.profiles.role
    end;

  return new;
end;
$$;

create or replace function public.create_invitation_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  current_role public.app_role;
  created_count integer;
  new_code text;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select role
  into current_role
  from public.profiles
  where id = current_user_id;

  if current_role is distinct from 'admin' then
    select count(*)
    into created_count
    from public.invitation_codes
    where created_by = current_user_id;

    if created_count >= 3 then
      raise exception 'invite limit reached';
    end if;
  end if;

  loop
    new_code := lpad((floor(random() * 1000000000000)::bigint)::text, 12, '0');
    exit when not exists (
      select 1
      from public.invitation_codes
      where code = new_code
    );
  end loop;

  insert into public.invitation_codes (code, created_by)
  values (new_code, current_user_id);

  return new_code;
end;
$$;

create or replace function public.clear_mcc_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mcc_club_id uuid;
  cleared_chat integer := 0;
  cleared_votes integer := 0;
  cleared_attendance integer := 0;
  cleared_ideas integer := 0;
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'admin only';
  end if;

  select id into mcc_club_id
  from public.clubs
  where name = 'Messers Cardio Club'
  order by created_at asc
  limit 1;

  if mcc_club_id is null then
    return jsonb_build_object('clubFound', false);
  end if;

  delete from public.chat_messages where club_id = mcc_club_id;
  get diagnostics cleared_chat = row_count;

  delete from public.member_preference_history where club_id = mcc_club_id;

  delete from public.sport_votes
  where event_id in (select id from public.weekly_events where club_id = mcc_club_id);
  get diagnostics cleared_votes = row_count;

  delete from public.attendance
  where event_id in (select id from public.weekly_events where club_id = mcc_club_id);
  get diagnostics cleared_attendance = row_count;

  delete from public.event_subgroups
  where event_id in (select id from public.weekly_events where club_id = mcc_club_id);

  update public.weekly_events
  set selected_sport_id = null,
      secondary_sport_id = null,
      decision_reason = null,
      status = 'voting'
  where club_id = mcc_club_id
    and status in ('proposing', 'voting', 'decided');

  delete from public.sport_ideas;
  get diagnostics cleared_ideas = row_count;

  delete from public.invitation_codes
  where used_by is null;

  return jsonb_build_object(
    'clubFound', true,
    'chat', cleared_chat,
    'votes', cleared_votes,
    'attendance', cleared_attendance,
    'ideas', cleared_ideas
  );
end;
$$;

notify pgrst, 'reload schema';
