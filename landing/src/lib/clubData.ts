// Resolves the data shown on the landing page at BUILD time.
//
// Priority: live Supabase (public RPC `landing_public_stats`) → local JSON
// fallback. The fetch is best-effort: if the env vars are missing, the network
// is unreachable, the migration isn't applied yet, or no venues exist, we fall
// back to the committed JSON so the build always succeeds and the map stays
// populated. The result is memoised so multiple components share one fetch.

import venuesFallback from '../data/venues.json';
import sportsCatalog from '../data/sports.json';
import club from '../data/club.json';

export interface Venue {
  name: string;
  area: string;
  lat: number;
  lng: number;
  sports: string[];
  sessions: number;
}

export interface Sport {
  name: string;
  icon: string | null;
}

export interface ClubData {
  city: string;
  region: string;
  members: number;
  membersIsEstimate: boolean;
  sportsActive: number;
  sports: Sport[];
  venues: Venue[];
  /** Cardiotage per week (configured recurring schedule). */
  weeklyCardiotage: number;
  /** true when numbers came from the live database, false when from JSON. */
  live: boolean;
}

/**
 * The sports actually on offer = those bookable at a real venue. Derived from
 * the venues so the page never lists a sport (e.g. Hiking) that has no location.
 */
export function offeredSports(venues: Venue[], meta: Sport[]): Sport[] {
  const iconByName = new Map(meta.map((s) => [s.name, s.icon]));
  const names = [...new Set(venues.flatMap((v) => v.sports))].sort((a, b) =>
    a.localeCompare(b, 'de'),
  );
  return names.map((name) => ({ name, icon: iconByName.get(name) ?? null }));
}

interface RpcVenue {
  name: string;
  lat: number;
  lng: number;
  sports: string[];
  sessions: number;
}
interface RpcStats {
  members: number;
  sports_active: number;
  weekly_cardiotage?: number;
  sports?: { name: string; icon: string | null }[];
  venues: RpcVenue[];
}

const fallback: ClubData = {
  city: club.city,
  region: club.region,
  members: club.members,
  membersIsEstimate: club.membersIsEstimate,
  sportsActive: sportsCatalog.length,
  sports: sportsCatalog as Sport[],
  venues: venuesFallback as Venue[],
  weeklyCardiotage: (club as { weeklyCardiotage?: number }).weeklyCardiotage ?? 0,
  live: false,
};

async function fetchLive(): Promise<ClubData> {
  // Merge OS env (process.env) with Astro's import.meta.env, and accept several
  // naming conventions so the same value works whether it's a PUBLIC_ var in
  // landing/.env or an exported EXPO_PUBLIC_* on the deploy server.
  const env: Record<string, string | undefined> = {
    ...(typeof process !== 'undefined' ? process.env : {}),
    ...import.meta.env,
  };
  const url =
    env.PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    env.PUBLIC_SUPABASE_ANON_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fallback;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/landing_public_stats`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      console.warn(`[clubData] RPC returned ${res.status}; using JSON fallback.`);
      return fallback;
    }
    const stats = (await res.json()) as RpcStats;
    const venues = (stats.venues ?? []).map((v) => ({
      name: v.name,
      area: club.city,
      lat: v.lat,
      lng: v.lng,
      sports: v.sports ?? [],
      sessions: v.sessions ?? 0,
    }));
    // Without live venues the map would be empty — keep the JSON seed instead.
    if (venues.length === 0) {
      console.warn('[clubData] live data has no venues; using JSON fallback for the map.');
    }
    const sports = (stats.sports ?? []).map((s) => ({ name: s.name, icon: s.icon ?? null }));
    return {
      city: club.city,
      region: club.region,
      members: stats.members ?? fallback.members,
      membersIsEstimate: false,
      sportsActive: stats.sports_active ?? fallback.sportsActive,
      sports: sports.length ? sports : fallback.sports,
      venues: venues.length ? venues : fallback.venues,
      weeklyCardiotage: stats.weekly_cardiotage ?? fallback.weeklyCardiotage,
      live: true,
    };
  } catch (err) {
    console.warn('[clubData] live fetch failed; using JSON fallback.', err);
    return fallback;
  }
}

let cached: Promise<ClubData> | null = null;
export function getClubData(): Promise<ClubData> {
  if (!cached) cached = fetchLive();
  return cached;
}
