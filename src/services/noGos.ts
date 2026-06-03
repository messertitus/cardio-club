import type { Row } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function listEventNoGos(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_no_gos">[]>> {
  const { data, error } = await supabase.from("sport_no_gos").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "No-Gos konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function setSportNoGo(
  supabase: AppSupabaseClient,
  input: { eventId: string; sportId: string; userId: string; reason?: string | null },
): Promise<ServiceResult<Row<"sport_no_gos">>> {
  const eligibility = await getNoGoEligibility(supabase, input.eventId, input.userId);

  if (eligibility.error) {
    return { data: null, error: eligibility.error };
  }

  if (!eligibility.data.votingOpen) {
    return fail("Die Abstimmung ist geschlossen, weil die Entscheidung bereits festgelegt wurde.");
  }

  if (!eligibility.data.attendance || eligibility.data.attendance.status === "not_going") {
    return fail("Bitte gib zuerst an, ob du dabei bist oder vielleicht kommst.");
  }

  const { data, error } = await supabase
    .from("sport_no_gos")
    .upsert(
      {
        event_id: input.eventId,
        sport_id: input.sportId,
        user_id: input.userId,
        reason: input.reason ?? null,
      },
      { onConflict: "event_id,sport_id,user_id" },
    )
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "No-Go konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function removeSportNoGo(
  supabase: AppSupabaseClient,
  input: { eventId: string; sportId: string; userId: string },
): Promise<ServiceResult<{ removed: true }>> {
  const { error } = await supabase
    .from("sport_no_gos")
    .delete()
    .eq("event_id", input.eventId)
    .eq("sport_id", input.sportId)
    .eq("user_id", input.userId);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "No-Go konnte nicht entfernt werden.") };
  }

  return ok({ removed: true });
}

async function getNoGoEligibility(
  supabase: AppSupabaseClient,
  eventId: string,
  userId: string,
): Promise<ServiceResult<{ votingOpen: boolean; attendance: Pick<Row<"attendance">, "status"> | null }>> {
  const [eventResult, attendanceResult] = await Promise.all([
    supabase.from("weekly_events").select("status").eq("id", eventId).single(),
    supabase.from("attendance").select("status").eq("event_id", eventId).eq("user_id", userId).maybeSingle(),
  ]);

  if (eventResult.error || !eventResult.data) {
    return { data: null, error: fromPostgrestError(eventResult.error, "Could not load event status.") };
  }

  if (attendanceResult.error) {
    return { data: null, error: fromPostgrestError(attendanceResult.error, "Could not load your attendance status.") };
  }

  return ok({
    votingOpen: eventResult.data.status === "proposing" || eventResult.data.status === "voting",
    attendance: attendanceResult.data,
  });
}
