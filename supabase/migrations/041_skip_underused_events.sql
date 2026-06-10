-- 041: Skip events that nobody really voted on.
--
-- Rule (from the club): if, by the time the decision would be released, an event
-- has fewer than two distinct voters (counting only votes from members who are
-- actually attending — going/maybe), running it makes no sense. The event is set
-- to 'cancelled' and thereby drops off the event page into the archive instead of
-- producing a decision. The fairness algorithm itself is untouched: this only
-- gates whether a decision is shown at all.

create or replace function public.cancel_underused_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.weekly_events we
  set status = 'cancelled'::public.weekly_event_status
  where we.status in ('proposing'::public.weekly_event_status, 'voting'::public.weekly_event_status)
    -- decision release moment: the Cardiotag itself (Sat = +2 days, Sun = +3 days)
    and now() >= ((we.week_start_date + (case we.event_day when 'saturday' then 2 else 3 end))::timestamp)
    and (
      select count(distinct v.user_id)
      from public.sport_votes v
      join public.attendance a
        on a.event_id = v.event_id
       and a.user_id = v.user_id
       and a.status in ('going'::public.attendance_status, 'maybe'::public.attendance_status)
      where v.event_id = we.id
    ) < 2;
end;
$$;

-- Run the skip check before the decision-release notifications so cancelled
-- events never trigger a "decision is ready" push.
create or replace function public.run_mcc_notification_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cancel_underused_events();
  perform public.enqueue_vote_reminders();
  perform public.enqueue_decision_release_notifications();
  perform public.enqueue_weekly_invite_reminders();
end;
$$;

grant execute on function public.cancel_underused_events() to authenticated;
grant execute on function public.run_mcc_notification_jobs() to authenticated;

notify pgrst, 'reload schema';
