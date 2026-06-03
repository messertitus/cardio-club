import type { SportProfile, WeatherRules } from "../lib/fairConstellationSelection";
import type { Row, SportLocationType } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type SportProfileAdminInput = {
  profileId?: string | null;
  sportId: string;
  name: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  venueGroupKey?: string | null;
  locationType: SportLocationType;
  isIndoor?: boolean;
  minimumGroupSize?: number;
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
  apRequired?: boolean;
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

  const { data, error } = await supabase
    .from("sport_profiles")
    .upsert(
      {
        id: input.profileId ?? undefined,
        sport_id: input.sportId,
        name: input.name.trim(),
        location_name: input.locationName?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        venue_group_key: input.venueGroupKey?.trim() || null,
        location_type: input.locationType,
        is_indoor: input.isIndoor ?? input.locationType === "indoor",
        minimum_group_size: input.minimumGroupSize ?? 1,
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
        ap_required: input.apRequired ?? false,
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
    lightingAvailable: row.lighting_available,
    reservationRequired: row.reservation_required,
    apRequired: row.ap_required,
    weatherRules: isWeatherRules(row.weather_rules) ? row.weather_rules : {},
    isActive: row.is_active,
  };
}

function isWeatherRules(value: unknown): value is WeatherRules {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
