import type { ClubMemberRole, Row, SportIntensityLevel } from "./database.types";
import { removeLocalCache } from "./localCache";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

const ACTIVE_SPORTS_CACHE_KEY = "mcc.cache.activeSportsWithProfiles.v2";

export type MccSportAdminInput = {
  sportId?: string | null;
  name: string;
  description?: string | null;
  category: string;
  iconName?: string | null;
  intensityLevel: SportIntensityLevel;
  combinableTags?: string[];
  isActive?: boolean;
};

export type MccSportContact = Row<"sport_contacts"> & {
  sportName: string;
  displayName: string;
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

export async function updateMccMemberDisplayName(
  supabase: AppSupabaseClient,
  input: { userId: string; displayName: string },
): Promise<ServiceResult<Row<"profiles">>> {
  const displayName = input.displayName.trim();
  if (displayName.length < 2) {
    return fail("Bitte gib einen Namen mit mindestens 2 Zeichen ein.");
  }

  const { data, error } = await supabase.rpc("admin_update_profile_display_name", {
    target_user_id: input.userId,
    next_display_name: displayName,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Name konnte nicht gespeichert werden.") };
  }

  return ok(data);
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

export async function listMccSportContacts(supabase: AppSupabaseClient): Promise<ServiceResult<MccSportContact[]>> {
  const { data: contacts, error } = await supabase
    .from("sport_contacts")
    .select()
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !contacts) {
    return { data: null, error: fromPostgrestError(error, "Ansprechpartner konnten nicht geladen werden.") };
  }

  const sportIds = [...new Set(contacts.map((contact) => contact.sport_id))];
  const userIds = [...new Set(contacts.map((contact) => contact.user_id))];

  const [sportsResult, profilesResult] = await Promise.all([
    sportIds.length ? supabase.from("sports").select("id, name").in("id", sportIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? supabase.from("profiles").select("id, display_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (sportsResult.error || profilesResult.error || !sportsResult.data || !profilesResult.data) {
    return {
      data: null,
      error: fromPostgrestError(sportsResult.error ?? profilesResult.error, "Ansprechpartner konnten nicht vollständig geladen werden."),
    };
  }

  const sportNames = new Map(sportsResult.data.map((sport) => [sport.id, sport.name]));
  const profileNames = new Map(profilesResult.data.map((profile) => [profile.id, profile.display_name]));

  return ok(
    contacts.map((contact) => ({
      ...contact,
      sportName: sportNames.get(contact.sport_id) ?? "Sportart",
      displayName: profileNames.get(contact.user_id) ?? "Mitglied",
    })),
  );
}

export async function upsertMccSportContact(
  supabase: AppSupabaseClient,
  input: { sportId: string; userId: string; note?: string | null; isPrimary?: boolean },
): Promise<ServiceResult<Row<"sport_contacts">>> {
  const { data, error } = await supabase.rpc("admin_upsert_sport_contact", {
    target_sport_id: input.sportId,
    target_user_id: input.userId,
    contact_note: input.note ?? null,
    primary_contact: input.isPrimary ?? true,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Ansprechpartner konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function deleteMccSportContact(
  supabase: AppSupabaseClient,
  input: { sportId: string; userId: string },
): Promise<ServiceResult<{ deleted: true }>> {
  const { data, error } = await supabase.rpc("admin_delete_sport_contact", {
    target_sport_id: input.sportId,
    target_user_id: input.userId,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Ansprechpartner konnte nicht entfernt werden.") };
  }

  return ok({ deleted: true });
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
    sport_category: input.category.trim() || "unknown",
    sport_intensity: input.intensityLevel,
    sport_location_type: "flexible",
    sport_tags: (input.combinableTags ?? []).map((tag) => tag.trim()).filter(Boolean),
    sport_description: input.description?.trim() || null,
    sport_location_description: null,
    sport_is_active: input.isActive ?? true,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportart konnte nicht gespeichert werden.") };
  }

  const { data: updatedSport, error: iconError } = await supabase
    .from("sports")
    .update({ icon_name: input.iconName?.trim() || null })
    .eq("id", data.id)
    .select()
    .single();

  if (iconError || !updatedSport) {
    return { data: null, error: fromPostgrestError(iconError, "Sport-Icon konnte nicht gespeichert werden.") };
  }

  await removeLocalCache([ACTIVE_SPORTS_CACHE_KEY]);
  return ok(updatedSport);
}

export async function setMccSportActive(
  supabase: AppSupabaseClient,
  input: { sportId: string; isActive: boolean },
): Promise<ServiceResult<Row<"sports">>> {
  const { data, error } = await supabase
    .from("sports")
    .update({ is_active: input.isActive })
    .eq("id", input.sportId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportart konnte nicht geändert werden.") };
  }

  await removeLocalCache([ACTIVE_SPORTS_CACHE_KEY]);
  return ok(data);
}

export async function deleteMccSport(supabase: AppSupabaseClient, sportId: string): Promise<ServiceResult<{ deleted: true }>> {
  const { data, error } = await supabase.rpc("admin_delete_sport", { target_sport_id: sportId });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportart konnte nicht gelöscht werden.") };
  }

  await removeLocalCache([ACTIVE_SPORTS_CACHE_KEY]);
  return ok({ deleted: true });
}
