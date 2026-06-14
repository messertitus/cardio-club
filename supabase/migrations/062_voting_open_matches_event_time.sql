-- Align the voting/attendance RLS gate with the real voting window.
--
-- weekly_event_is_open_for_voting() was last defined in migration 035 (before
-- Saturday/Sunday events in 037 and the event-time voting window in 044–048). It
-- still hard-coded "the first three days of the week"
--   current_date >= week_start_date and current_date < week_start_date + 3 days
-- which has nothing to do with when voting is actually open for an event that can
-- fall on any weekday and whose timing is anchored to starts_at.
--
-- The client decides "voting open" via votingOpenNow() in src/services/date.ts:
-- open from (decision − 4 days) until (decision − 2h), where the decision is 2
-- days before the event at the event's time. So for a Saturday 14:00 event the
-- client showed voting as open while this RLS function still rejected the insert,
-- producing "new row violates row-level security policy for table attendance"
-- (and the same gate guards votes/proposals).
--
-- This redefines the function in terms of the existing, weekday-aware helpers
-- mcc_decision_release_at() / mcc_voting_close_at() so server and client agree.

create or replace function public.weekly_event_is_open_for_voting(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.weekly_events we
    where we.id = target_event_id
      and we.status in ('proposing', 'voting')
      and now() >= public.mcc_decision_release_at(we.starts_at, we.week_start_date, we.event_day) - interval '4 days'
      and now() <  public.mcc_voting_close_at(we.starts_at, we.week_start_date, we.event_day)
  );
$$;
