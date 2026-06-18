// Thin client for the server-side decision algorithm.
//
// SECURITY: The fair-constellation algorithm (scoring, ranking, fairness/no-go
// mechanics, DEFAULT_OPTIONS weights) used to run here in the browser and shipped
// in the web/PWA bundle. It now lives exclusively in the `decision` Edge Function
// (supabase/functions/decision/). This module only invokes that function and
// returns the sanitized DecisionView — it must never import the algorithm again.
import type { DecisionView } from "../lib/decisionView";
import type { Row } from "./database.types";
import { fail, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type EventDecisionPreview = DecisionView;

export type GetEventDecisionPreviewInput = {
  eventId: string;
};

export type FinalizedDecision = {
  event: Row<"weekly_events">;
  view: DecisionView;
};

export async function getEventDecisionPreview(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<EventDecisionPreview>> {
  const result = await invokeDecision<{ view: DecisionView }>(supabase, { eventId: input.eventId, action: "preview" });
  if (result.error) {
    return { data: null, error: result.error };
  }
  return ok(result.data.view);
}

// Triggers the one-time, server-side finalize for every event whose 48h decision
// moment has passed (no eventId — it's a sweep). The Edge Function is idempotent,
// so this client fallback (any member) and the periodic send-push sweep can both
// call it safely. Returns how many events were decided on this run.
export async function finalizeDueDecisions(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<{ finalized: number }>> {
  const { data, error } = await supabase.functions.invoke("decision", { body: { action: "finalize-due" } });
  if (error) {
    return fail(await extractFunctionError(error, "Fällige Entscheidungen konnten nicht abgeschlossen werden."));
  }
  return ok({ finalized: Number((data as { finalized?: number } | null)?.finalized ?? 0) });
}

export async function finalizeEventDecision(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<FinalizedDecision>> {
  const result = await invokeDecision<{ event: Row<"weekly_events">; view: DecisionView }>(supabase, {
    eventId: input.eventId,
    action: "finalize",
  });
  if (result.error) {
    return { data: null, error: result.error };
  }
  return ok({ event: result.data.event, view: result.data.view });
}

async function invokeDecision<T>(
  supabase: AppSupabaseClient,
  body: { eventId: string; action: "preview" | "finalize" },
): Promise<ServiceResult<T>> {
  const { data, error } = await supabase.functions.invoke("decision", { body });

  if (error) {
    return fail(await extractFunctionError(error, "Die Entscheidung konnte nicht berechnet werden."));
  }
  if (!data) {
    return fail("Die Entscheidung lieferte keine Daten.");
  }
  return ok(data as T);
}

// supabase-js wraps non-2xx responses in a FunctionsHttpError whose `context` is
// the raw Response; pull our JSON `{ error }` message out of it when present.
async function extractFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body && typeof body.error === "string") {
        return body.error;
      }
    } catch {
      // fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : fallback;
}
