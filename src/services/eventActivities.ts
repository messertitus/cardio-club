import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function listEventActivities(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"event_activities">[]>> {
  const { data, error } = await supabase
    .from("event_activities")
    .select()
    .eq("event_id", eventId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Event-Aktivitäten konnten nicht geladen werden.") };
  }

  return ok(data);
}

// NOTE: replaceEventActivitiesFromDecision moved server-side into
// supabase/functions/decision/_shared/decisionService.ts together with the
// algorithm. Persisting a decision is now done by the `decision` Edge Function,
// so this client module no longer references FairConstellationDecision.
