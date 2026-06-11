-- 044: Stop leaking the decision algorithm internals through the database.
--
-- The fair-constellation algorithm now runs exclusively in the `decision` Edge
-- Function (supabase/functions/decision/). It no longer ships in the web/PWA
-- bundle. This migration closes the *other* leak path: four columns on
-- weekly_events used to hold the raw algorithm internals and were written by the
-- anon client, which meant any authenticated member could read them straight off
-- the REST API:
--
--   decision_scorecard        -- per-candidate score breakdown (14 raw weights)
--   decision_explainability   -- fairnessDebt, weighted vote scores, etc.
--   losing_candidate_reasons  -- ranking margins + internal reason strings
--   no_go_breakdown           -- raw no-go penalty mechanics
--
-- These columns are no longer written (the Edge Function persists NULL — see
-- decisionService.ts) and nothing reads them back: the user-facing explanation is
-- decision_reason / decision_character, and the admin summary is recomputed live
-- from a fresh preview. We purge any historical values here so nothing readable
-- remains. The columns are kept (nullable) only for backwards compatibility.
--
-- NOTE: a column-level REVOKE alone would be ineffective here — Supabase grants
-- table-level SELECT on public tables to anon/authenticated, which shadows
-- per-column revokes. Removing the data is the robust fix, so we null it out and
-- additionally revoke write access on these columns as defence-in-depth.

-- 1) Purge any leaked internals already stored on decided events.
update public.weekly_events
set decision_scorecard = null,
    decision_explainability = null,
    losing_candidate_reasons = null,
    no_go_breakdown = null
where decision_scorecard is not null
   or decision_explainability is not null
   or losing_candidate_reasons is not null
   or no_go_breakdown is not null;

-- 2) Defence-in-depth: clients must never write these columns again. Writes now
--    only happen via the service role inside the Edge Function (which bypasses
--    grants), so revoking column-level INSERT/UPDATE from the client roles cannot
--    break the app.
revoke insert (decision_scorecard, decision_explainability, losing_candidate_reasons, no_go_breakdown)
  on public.weekly_events from anon, authenticated;
revoke update (decision_scorecard, decision_explainability, losing_candidate_reasons, no_go_breakdown)
  on public.weekly_events from anon, authenticated;

-- 3) Document intent at the schema level.
comment on column public.weekly_events.decision_scorecard is
  'DEPRECATED / server-only. Always NULL. Raw algorithm internals must never be exposed to clients (see migration 044).';
comment on column public.weekly_events.decision_explainability is
  'DEPRECATED / server-only. Always NULL. Raw algorithm internals must never be exposed to clients (see migration 044).';
comment on column public.weekly_events.losing_candidate_reasons is
  'DEPRECATED / server-only. Always NULL. Raw algorithm internals must never be exposed to clients (see migration 044).';
comment on column public.weekly_events.no_go_breakdown is
  'DEPRECATED / server-only. Always NULL. Raw algorithm internals must never be exposed to clients (see migration 044).';
