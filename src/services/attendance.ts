import type { AttendanceStatus, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type UpdateAttendanceInput = {
  eventId: string;
  userId: string;
  status: AttendanceStatus;
  subgroupId?: string | null;
};

export async function updateAttendance(
  supabase: AppSupabaseClient,
  input: UpdateAttendanceInput,
): Promise<ServiceResult<Row<"attendance">>> {
  const { data, error } = await supabase
    .from("attendance")
    .upsert(
      {
        event_id: input.eventId,
        user_id: input.userId,
        status: input.status,
        subgroup_id: input.subgroupId ?? null,
      },
      { onConflict: "event_id,user_id" },
    )
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not update attendance.") };
  }

  return ok(data);
}

export async function listAttendance(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"attendance">[]>> {
  const { data, error } = await supabase.from("attendance").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load attendance.") };
  }

  return ok(data);
}
