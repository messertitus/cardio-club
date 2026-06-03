import type { ActualAttendanceStatus, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function reviewAttendance(
  supabase: AppSupabaseClient,
  input: {
    eventId: string;
    userId: string;
    actualStatus: ActualAttendanceStatus;
  },
): Promise<ServiceResult<Row<"attendance">>> {
  const { data, error } = await supabase.rpc("review_event_attendance", {
    target_event_id: input.eventId,
    target_user_id: input.userId,
    next_actual_status: input.actualStatus,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Anwesenheit konnte nicht geprüft werden.") };
  }

  return ok(data);
}
