import type { ClubMemberRole, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function updateMccMemberRole(
  supabase: AppSupabaseClient,
  input: { clubId: string; userId: string; role: ClubMemberRole },
): Promise<ServiceResult<{ saved: true }>> {
  const { error } = await supabase
    .from("club_members")
    .update({ role: input.role })
    .eq("club_id", input.clubId)
    .eq("user_id", input.userId);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Rechte konnten nicht gespeichert werden.") };
  }

  return ok({ saved: true });
}

export async function setMccActivityContact(
  supabase: AppSupabaseClient,
  input: { eventId: string; userId: string | null },
): Promise<ServiceResult<Row<"weekly_events">>> {
  const { data, error } = await supabase
    .from("weekly_events")
    .update({ activity_contact_id: input.userId })
    .eq("id", input.eventId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Ansprechpartner konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function removeMccMemberFromClub(
  supabase: AppSupabaseClient,
  input: { clubId: string; userId: string },
): Promise<ServiceResult<{ removed: true }>> {
  const { error } = await supabase.from("club_members").delete().eq("club_id", input.clubId).eq("user_id", input.userId);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Mitglied konnte nicht entfernt werden.") };
  }

  return ok({ removed: true });
}
