import type { ApRequirementLevel, SportProfile, WeatherRules } from "../lib/decisionTypes";
import type { Row, SportLocationType } from "./database.types";
import { readLocalCache, removeLocalCache, writeLocalCache } from "./localCache";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

const SPORT_PROFILES_CACHE_KEY = "mcc.cache.sportProfiles.v2";
const SPORT_PROFILE_LINKS_CACHE_KEY = "mcc.cache.sportProfileLinks.v2";
const ACTIVE_SPORTS_CACHE_KEY = "mcc.cache.activeSportsWithProfiles.v2";
const SHORT_CACHE_MS = 60_000;

export type SportProfileAdminInput = {
  profileId?: string | null;
  sportId?: string;
  sportIds?: string[];
  name: string;
  locationName?: string | null;
  mapUrl?: string | null;
  postalCode?: string | null;
  locationCity?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  venueGroupKey?: string | null;
  locationType: SportLocationType;
  isIndoor?: boolean;
  minimumGroupSize?: number | null;
  maximumGroupSize?: number | null;
  minimumParticipants?: number | null;
  maximumParticipants?: number | null;
  requiredEquipment?: string[];
  availableEquipment?: string[];
  costNote?: string | null;
  costRequired?: boolean | null;
  costPerPerson?: number | null;
  costCurrency?: string | null;
  openingNotes?: string | null;
  lightingAvailable?: boolean | null;
  transitNotes?: string | null;
  amenityNotes?: string | null;
  reservationRequired?: boolean | null;
  safetyNotes?: string | null;
  locationRules?: string | null;
  apRequired?: boolean;
  apRequirementLevel?: ApRequirementLevel;
  apContactId?: string | null;
  weatherRules?: WeatherRules;
  isActive?: boolean;
  createdBy?: string | null;
};

export async function listSportProfileSportLinks(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<Row<"sport_profile_sports">[]>> {
  const cached = await readLocalCache<Row<"sport_profile_sports">[]>(SPORT_PROFILE_LINKS_CACHE_KEY, SHORT_CACHE_MS);
  if (cached) return ok(cached);

  const { data, error } = await supabase.from("sport_profile_sports").select().order("sport_id", { ascending: true });

  if (error || !data) {
    if (isMissingRelationError(error)) return ok([]);
    return { data: null, error: fromPostgrestError(error, "Sportprofil-Zuordnungen konnten nicht geladen werden.") };
  }

  await writeLocalCache(SPORT_PROFILE_LINKS_CACHE_KEY, data);
  return ok(data);
}

export async function listSportProfiles(supabase: AppSupabaseClient): Promise<ServiceResult<Row<"sport_profiles">[]>> {
  const cached = await readLocalCache<Row<"sport_profiles">[]>(SPORT_PROFILES_CACHE_KEY, SHORT_CACHE_MS);
  if (cached) return ok(cached);

  const { data, error } = await supabase
    .from("sport_profiles")
    .select()
    .order("sport_id", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportprofile konnten nicht geladen werden.") };
  }

  await writeLocalCache(SPORT_PROFILES_CACHE_KEY, data);
  return ok(data);
}

export async function listSportProfilesForSports(
  supabase: AppSupabaseClient,
  sportIds: string[],
): Promise<ServiceResult<Row<"sport_profiles">[]>> {
  const normalizedSportIds = normalizeSportIds(sportIds);
  if (normalizedSportIds.length === 0) {
    return ok([]);
  }

  const linksResult = await supabase
    .from("sport_profile_sports")
    .select()
    .in("sport_id", normalizedSportIds);

  if (linksResult.error) {
    if (!isMissingRelationError(linksResult.error)) {
      return { data: null, error: fromPostgrestError(linksResult.error, "Sportprofile konnten nicht geladen werden.") };
    }
    return loadLegacyProfilesForSports(supabase, normalizedSportIds);
  }

  const linkedProfileIds = [...new Set((linksResult.data ?? []).map((link) => link.profile_id))];
  const linkedRows = linkedProfileIds.length
    ? await supabase.from("sport_profiles").select().in("id", linkedProfileIds).eq("is_active", true).order("name", { ascending: true })
    : { data: [] as Row<"sport_profiles">[], error: null };

  if (linkedRows.error || !linkedRows.data) {
    return { data: null, error: fromPostgrestError(linkedRows.error, "Sportprofile konnten nicht geladen werden.") };
  }

  const legacyRows = await loadLegacyProfilesForSports(supabase, normalizedSportIds);
  if (legacyRows.error) return legacyRows;

  const profilesById = new Map(linkedRows.data.map((profile) => [profile.id, profile]));
  const result = new Map<string, Row<"sport_profiles">>();
  for (const link of linksResult.data ?? []) {
    const profile = profilesById.get(link.profile_id);
    if (!profile?.is_active) continue;
    result.set(`${profile.id}:${link.sport_id}`, { ...profile, sport_id: link.sport_id });
  }
  for (const profile of legacyRows.data) {
    result.set(`${profile.id}:${profile.sport_id}`, profile);
  }

  return ok([...result.values()].sort((a, b) => a.name.localeCompare(b.name)));
}

async function loadLegacyProfilesForSports(
  supabase: AppSupabaseClient,
  sportIds: string[],
): Promise<ServiceResult<Row<"sport_profiles">[]>> {
  const { data, error } = await supabase
    .from("sport_profiles")
    .select()
    .in("sport_id", sportIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportprofile konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function upsertSportProfile(
  supabase: AppSupabaseClient,
  input: SportProfileAdminInput,
): Promise<ServiceResult<Row<"sport_profiles">>> {
  if (!input.name.trim()) {
    return fail("Bitte gib einen Profilnamen ein.");
  }
  const sportIds = normalizeSportIds(input.sportIds ?? (input.sportId ? [input.sportId] : []));
  const primarySportId = sportIds[0];
  if (!primarySportId) {
    return fail("Bitte wähle mindestens eine zugehörige Sportart aus.");
  }
  if (!input.locationName?.trim()) {
    return fail("Bitte gib einen kurzen Standortnamen ein.");
  }
  if (!input.minimumGroupSize || input.minimumGroupSize < 1) {
    return fail("Bitte gib die Mindestanzahl an.");
  }
  if (input.maximumGroupSize && input.maximumGroupSize < input.minimumGroupSize) {
    return fail("Die Maximalanzahl muss größer oder gleich der Mindestanzahl sein.");
  }
  if (input.minimumParticipants && input.minimumParticipants < 1) {
    return fail("Die Standort-Mindestanzahl muss mindestens 1 sein.");
  }
  if (input.maximumParticipants && input.minimumParticipants && input.maximumParticipants < input.minimumParticipants) {
    return fail("Die Standort-Maximalanzahl muss größer oder gleich der Standort-Mindestanzahl sein.");
  }

  const apContactId = input.apContactId ?? input.createdBy ?? null;
  const apRequirementLevel = input.apRequirementLevel ?? (input.apRequired ? "required" : "none");

  const { data, error } = await supabase
    .from("sport_profiles")
    .upsert(
      {
        id: input.profileId ?? undefined,
        sport_id: primarySportId,
        name: input.name.trim(),
        location_name: input.locationName?.trim() || null,
        map_url: input.mapUrl?.trim() || null,
        postal_code: input.postalCode?.trim() || null,
        location_city: input.locationCity?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        venue_group_key: input.venueGroupKey?.trim() || deriveVenueGroupKey(input.locationName ?? input.locationCity ?? null),
        location_type: input.locationType,
        is_indoor: input.isIndoor ?? input.locationType === "indoor",
        minimum_group_size: input.minimumGroupSize,
        maximum_group_size: input.maximumGroupSize ?? null,
        minimum_participants: input.minimumParticipants ?? input.minimumGroupSize,
        maximum_participants: input.maximumParticipants ?? input.maximumGroupSize ?? null,
        required_equipment: input.requiredEquipment ?? [],
        available_equipment: input.availableEquipment ?? [],
        cost_note: input.costNote?.trim() || null,
        cost_required: input.costRequired ?? Boolean(input.costNote?.trim()),
        cost_per_person: input.costPerPerson ?? null,
        cost_currency: input.costCurrency?.trim() || "EUR",
        opening_notes: input.openingNotes?.trim() || null,
        lighting_available: input.lightingAvailable ?? null,
        transit_notes: input.transitNotes?.trim() || null,
        amenity_notes: input.amenityNotes?.trim() || null,
        reservation_required: input.reservationRequired ?? null,
        safety_notes: input.safetyNotes?.trim() || null,
        location_rules: input.locationRules?.trim() || null,
        ap_required: apRequirementLevel !== "none",
        ap_requirement_level: apRequirementLevel,
        ap_contact_id: apContactId,
        weather_rules: input.weatherRules ?? {},
        is_active: input.isActive ?? true,
        created_by: input.createdBy ?? null,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportprofil konnte nicht gespeichert werden.") };
  }

  const linkResult = await replaceSportProfileLinks(supabase, data.id, sportIds);
  if (linkResult.error) {
    return { data: null, error: linkResult.error };
  }

  await clearSportProfileCaches();
  return ok(data);
}

async function replaceSportProfileLinks(
  supabase: AppSupabaseClient,
  profileId: string,
  sportIds: string[],
): Promise<ServiceResult<{ saved: true }>> {
  const deleteResult = await supabase.from("sport_profile_sports").delete().eq("profile_id", profileId);
  if (deleteResult.error) {
    if (isMissingRelationError(deleteResult.error)) return ok({ saved: true });
    return { data: null, error: fromPostgrestError(deleteResult.error, "Sportprofil-Zuordnungen konnten nicht gespeichert werden.") };
  }

  const rows = sportIds.map((sportId) => ({ profile_id: profileId, sport_id: sportId }));
  const insertResult = rows.length ? await supabase.from("sport_profile_sports").insert(rows) : { error: null };
  if (insertResult.error) {
    return { data: null, error: fromPostgrestError(insertResult.error, "Sportprofil-Zuordnungen konnten nicht gespeichert werden.") };
  }

  return ok({ saved: true });
}

export async function deleteSportProfile(
  supabase: AppSupabaseClient,
  profileId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const { error } = await supabase.from("sport_profiles").delete().eq("id", profileId);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Sportprofil konnte nicht gelöscht werden.") };
  }

  await clearSportProfileCaches();
  return ok({ deleted: true });
}

export async function setSportProfileActive(
  supabase: AppSupabaseClient,
  input: { profileId: string; isActive: boolean },
): Promise<ServiceResult<Row<"sport_profiles">>> {
  const { data, error } = await supabase
    .from("sport_profiles")
    .update({ is_active: input.isActive })
    .eq("id", input.profileId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportprofil konnte nicht geändert werden.") };
  }

  await clearSportProfileCaches();
  return ok(data);
}

async function clearSportProfileCaches() {
  await removeLocalCache([SPORT_PROFILES_CACHE_KEY, SPORT_PROFILE_LINKS_CACHE_KEY, ACTIVE_SPORTS_CACHE_KEY]);
}

export function mapSportProfile(row: Row<"sport_profiles">): SportProfile {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    locationName: row.location_name,
    postalCode: row.postal_code,
    venueGroupKey: row.venue_group_key,
    latitude: row.latitude,
    longitude: row.longitude,
    locationType: row.location_type,
    isIndoor: row.is_indoor,
    minimumGroupSize: row.minimum_group_size,
    maximumGroupSize: row.maximum_group_size,
    minimumParticipants: row.minimum_participants,
    maximumParticipants: row.maximum_participants,
    requiredEquipment: row.required_equipment,
    availableEquipment: row.available_equipment,
    costNote: row.cost_note,
    costRequired: row.cost_required,
    costPerPerson: row.cost_per_person,
    costCurrency: row.cost_currency,
    openingNotes: row.opening_notes,
    lightingAvailable: row.lighting_available,
    transitNotes: row.transit_notes,
    amenityNotes: row.amenity_notes,
    reservationRequired: row.reservation_required,
    safetyNotes: row.safety_notes,
    locationRules: row.location_rules,
    apRequired: row.ap_required,
    apRequirementLevel: row.ap_requirement_level,
    apContactId: row.ap_contact_id,
    weatherRules: isWeatherRules(row.weather_rules) ? row.weather_rules : {},
    isActive: row.is_active,
  };
}

function isWeatherRules(value: unknown): value is WeatherRules {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deriveVenueGroupKey(value: string | null): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || null;
}

function normalizeSportIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isMissingRelationError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : "";
  return code === "42P01" || message.includes("sport_profile_sports");
}
