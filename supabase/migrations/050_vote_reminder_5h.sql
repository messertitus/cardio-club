-- 050: Vote reminder fires ~5h before voting closes, not 12h.
--
-- 12h before a 13:00 close lands at 01:00 — a night push nobody sees. 5h before
-- puts it in the morning of the same day, while there is still time to vote.

create or replace function public.enqueue_vote_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'vote_reminder', 'Stimme bald fällig',
    'Die Abstimmung für deinen Cardiotag läuft heute ab. Stimm jetzt ab.',
    '/',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.club_members cm on cm.club_id = we.club_id
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    and now() >= (public.mcc_voting_close_at(we.starts_at, we.week_start_date, we.event_day) - interval '5 hours')
    and now() <  public.mcc_voting_close_at(we.starts_at, we.week_start_date, we.event_day)
    and not exists (select 1 from public.attendance a where a.event_id = we.id and a.user_id = cm.user_id and a.status = 'not_going'::public.attendance_status)
    and not exists (select 1 from public.sport_votes v where v.event_id = we.id and v.user_id = cm.user_id)
    and not exists (
      select 1 from public.app_notifications n
      where n.user_id = cm.user_id and n.kind = 'vote_reminder' and n.payload->>'eventId' = we.id::text
    );
end;
$$;

notify pgrst, 'reload schema';
