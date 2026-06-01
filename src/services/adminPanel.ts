import type { ClubMemberRole, Row, SportIntensityLevel, SportLocationType } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type MccSportAdminInput = {
  sportId?: string | null;
  name: string;
  category: string;
  intensityLevel: SportIntensityLevel;
  locationType: SportLocationType;
  combinableTags: string[];
};

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

export async function deactivateMccMember(
  supabase: AppSupabaseClient,
  input: { userId: string; reason?: string },
): Promise<ServiceResult<{ deactivated: true }>> {
  const { data, error } = await supabase.rpc("deactivate_club_member", {
    target_user_id: input.userId,
    reason: input.reason ?? "Von Admin deaktiviert",
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Mitglied konnte nicht deaktiviert werden.") };
  }

  return ok({ deactivated: true });
}

export async function listMccSports(supabase: AppSupabaseClient): Promise<ServiceResult<Row<"sports">[]>> {
  const { data, error } = await supabase.from("sports").select().order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportarten konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function upsertMccSport(supabase: AppSupabaseClient, input: MccSportAdminInput): Promise<ServiceResult<Row<"sports">>> {
  if (!input.name.trim()) {
    return fail("Bitte gib einen Namen ein.");
  }

  const { data, error } = await supabase.rpc("admin_upsert_sport", {
    target_sport_id: input.sportId ?? null,
    sport_name: input.name.trim(),
    sport_category: input.category.trim() || "cardio",
    sport_intensity: input.intensityLevel,
    sport_location_type: input.locationType,
    sport_tags: input.combinableTags.map((tag) => tag.trim()).filter(Boolean),
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportart konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function deleteMccSport(supabase: AppSupabaseClient, sportId: string): Promise<ServiceResult<{ deleted: true }>> {
  const { data, error } = await supabase.rpc("admin_delete_sport", { target_sport_id: sportId });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportart konnte nicht gelöscht werden.") };
  }

  return ok({ deleted: true });
}
