import type { Json, Row } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type EventResultInput = {
  resultId?: string | null;
  eventId: string;
  activityId?: string | null;
  sportId?: string | null;
  resultType?: Row<"event_results">["result_type"];
  summary: string;
  scores?: Json;
  userId: string;
};

export async function listEventResults(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"event_results">[]>> {
  const { data, error } = await supabase
    .from("event_results")
    .select()
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Ergebnisse konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function upsertEventResult(
  supabase: AppSupabaseClient,
  input: EventResultInput,
): Promise<ServiceResult<Row<"event_results">>> {
  const summary = input.summary.trim();
  if (!summary) {
    return fail("Bitte trage eine kurze Ergebnis-Zusammenfassung ein.");
  }

  const writablePayload = {
    activity_id: input.activityId ?? null,
    sport_id: input.sportId ?? null,
    result_type: input.resultType ?? "summary",
    summary,
    scores: input.scores ?? {},
    updated_by: input.userId,
    updated_at: new Date().toISOString(),
  };

  const query = input.resultId
    ? supabase.from("event_results").update(writablePayload).eq("id", input.resultId).select().single()
    : supabase.from("event_results").insert({ ...writablePayload, event_id: input.eventId, created_by: input.userId }).select().single();
  const { data, error } = await query;

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Ergebnis konnte nicht gespeichert werden.") };
  }

  return ok(data);
}
