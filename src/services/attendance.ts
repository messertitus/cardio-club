import type { AttendanceStatus, Row } from "./database.types";
import { votingOpenNow } from "./date";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
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
  const eventResult = await getAttendanceEvent(supabase, input.eventId);
  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  if (!isAttendanceOpen(eventResult.data)) {
    return fail("Teilnahme ist geschlossen. Die Auswertung erscheint kurz vor dem Cardiotag.");
  }

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

async function getAttendanceEvent(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Pick<Row<"weekly_events">, "status" | "week_start_date" | "event_day" | "starts_at">>> {
  const { data, error } = await supabase.from("weekly_events").select("status, week_start_date, event_day, starts_at").eq("id", eventId).single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load event status.") };
  }

  return ok(data);
}

function isAttendanceOpen(event: Pick<Row<"weekly_events">, "status" | "week_start_date" | "event_day" | "starts_at">): boolean {
  return (event.status === "proposing" || event.status === "voting") && votingOpenNow(event.starts_at, event.week_start_date, event.event_day);
}
