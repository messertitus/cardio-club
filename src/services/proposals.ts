import type { Row } from "./database.types";
import { readLocalCache, writeLocalCache } from "./localCache";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export const ACTIVE_SPORTS_CACHE_KEY = "mcc.cache.activeSportsWithProfiles.v2";
const SHORT_CACHE_MS = 60_000;

export type ProposeSportInput = {
  eventId: string;
  sportId: string;
  proposedBy: string;
  note?: string | null;
};

export async function proposeSport(
  supabase: AppSupabaseClient,
  input: ProposeSportInput,
): Promise<ServiceResult<Row<"sport_proposals">>> {
  const { data, error } = await supabase
    .from("sport_proposals")
    .insert({
      event_id: input.eventId,
      sport_id: input.sportId,
      proposed_by: input.proposedBy,
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not propose sport.") };
  }

  return ok(data);
}

export async function listSports(supabase: AppSupabaseClient): Promise<ServiceResult<Row<"sports">[]>> {
  const cached = await readLocalCache<Row<"sports">[]>(ACTIVE_SPORTS_CACHE_KEY, SHORT_CACHE_MS);
  if (cached) return ok(cached);

  const [sportsResult, profilesResult] = await Promise.all([
    supabase.from("sports").select().eq("is_active", true).order("name", { ascending: true }),
    supabase.from("sport_profiles").select("id, sport_id").eq("is_active", true),
  ]);

  if (sportsResult.error || !sportsResult.data || profilesResult.error || !profilesResult.data) {
    return { data: null, error: fromPostgrestError(sportsResult.error ?? profilesResult.error, "Could not load sports.") };
  }

  const profileIds = profilesResult.data.map((profile) => profile.id);
  const linksResult = profileIds.length
    ? await supabase.from("sport_profile_sports").select().in("profile_id", profileIds)
    : { data: [] as Row<"sport_profile_sports">[], error: null };

  const sportIdsWithProfiles = new Set(profilesResult.data.map((profile) => profile.sport_id));
  if (!linksResult.error && linksResult.data) {
    for (const link of linksResult.data) {
      sportIdsWithProfiles.add(link.sport_id);
    }
  }

  const data = sportsResult.data.filter((sport) => sportIdsWithProfiles.has(sport.id));
  await writeLocalCache(ACTIVE_SPORTS_CACHE_KEY, data);

  return ok(data);
}

export async function listEventProposals(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_proposals">[]>> {
  const { data, error } = await supabase.from("sport_proposals").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load proposals.") };
  }

  return ok(data);
}
