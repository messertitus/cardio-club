drop policy if exists "chat messages visible to club members" on public.chat_messages;
create policy "chat messages visible to club members"
on public.chat_messages for select
to authenticated
using (public.is_club_member(public.chat_messages.club_id));

drop policy if exists "club members can write chat messages" on public.chat_messages;
create policy "club members can write chat messages"
on public.chat_messages for insert
to authenticated
with check (
  public.chat_messages.user_id = auth.uid()
  and public.is_club_member(public.chat_messages.club_id)
);

drop function if exists public.ensure_mcc_week();

create or replace function public.ensure_mcc_week()
returns table (mcc_club_id uuid, mcc_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_event_id uuid;
  v_current_week date := public.current_week_start(current_date);
  v_member_role public.club_member_role := 'member'::public.club_member_role;
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
  into v_club_id
  from public.clubs c
  where c.name = 'Messers Cardio Club'
  order by c.created_at asc
  limit 1;

  if v_club_id is null then
    insert into public.clubs (name, description, created_by)
    values ('Messers Cardio Club', 'Exklusiver wöchentlicher Cardio-Club.', auth.uid())
    returning id into v_club_id;
    v_member_role := 'owner'::public.club_member_role;
  elsif public.is_admin_user(auth.uid()) then
    v_member_role := 'admin'::public.club_member_role;
  end if;

  insert into public.club_members (club_id, user_id, role)
  values (v_club_id, auth.uid(), v_member_role)
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
    v_club_id,
    v_current_week,
    'voting',
    'Seepark Freiburg',
    (v_current_week::timestamp + interval '3 days 18 hours 30 minutes')::timestamptz,
    'Erst Teilnahme, dann Sportwahl. Am Mittwoch wird die Entscheidung ausgewertet.',
    auth.uid()
  )
  on conflict (club_id, week_start_date) do update
  set notes = coalesce(public.weekly_events.notes, excluded.notes)
  returning id into v_event_id;

  insert into public.sport_proposals (event_id, sport_id, proposed_by, note)
  select v_event_id, s.id, auth.uid(), 'Standardauswahl für die Testphase'
  from public.sports s
  where s.id in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000008'
  )
  on conflict (event_id, sport_id) do nothing;

  mcc_club_id := v_club_id;
  mcc_event_id := v_event_id;
  return next;
end;
$$;

notify pgrst, 'reload schema';
