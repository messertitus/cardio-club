import type { SportProfile, WeatherRules } from "../lib/fairConstellationSelection";
import type { Row, SportLocationType } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type SportProfileAdminInput = {
  profileId?: string | null;
  sportId: string;
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
  requiredEquipment?: string[];
  availableEquipment?: string[];
  costNote?: string | null;
  openingNotes?: string | null;
  lightingAvailable?: boolean | null;
  transitNotes?: string | null;
  amenityNotes?: string | null;
  reservationRequired?: boolean | null;
  safetyNotes?: string | null;
  locationRules?: string | null;
  apRequired?: boolean;
  apContactId?: string | null;
  weatherRules?: WeatherRules;
  isActive?: boolean;
  createdBy?: string | null;
};

export async function listSportProfiles(supabase: AppSupabaseClient): Promise<ServiceResult<Row<"sport_profiles">[]>> {
  const { data, error } = await supabase
    .from("sport_profiles")
    .select()
    .order("sport_id", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportprofile konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function listSportProfilesForSports(
  supabase: AppSupabaseClient,
  sportIds: string[],
): Promise<ServiceResult<Row<"sport_profiles">[]>> {
  if (sportIds.length === 0) {
    return ok([]);
  }

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
  if (!input.sportId) {
    return fail("Bitte wähle die zugehörige Sportart aus.");
  }
  if (!input.locationName?.trim() && !input.locationCity?.trim() && !input.mapUrl?.trim()) {
    return fail("Bitte hinterlege einen Standort oder eine Stadt.");
  }
  if (!input.minimumGroupSize || input.minimumGroupSize < 1) {
    return fail("Bitte gib die Mindestanzahl an.");
  }
  if (input.maximumGroupSize && input.maximumGroupSize < input.minimumGroupSize) {
    return fail("Die Maximalanzahl muss größer oder gleich der Mindestanzahl sein.");
  }

  const apContactId = input.apContactId ?? input.createdBy ?? null;

  const { data, error } = await supabase
    .from("sport_profiles")
    .upsert(
      {
        id: input.profileId ?? undefined,
        sport_id: input.sportId,
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
        required_equipment: input.requiredEquipment ?? [],
        available_equipment: input.availableEquipment ?? [],
        cost_note: input.costNote?.trim() || null,
        opening_notes: input.openingNotes?.trim() || null,
        lighting_available: input.lightingAvailable ?? null,
        transit_notes: input.transitNotes?.trim() || null,
        amenity_notes: input.amenityNotes?.trim() || null,
        reservation_required: input.reservationRequired ?? null,
        safety_notes: input.safetyNotes?.trim() || null,
        location_rules: input.locationRules?.trim() || null,
        ap_required: input.apRequired ?? false,
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

  return ok(data);
}

export async function deleteSportProfile(
  supabase: AppSupabaseClient,
  profileId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const { error } = await supabase.from("sport_profiles").delete().eq("id", profileId);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Sportprofil konnte nicht geloescht werden.") };
  }

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

  return ok(data);
}

export function mapSportProfile(row: Row<"sport_profiles">): SportProfile {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    locationName: row.location_name,
    venueGroupKey: row.venue_group_key,
    latitude: row.latitude,
    longitude: row.longitude,
    locationType: row.location_type,
    isIndoor: row.is_indoor,
    minimumGroupSize: row.minimum_group_size,
    maximumGroupSize: row.maximum_group_size,
    requiredEquipment: row.required_equipment,
    availableEquipment: row.available_equipment,
    costNote: row.cost_note,
    openingNotes: row.opening_notes,
    lightingAvailable: row.lighting_available,
    transitNotes: row.transit_notes,
    amenityNotes: row.amenity_notes,
    reservationRequired: row.reservation_required,
    safetyNotes: row.safety_notes,
    locationRules: row.location_rules,
    apRequired: row.ap_required,
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
