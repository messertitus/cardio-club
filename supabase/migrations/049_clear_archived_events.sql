-- 049: One-time cleanup — remove archived events for a fresh test start.
--
-- Deletes every event that is already in the archive: skipped (cancelled),
-- completed, or whose event date has passed. All child rows (votes, attendance,
-- no-gos, proposals, activities, results, chat) are removed via ON DELETE CASCADE.
-- ensure_mcc_week re-creates the current and next week's events fresh on the next
-- app load, so the test starts clean.

delete from public.weekly_events we
where we.status in ('cancelled'::public.weekly_event_status, 'completed'::public.weekly_event_status)
   or coalesce(
        we.starts_at,
        ((we.week_start_date + public.mcc_event_weekday_offset(we.event_day))::timestamp at time zone 'Europe/Berlin')
      ) < now();

-- Drop now-orphaned event notifications (no FK, so clean them up explicitly).
delete from public.app_notifications n
where n.payload ? 'eventId'
  and not exists (select 1 from public.weekly_events we where we.id::text = n.payload->>'eventId');

notify pgrst, 'reload schema';
