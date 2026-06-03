import type { FairConstellationDecision } from "../lib/fairConstellationSelection";
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

export async function replaceEventActivitiesFromDecision(
  supabase: AppSupabaseClient,
  input: { eventId: string; startsAt?: string | null; decision: FairConstellationDecision },
): Promise<ServiceResult<Row<"event_activities">[]>> {
  const { error: deleteError } = await supabase.from("event_activities").delete().eq("event_id", input.eventId);

  if (deleteError) {
    return { data: null, error: fromPostgrestError(deleteError, "Alte Event-Aktivitäten konnten nicht ersetzt werden.") };
  }

  if (input.decision.activities.length === 0) {
    return ok([]);
  }

  const { data, error } = await supabase
    .from("event_activities")
    .insert(
      input.decision.activities.map((activity) => ({
        event_id: input.eventId,
        sport_id: activity.sportId,
        sport_profile_id: activity.profileId,
        role: activity.role,
        activity_type: input.decision.mode,
        title: activity.profileName,
        location: activity.locationName ?? null,
        starts_at: input.startsAt ?? null,
        activity_contact_id: activity.activityContactId ?? null,
        assigned_user_ids: activity.assignedUserIds,
      })),
    )
    .select();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Event-Aktivitäten konnten nicht gespeichert werden.") };
  }

  return ok(data);
}
