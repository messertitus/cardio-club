// Frontend-safe public types for the decision feature.
//
// SECURITY: This file holds ONLY data-shape and enum types (the I/O contract of
// the decision feature). The actual algorithm — scoring formulas, candidate
// ranking, fairness/no-go mechanics and the tuned DEFAULT_OPTIONS weights — lives
// exclusively server-side in supabase/functions/decision/. Never import that
// algorithm (or its ScoreBreakdown / CandidateScore / DecisionExplainability /
// FairConstellationOptions types) into client code: doing so ships the secret
// into the web/PWA bundle. The import-isolation test (tests/algorithmIsolation.test.ts)
// guards this.

export type ConstellationMode = "single" | "multi_sport" | "twin" | "none";
export type ActivityRole = "primary" | "secondary";
export type ParticipationStatus = "going" | "maybe" | "not_going";
export type ActualAttendanceStatus = "present" | "absent" | "excused" | "unknown";
export type ProfileLocationType = "indoor" | "outdoor" | "water" | "field" | "flexible";
export type ApRequirementLevel = "none" | "required" | "critical";
export type DecisionCharacter =
  | "clear_majority"
  | "fairness_adjusted"
  | "majority_protected"
  | "practicality_adjusted"
  | "weather_adjusted"
  | "combined_event"
  | "split_groups"
  | "fallback"
  | "no_valid_decision";

export type AbstractSport = {
  id: string;
  name?: string;
  category: string;
  intensityLevel?: "low" | "medium" | "high";
  combinableTags?: string[];
};

export type WeatherRules = {
  requiresDry?: boolean;
  rainSensitive?: boolean;
  heatSensitive?: boolean;
  coldSensitive?: boolean;
  thunderstormUnsafe?: boolean;
  maxPrecipitationMm?: number;
  minTemperatureC?: number;
  maxTemperatureC?: number;
  windSensitive?: boolean;
  maxWindKmh?: number;
  requiresDaylight?: boolean;
  slipperyWhenWet?: boolean;
};

export type SportProfile = {
  id: string;
  sportId: string;
  name: string;
  locationName?: string | null;
  postalCode?: string | null;
  venueGroupKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationType: ProfileLocationType;
  isIndoor?: boolean;
  minimumGroupSize?: number;
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
  apRequired?: boolean | null;
  apRequirementLevel?: ApRequirementLevel | null;
  apContactId?: string | null;
  weatherRules?: WeatherRules | null;
  isActive?: boolean;
};

export type WeatherCondition = {
  weatherCode?: number | null;
  temperatureC?: number | null;
  precipitationMm?: number | null;
  precipitationProbability?: number | null;
  windSpeedKmh?: number | null;
  windGustsKmh?: number | null;
};

export type ProfileWeatherSnapshot = Record<string, WeatherCondition | undefined>;
