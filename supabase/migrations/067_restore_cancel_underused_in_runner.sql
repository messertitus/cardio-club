-- 067: Restore the "skip underused events" job in the shared runner.
--
-- Regression: migration 041 wired cancel_underused_events() into
-- run_mcc_notification_jobs(), but migrations 053 and 063 each redefined the
-- runner with `create or replace` and silently dropped that call. Since 053,
-- events that reach their decision moment with fewer than two distinct attending
-- voters were therefore NEVER cancelled — they stayed 'voting' and showed a
-- (live-weather, near-signal-less) decision preview instead of going to the
-- archive. That is exactly the reported Saturday with one vote / one "maybe".
--
-- This re-adds the call. It runs FIRST, before the notification jobs, so a
-- just-cancelled event no longer triggers a "decision released" notification in
-- the same run (enqueue_decision_release_notifications already skips cancelled
-- events). cancel_underused_events() itself is unchanged (migration 045).

create or replace function public.run_mcc_notification_jobs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip events that reach their decision moment with < 2 distinct attending
  -- voters (mirrors the client gate isEventDecisionReadyForChat). Must run before
  -- the notification jobs so cancelled events get no decision-release push.
  perform public.cancel_underused_events();

  perform public.enqueue_vote_open_notifications();
  perform public.enqueue_vote_reminders();
  perform public.enqueue_decision_release_notifications();
  perform public.enqueue_weekly_invite_reminders();
  perform public.run_due_notification_rules();
end;
$$;

grant execute on function public.run_mcc_notification_jobs() to authenticated;

notify pgrst, 'reload schema';
