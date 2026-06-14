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

export type SportProfileExportEntry = Row<"sport_profiles"> & { sportIds: string[]; sportNames: string[] };
export type SportProfileExport = {
  kind: "mcc.sportProfiles";
  version: 1;
  exportedAt: string;
  sports: { id: string; name: string }[];
  profiles: SportProfileExportEntry[];
};
export type SportProfileImportResult = { imported: number; failed: number; messages: string[] };

// Export every location profile together with the sports it offers (by id AND
// name), so a re-import can resolve sports even if the target database assigns
// different sport ids. Profile ids are preserved so re-importing updates in place.
export async function exportSportProfiles(supabase: AppSupabaseClient): Promise<ServiceResult<SportProfileExport>> {
  const [profilesResult, linksResult, sportsResult] = await Promise.all([
    supabase.from("sport_profiles").select().order("name", { ascending: true }),
    supabase.from("sport_profile_sports").select(),
    supabase.from("sports").select("id, name"),
  ]);

  if (profilesResult.error || !profilesResult.data) {
    return { data: null, error: fromPostgrestError(profilesResult.error, "Standorte konnten nicht exportiert werden.") };
  }
  if (sportsResult.error || !sportsResult.data) {
    return { data: null, error: fromPostgrestError(sportsResult.error, "Sportarten konnten nicht geladen werden.") };
  }

  const sportNameById = new Map(sportsResult.data.map((sport) => [sport.id, sport.name]));
  const links = linksResult.error ? [] : linksResult.data ?? [];
  const linkedByProfile = new Map<string, string[]>();
  for (const link of links) {
    linkedByProfile.set(link.profile_id, [...(linkedByProfile.get(link.profile_id) ?? []), link.sport_id]);
  }

  const profiles = profilesResult.data.map((profile) => {
    const sportIds = normalizeSportIds([...(linkedByProfile.get(profile.id) ?? []), profile.sport_id]);
    return {
      ...profile,
      sportIds,
      sportNames: sportIds.map((id) => sportNameById.get(id)).filter((name): name is string => Boolean(name)),
    };
  });

  return ok({
    kind: "mcc.sportProfiles",
    version: 1,
    exportedAt: new Date().toISOString(),
    sports: sportsResult.data.map((sport) => ({ id: sport.id, name: sport.name })),
    profiles,
  });
}

// Import a bundle produced by exportSportProfiles. Each profile is upserted by id
// (insert-with-id on a fresh database, update on the same one). Sports are matched
// by name first (robust across databases), then by id if the id still exists.
export async function importSportProfiles(
  supabase: AppSupabaseClient,
  bundle: unknown,
  createdBy: string | null,
): Promise<ServiceResult<SportProfileImportResult>> {
  if (!isSportProfileExport(bundle)) {
    return fail("Diese Datei ist kein gültiger Standort-Export.");
  }

  const sportsResult = await supabase.from("sports").select("id, name");
  if (sportsResult.error || !sportsResult.data) {
    return { data: null, error: fromPostgrestError(sportsResult.error, "Sportarten konnten nicht geladen werden.") };
  }
  const idByName = new Map(sportsResult.data.map((sport) => [sport.name.trim().toLowerCase(), sport.id]));
  const existingSportIds = new Set(sportsResult.data.map((sport) => sport.id));

  const result: SportProfileImportResult = { imported: 0, failed: 0, messages: [] };
  for (const profile of bundle.profiles) {
    const label = profile.location_name?.trim() || profile.name?.trim() || profile.id;
    const sportIds = resolveImportSportIds(profile, idByName, existingSportIds);
    if (sportIds.length === 0) {
      result.failed += 1;
      result.messages.push(`${label}: keine passende Sportart gefunden (bitte Sportarten zuerst anlegen).`);
      continue;
    }

    const locationName =
      profile.location_name?.trim() ||
      [profile.postal_code?.trim(), profile.location_city?.trim()].filter(Boolean).join(" ") ||
      profile.location_city?.trim() ||
      profile.postal_code?.trim() ||
      null;

    const upsert = await upsertSportProfile(supabase, {
      profileId: profile.id,
      sportIds,
      name: profile.name,
      locationName,
      mapUrl: profile.map_url,
      postalCode: profile.postal_code,
      locationCity: profile.location_city,
      latitude: profile.latitude,
      longitude: profile.longitude,
      venueGroupKey: profile.venue_group_key,
      locationType: profile.location_type,
      isIndoor: profile.is_indoor ?? profile.location_type === "indoor",
      minimumGroupSize: profile.minimum_group_size ?? 2,
      maximumGroupSize: profile.maximum_group_size,
      minimumParticipants: profile.minimum_participants ?? profile.minimum_group_size ?? 2,
      maximumParticipants: profile.maximum_participants ?? profile.maximum_group_size,
      requiredEquipment: profile.required_equipment ?? [],
      availableEquipment: profile.available_equipment ?? [],
      costNote: profile.cost_note,
      costRequired: profile.cost_required ?? Boolean(profile.cost_note?.trim()),
      costPerPerson: profile.cost_per_person,
      costCurrency: profile.cost_currency,
      openingNotes: profile.opening_notes,
      lightingAvailable: profile.lighting_available,
      transitNotes: profile.transit_notes,
      amenityNotes: profile.amenity_notes,
      reservationRequired: profile.reservation_required,
      safetyNotes: profile.safety_notes,
      locationRules: profile.location_rules,
      apRequired: profile.ap_required,
      apRequirementLevel: profile.ap_requirement_level,
      apContactId: profile.ap_contact_id,
      weatherRules: (profile.weather_rules ?? {}) as WeatherRules,
      isActive: profile.is_active,
      createdBy: profile.created_by ?? createdBy,
    });

    if (upsert.error) {
      result.failed += 1;
      result.messages.push(`${label}: ${upsert.error.message}`);
    } else {
      result.imported += 1;
    }
  }

  await clearSportProfileCaches();
  return ok(result);
}

function resolveImportSportIds(
  profile: SportProfileExportEntry,
  idByName: Map<string, string>,
  existingSportIds: Set<string>,
): string[] {
  const resolved: string[] = [];
  profile.sportIds.forEach((sportId, index) => {
    const byName = profile.sportNames[index] ? idByName.get(profile.sportNames[index].trim().toLowerCase()) : undefined;
    const id = byName ?? (existingSportIds.has(sportId) ? sportId : undefined);
    if (id) resolved.push(id);
  });
  // Fall back to any name match when ids/order drifted.
  if (resolved.length === 0) {
    for (const name of profile.sportNames) {
      const id = idByName.get(name.trim().toLowerCase());
      if (id) resolved.push(id);
    }
  }
  return normalizeSportIds(resolved);
}

function isSportProfileExport(value: unknown): value is SportProfileExport {
  if (!value || typeof value !== "object") return false;
  const bundle = value as Partial<SportProfileExport>;
  return bundle.kind === "mcc.sportProfiles" && Array.isArray(bundle.profiles);
}

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

// Assign one sport to several existing location profiles at once, without
// touching the sports those profiles already offer. Idempotent: re-linking an
// existing pairing is a no-op (primary key on profile_id, sport_id).
export async function linkSportToProfiles(
  supabase: AppSupabaseClient,
  input: { sportId: string; profileIds: string[] },
): Promise<ServiceResult<{ linked: number }>> {
  const profileIds = [...new Set(input.profileIds.map((id) => id.trim()).filter(Boolean))];
  if (!input.sportId.trim()) return fail("Bitte wähle eine Sportart aus.");
  if (profileIds.length === 0) return fail("Bitte wähle mindestens einen Standort aus.");

  const rows = profileIds.map((profileId) => ({ profile_id: profileId, sport_id: input.sportId }));
  const { error } = await supabase.from("sport_profile_sports").upsert(rows, { onConflict: "profile_id,sport_id", ignoreDuplicates: true });
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Sportart konnte den Standorten nicht zugeordnet werden.") };
  }

  await clearSportProfileCaches();
  return ok({ linked: profileIds.length });
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
