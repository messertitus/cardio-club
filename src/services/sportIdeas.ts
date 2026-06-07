import type { Json, Row, SportLocationType } from "./database.types";
import { readLocalCache, removeLocalCache, writeLocalCache } from "./localCache";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type SportIdeaDraftStep = "location" | "essentials" | "optional" | "review";
export type SportIdeaLocationMode = Row<"sport_ideas">["location_mode"];
const SPORT_IDEAS_CACHE_KEY = "mcc.cache.sportIdeas.v1";
const SHORT_CACHE_MS = 30_000;

export type SportIdeaWithCreator = Row<"sport_ideas"> & {
  creatorName: string;
  creatorCity: string | null;
  sportName: string | null;
  sportNames: string[];
};

export type SportIdeaInput = {
  ideaId?: string | null;
  userId: string;
  name?: string | null;
  sportId?: string | null;
  sportIds?: string[];
  profileName?: string | null;
  note?: string | null;
  locationMode?: SportIdeaLocationMode;
  location?: string | null;
  postalCode?: string | null;
  locationCity?: string | null;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  preferredTime?: string | null;
  locationType?: SportLocationType | null;
  minimumGroupSize?: number | null;
  maximumGroupSize?: number | null;
  requiredEquipment?: string[];
  availableEquipment?: string[];
  costNote?: string | null;
  openingNotes?: string | null;
  transitNotes?: string | null;
  amenityNotes?: string | null;
  reservationRequired?: boolean | null;
  lightingAvailable?: boolean | null;
  safetyNotes?: string | null;
  locationRules?: string | null;
  apRequired?: boolean;
  weatherRules?: Json;
  draftStep?: SportIdeaDraftStep;
  reviewNote?: string | null;
};

export async function listSportIdeas(supabase: AppSupabaseClient): Promise<ServiceResult<SportIdeaWithCreator[]>> {
  const cached = await readLocalCache<SportIdeaWithCreator[]>(SPORT_IDEAS_CACHE_KEY, SHORT_CACHE_MS);
  if (cached) return ok(cached);

  const { data, error } = await supabase.from("sport_ideas").select().order("created_at", { ascending: false }).limit(50);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportideen konnten nicht geladen werden.") };
  }

  const userIds = [...new Set(data.map((idea) => idea.suggested_by))];
  const sportIds = [...new Set(data.flatMap((idea) => ideaSportIds(idea)))];
  const [profilesResult, sportsResult] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, display_name, city").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    sportIds.length ? supabase.from("sports").select("id, name").in("id", sportIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || sportsResult.error || !profilesResult.data || !sportsResult.data) {
    return {
      data: null,
      error: fromPostgrestError(profilesResult.error ?? sportsResult.error, "Sportideen konnten nicht vollstaendig geladen werden."),
    };
  }

  const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  const sportNames = new Map(sportsResult.data.map((sport) => [sport.id, sport.name]));

  const result = data.map((idea) => {
      const profile = profiles.get(idea.suggested_by);
      return {
        ...idea,
        creatorName: profile?.display_name ?? "Mitglied",
        creatorCity: profile?.city ?? null,
        sportNames: ideaSportIds(idea).map((sportId) => sportNames.get(sportId)).filter((name): name is string => Boolean(name)),
        sportName: ideaSportIds(idea).map((sportId) => sportNames.get(sportId)).filter(Boolean).join(", ") || null,
      };
    });
  await writeLocalCache(SPORT_IDEAS_CACHE_KEY, result);
  return ok(result);
}

export async function suggestSportIdea(
  supabase: AppSupabaseClient,
  input: { userId: string; name: string; note?: string | null; location?: string | null; preferredTime?: string | null },
): Promise<ServiceResult<Row<"sport_ideas">>> {
  return submitSportIdea(supabase, {
    userId: input.userId,
    name: input.name,
    profileName: input.name,
    note: input.note,
    location: input.location,
    preferredTime: input.preferredTime,
    locationMode: input.location ? "fixed" : "flexible",
    locationType: "flexible",
  });
}

export async function saveSportIdeaDraft(
  supabase: AppSupabaseClient,
  input: SportIdeaInput,
): Promise<ServiceResult<Row<"sport_ideas">>> {
  const payload = ideaPayload(input, true);
  const query = input.ideaId
    ? supabase.from("sport_ideas").update(payload).eq("id", input.ideaId).select().single()
    : supabase.from("sport_ideas").insert({ ...payload, suggested_by: input.userId }).select().single();
  const { data, error } = await query;

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Entwurf konnte nicht gespeichert werden.") };
  }

  await removeLocalCache([SPORT_IDEAS_CACHE_KEY]);
  return ok(data);
}

export async function submitSportIdea(
  supabase: AppSupabaseClient,
  input: SportIdeaInput,
): Promise<ServiceResult<Row<"sport_ideas">>> {
  const validation = validateIdeaForSubmit(input);
  if (validation) return fail(validation);

  const payload = ideaPayload(input, false);
  const query = input.ideaId
    ? supabase.from("sport_ideas").update(payload).eq("id", input.ideaId).select().single()
    : supabase.from("sport_ideas").insert({ ...payload, suggested_by: input.userId }).select().single();
  const { data, error } = await query;

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportidee konnte nicht eingereicht werden.") };
  }

  await removeLocalCache([SPORT_IDEAS_CACHE_KEY]);
  return ok(data);
}

export async function saveSportIdeaAdminEdits(
  supabase: AppSupabaseClient,
  input: SportIdeaInput,
): Promise<ServiceResult<Row<"sport_ideas">>> {
  if (!input.ideaId) return fail("Bitte wähle eine Idee aus.");
  const { data, error } = await supabase
    .from("sport_ideas")
    .update(ideaPayload(input, false))
    .eq("id", input.ideaId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportidee konnte nicht ergänzt werden.") };
  }

  await removeLocalCache([SPORT_IDEAS_CACHE_KEY]);
  return ok(data);
}

export async function reviewSportIdea(
  supabase: AppSupabaseClient,
  input: { ideaId: string; status: "approved" | "rejected"; reviewedBy?: string | null; reviewNote?: string | null },
): Promise<ServiceResult<Row<"sport_ideas">>> {
  const { data, error } = await supabase
    .from("sport_ideas")
    .update({
      status: input.status,
      is_draft: false,
      reviewed_by: input.reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote?.trim() || null,
    })
    .eq("id", input.ideaId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportidee konnte nicht geprüft werden.") };
  }

  await removeLocalCache([SPORT_IDEAS_CACHE_KEY]);
  return ok(data);
}

export async function isCurrentUserAdmin(supabase: AppSupabaseClient, userId: string): Promise<ServiceResult<boolean>> {
  const rpcResult = await supabase.rpc("is_current_mcc_admin");
  if (!rpcResult.error && typeof rpcResult.data === "boolean") {
    return ok(rpcResult.data);
  }

  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Rolle konnte nicht geladen werden.") };
  }

  if (data?.role === "admin") {
    return ok(true);
  }

  const { data: memberships, error: membershipError } = await supabase.from("club_members").select("role").eq("user_id", userId);

  if (membershipError || !memberships) {
    return { data: null, error: fromPostgrestError(membershipError, "Rolle konnte nicht geladen werden.") };
  }

  return ok(memberships.some((membership) => membership.role === "admin"));
}

function ideaPayload(input: SportIdeaInput, isDraft: boolean): Omit<Partial<Row<"sport_ideas">>, "id" | "suggested_by" | "created_at"> {
  const sportIds = normalizeSportIds(input.sportIds ?? (input.sportId ? [input.sportId] : []));
  return {
    name: textOrNull(input.name),
    profile_name: textOrNull(input.profileName) ?? textOrNull(input.name),
    note: textOrNull(input.note),
    sport_id: sportIds[0] ?? input.sportId ?? null,
    sport_ids: sportIds,
    location_mode: input.locationMode ?? "fixed",
    location: textOrNull(input.location),
    postal_code: textOrNull(input.postalCode),
    location_city: textOrNull(input.locationCity),
    map_url: textOrNull(input.mapUrl),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    preferred_time: textOrNull(input.preferredTime),
    location_type: input.locationType ?? null,
    minimum_group_size: input.minimumGroupSize ?? null,
    maximum_group_size: input.maximumGroupSize ?? null,
    required_equipment: input.requiredEquipment ?? [],
    available_equipment: input.availableEquipment ?? [],
    cost_note: textOrNull(input.costNote),
    opening_notes: textOrNull(input.openingNotes),
    transit_notes: textOrNull(input.transitNotes),
    amenity_notes: textOrNull(input.amenityNotes),
    reservation_required: input.reservationRequired ?? null,
    lighting_available: input.lightingAvailable ?? null,
    safety_notes: textOrNull(input.safetyNotes),
    location_rules: textOrNull(input.locationRules),
    ap_required: input.apRequired ?? false,
    weather_rules: input.weatherRules ?? {},
    is_draft: isDraft,
    draft_step: input.draftStep ?? "location",
    status: "pending",
    review_note: textOrNull(input.reviewNote),
  };
}

function ideaSportIds(idea: Pick<Row<"sport_ideas">, "sport_id" | "sport_ids">): string[] {
  return normalizeSportIds([...(idea.sport_ids ?? []), ...(idea.sport_id ? [idea.sport_id] : [])]);
}

function normalizeSportIds(sportIds: string[]): string[] {
  return [...new Set(sportIds.map((sportId) => sportId.trim()).filter(Boolean))];
}

function validateIdeaForSubmit(input: SportIdeaInput): string | null {
  if (!textOrNull(input.name)) return "Bitte gib der Idee einen Namen.";
  if (!textOrNull(input.profileName) && !textOrNull(input.name)) return "Bitte gib einen Profilnamen an.";
  if (!input.locationMode) return "Bitte wähle aus, ob der Standort fest oder flexibel ist.";
  if (input.locationMode === "fixed" && !textOrNull(input.location)) {
    return "Bitte gib einen kurzen Standortnamen an.";
  }
  if (input.locationMode === "flexible" && !textOrNull(input.locationCity) && !textOrNull(input.postalCode)) {
    return "Bitte gib für flexible Ideen mindestens Stadt oder PLZ an.";
  }
  if (!input.locationType) return "Bitte wähle Indoor, Outdoor oder flexibel.";
  if (!input.minimumGroupSize || input.minimumGroupSize < 1) return "Bitte gib die Mindestanzahl an.";
  if (input.maximumGroupSize && input.maximumGroupSize < input.minimumGroupSize) {
    return "Die Maximalanzahl muss größer oder gleich der Mindestanzahl sein.";
  }
  return null;
}

function textOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
