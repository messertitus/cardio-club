import type { ClubMemberRole, Row } from "./database.types";
import { readLocalCache, writeLocalCache } from "./localCache";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

const MEMBERS_CACHE_PREFIX = "mcc.cache.members.";
const SHORT_CACHE_MS = 60_000;

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

// Aggregate-only count for the logged-out auth screen. Anon-callable RPC that
// returns just a number (no PII). Returns null on any error so the UI can simply
// hide the line instead of breaking.
export async function getPublicMemberCount(supabase: AppSupabaseClient): Promise<number | null> {
  const { data, error } = await supabase.rpc("public_member_count");
  if (error) return null;
  // PostgREST may serialize a scalar bigint/int as a number or a string; coerce.
  const count = typeof data === "number" ? data : Number(data);
  return Number.isFinite(count) ? count : null;
}

export async function listMccMembers(
  supabase: AppSupabaseClient,
  input: { clubId: string; bypassCache?: boolean },
): Promise<ServiceResult<MccMember[]>> {
  const cacheKey = `${MEMBERS_CACHE_PREFIX}${input.clubId}`;
  const cached = input.bypassCache ? null : await readLocalCache<MccMember[]>(cacheKey, SHORT_CACHE_MS);
  if (cached) return ok(cached);

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

  const result = memberships
    .map((membership) => ({
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
    }))
    .filter((member) => member.displayName.trim().toLowerCase() !== "testuser");

  await writeLocalCache(cacheKey, result);
  return ok(result);
}

async function loadContactSports(supabase: AppSupabaseClient, userIds: string[]): Promise<ServiceResult<Map<string, string[]>>> {
  if (userIds.length === 0) return ok(new Map());

  const { data: profiles, error } = await supabase
    .from("sport_profiles")
    .select("id, sport_id, ap_contact_id, name, location_name")
    .in("ap_contact_id", userIds)
    .eq("is_active", true);

  if (error || !profiles) {
    return { data: null, error: fromPostgrestError(error, "Profilkontakte konnten nicht geladen werden.") };
  }

  const result = new Map<string, string[]>();
  const profileIds = profiles.map((profile) => profile.id);
  const linksResult = profileIds.length
    ? await supabase.from("sport_profile_sports").select().in("profile_id", profileIds)
    : { data: [] as Row<"sport_profile_sports">[], error: null };
  const usableLinks = linksResult.error ? [] : linksResult.data ?? [];
  const sportIds = [
    ...new Set([
      ...profiles.map((profile) => profile.sport_id),
      ...usableLinks.map((link) => link.sport_id),
    ]),
  ];
  const sportsResult = sportIds.length
    ? await supabase.from("sports").select("id, name").in("id", sportIds)
    : { data: [] as Array<Pick<Row<"sports">, "id" | "name">>, error: null };

  if (sportsResult.error || !sportsResult.data) {
    return { data: null, error: fromPostgrestError(sportsResult.error, "Profilkontakte konnten nicht geladen werden.") };
  }

  const sportNames = new Map(sportsResult.data.map((sport) => [sport.id, sport.name]));
  const linksByProfileId = new Map<string, string[]>();
  for (const link of usableLinks) {
    const next = linksByProfileId.get(link.profile_id) ?? [];
    next.push(link.sport_id);
    linksByProfileId.set(link.profile_id, next);
  }

  for (const profile of profiles) {
    if (!profile.ap_contact_id) continue;
    const next = result.get(profile.ap_contact_id) ?? [];
    const linkedSportIds = linksByProfileId.get(profile.id) ?? [profile.sport_id];
    const location = profile.location_name ?? profile.name;
    for (const sportId of linkedSportIds) {
      next.push(`${sportNames.get(sportId) ?? "Sportart"}: ${location}`);
    }
    result.set(profile.ap_contact_id, next);
  }

  for (const [userId, labels] of result) {
    result.set(userId, [...new Set(labels)].sort((a, b) => a.localeCompare(b)));
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
