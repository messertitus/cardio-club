import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type EventCloseReadiness = {
  hasResults: boolean;
  attendanceReviewed: boolean;
  canClose: boolean;
};

export async function getEventCloseReadiness(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<EventCloseReadiness>> {
  const { data, error } = await supabase.rpc("event_close_readiness", { target_event_id: eventId });
  const row = data?.[0];

  if (error || !row) {
    return { data: null, error: fromPostgrestError(error, "Abschluss-Status konnte nicht geladen werden.") };
  }

  return ok({ hasResults: row.has_results, attendanceReviewed: row.attendance_reviewed, canClose: row.can_close });
}

export async function canCloseEvent(
  supabase: AppSupabaseClient,
  eventId: string,
  userId: string,
): Promise<ServiceResult<boolean>> {
  const { data, error } = await supabase.rpc("event_can_be_closed_by", { target_event_id: eventId, actor_id: userId });

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Berechtigung konnte nicht geprüft werden.") };
  }

  return ok(Boolean(data));
}

export async function closeWeeklyEvent(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"weekly_events">>> {
  const { data, error } = await supabase.rpc("close_weekly_event", { target_event_id: eventId });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Event konnte nicht abgeschlossen werden.") };
  }

  return ok(data as Row<"weekly_events">);
}
