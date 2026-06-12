-- 048: Voting closes a 2h buffer before the decision.
--
-- So the last vote and the decision never happen at the same instant. Voting
-- closes at (decision - 2h); the decision/cancel jobs still fire at the decision
-- moment (event - 2 days, event time). The "vote closing soon" reminder is
-- aligned to the voting-close moment instead of the decision moment. The client
-- uses the same 2h buffer (VOTE_CLOSE_BUFFER_MS in src/services/date.ts).

create or replace function public.mcc_voting_close_at(starts_at timestamptz, week_start date, weekday text)
returns timestamptz
language sql
immutable
as $$
  select public.mcc_decision_release_at(starts_at, week_start, weekday) - interval '2 hours';
$$;

grant execute on function public.mcc_voting_close_at(timestamptz, date, text) to authenticated;

-- #2 Vote reminder — within 12h before voting closes (the buffered close moment).
create or replace function public.enqueue_vote_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_notifications (user_id, kind, title, body, href, payload)
  select cm.user_id, 'vote_reminder', 'Stimme bald fällig',
    'Die Abstimmung für deinen Cardiotag läuft in Kürze ab. Stimm jetzt ab.',
    '/',
    jsonb_build_object('eventId', we.id, 'clubId', we.club_id)
  from public.weekly_events we
  join public.club_members cm on cm.club_id = we.club_id
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    and now() >= (public.mcc_voting_close_at(we.starts_at, we.week_start_date, we.event_day) - interval '12 hours')
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
