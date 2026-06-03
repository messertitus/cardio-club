import type { ClubMemberRole, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type MccMember = {
  userId: string;
  displayName: string;
  phone: string | null;
  city: string | null;
  favoriteSports: string | null;
  birthDate: string | null;
  role: ClubMemberRole;
  joinedAt: string;
  contactSports: string[];
  stats: MccMemberStats;
};

export type MccMemberStats = {
  ideasSuggested: number;
  plannedAttendances: number;
  actualAttendances: number;
  noShows: number;
  reliabilityPercent: number | null;
};

export async function listMccMembers(
  supabase: AppSupabaseClient,
  input: { clubId: string },
): Promise<ServiceResult<MccMember[]>> {
  const { data: memberships, error } = await supabase
    .from("club_members")
    .select()
    .eq("club_id", input.clubId)
    .order("joined_at", { ascending: false });

  if (error || !memberships) {
    return { data: null, error: fromPostgrestError(error, "Mitglieder konnten nicht geladen werden.") };
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, phone, city, favorite_sports, birth_date").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name" | "phone" | "city" | "favorite_sports" | "birth_date">>, error: null };

  if (profilesError || !profiles) {
    return { data: null, error: fromPostgrestError(profilesError, "Profile konnten nicht geladen werden.") };
  }

  const names = new Map(profiles.map((profile) => [profile.id, toMemberDisplayName(profile.display_name)]));
  const phones = new Map(profiles.map((profile) => [profile.id, profile.phone]));
  const cities = new Map(profiles.map((profile) => [profile.id, profile.city]));
  const favoriteSports = new Map(profiles.map((profile) => [profile.id, profile.favorite_sports]));
  const birthDates = new Map(profiles.map((profile) => [profile.id, profile.birth_date]));
  const contactSports = await loadContactSports(supabase, userIds);
  if (contactSports.error) {
    return { data: null, error: contactSports.error };
  }
  const stats = await loadMemberStats(supabase, userIds);
  if (stats.error) {
    return { data: null, error: stats.error };
  }

  return ok(
    memberships.map((membership) => ({
      userId: membership.user_id,
      role: membership.role,
      joinedAt: membership.joined_at,
      displayName: names.get(membership.user_id) ?? "Mitglied",
      phone: phones.get(membership.user_id) ?? null,
      city: cities.get(membership.user_id) ?? null,
      favoriteSports: favoriteSports.get(membership.user_id) ?? null,
      birthDate: birthDates.get(membership.user_id) ?? null,
      contactSports: contactSports.data.get(membership.user_id) ?? [],
      stats: stats.data.get(membership.user_id) ?? emptyStats(),
    })),
  );
}

async function loadContactSports(supabase: AppSupabaseClient, userIds: string[]): Promise<ServiceResult<Map<string, string[]>>> {
  if (userIds.length === 0) return ok(new Map());

  const { data: profiles, error } = await supabase
    .from("sport_profiles")
    .select("ap_contact_id, name")
    .in("ap_contact_id", userIds)
    .eq("is_active", true);

  if (error || !profiles) {
    return { data: null, error: fromPostgrestError(error, "Profilkontakte konnten nicht geladen werden.") };
  }

  const result = new Map<string, string[]>();

  for (const profile of profiles) {
    if (!profile.ap_contact_id) continue;
    const next = result.get(profile.ap_contact_id) ?? [];
    next.push(profile.name);
    result.set(profile.ap_contact_id, next);
  }

  return ok(result);
}

async function loadMemberStats(supabase: AppSupabaseClient, userIds: string[]): Promise<ServiceResult<Map<string, MccMemberStats>>> {
  if (userIds.length === 0) return ok(new Map());

  const [ideasResult, attendanceResult] = await Promise.all([
    supabase.from("sport_ideas").select("suggested_by").in("suggested_by", userIds),
    supabase.from("attendance").select("user_id, status, actual_status").in("user_id", userIds),
  ]);

  if (ideasResult.error || attendanceResult.error || !ideasResult.data || !attendanceResult.data) {
    return { data: null, error: fromPostgrestError(ideasResult.error ?? attendanceResult.error, "Mitgliederstatistik konnte nicht geladen werden.") };
  }

  const result = new Map(userIds.map((userId) => [userId, emptyStats()]));
  for (const idea of ideasResult.data) {
    const stats = result.get(idea.suggested_by) ?? emptyStats();
    stats.ideasSuggested += 1;
    result.set(idea.suggested_by, stats);
  }

  for (const attendance of attendanceResult.data) {
    const stats = result.get(attendance.user_id) ?? emptyStats();
    if (attendance.status === "going" || attendance.status === "maybe") {
      stats.plannedAttendances += 1;
    }
    if (attendance.actual_status === "present") {
      stats.actualAttendances += 1;
    }
    if (attendance.actual_status === "absent") {
      stats.noShows += 1;
    }
    result.set(attendance.user_id, stats);
  }

  for (const stats of result.values()) {
    const reviewed = stats.actualAttendances + stats.noShows;
    stats.reliabilityPercent = reviewed > 0 ? Math.round((stats.actualAttendances / reviewed) * 100) : null;
  }

  return ok(result);
}

function emptyStats(): MccMemberStats {
  return {
    ideasSuggested: 0,
    plannedAttendances: 0,
    actualAttendances: 0,
    noShows: 0,
    reliabilityPercent: null,
  };
}

function toMemberDisplayName(value: string): string {
  const trimmed = value.trim();

  return trimmed.includes("@") ? "Mitglied" : trimmed || "Mitglied";
}
