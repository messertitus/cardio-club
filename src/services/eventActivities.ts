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

  const sportIds = [...new Set(input.decision.activities.map((activity) => activity.sportId))];
  const sportsResult = sportIds.length
    ? await supabase.from("sports").select("id, name").in("id", sportIds)
    : { data: [] as Array<Pick<Row<"sports">, "id" | "name">>, error: null };

  if (sportsResult.error || !sportsResult.data) {
    return { data: null, error: fromPostgrestError(sportsResult.error, "Sportarten der Event-Aktivitäten konnten nicht geladen werden.") };
  }

  const sportNames = new Map(sportsResult.data.map((sport) => [sport.id, sport.name]));

  const { data, error } = await supabase
    .from("event_activities")
    .insert(
      input.decision.activities.map((activity) => ({
        event_id: input.eventId,
        sport_id: activity.sportId,
        sport_profile_id: activity.profileId,
        role: activity.role,
        activity_type: input.decision.mode,
        title: activityTitle(sportNames.get(activity.sportId) ?? "Sportart", activity.profileName, activity.locationName),
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

function activityTitle(sportName: string, profileName: string, locationName?: string | null): string {
  if (profileName.toLowerCase().includes(sportName.toLowerCase())) {
    return profileName;
  }

  if (locationName) {
    return `${sportName} ${locationPreposition(locationName)} ${locationName}`;
  }

  return `${sportName} · ${profileName}`;
}

function locationPreposition(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes("see") || lower.includes("rhein") || lower.includes("ufer")) return "am";
  if (lower.includes("park") || lower.includes("halle") || lower.includes("platz") || lower.includes("schänzle")) return "im";
  return "in";
}
