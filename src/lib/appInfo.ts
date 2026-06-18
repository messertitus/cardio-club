// Central, dependency-free app metadata. No imports so it stays trivially
// testable and safe to use from anywhere (incl. the cache layer).

// Keep in sync with app.json / package.json "version".
export const APP_VERSION = "0.1.0";

// Bump this whenever the SHAPE of locally cached data changes (the payloads
// stored via writeLocalCache). On startup, purgeAppCachesIfOutdated() drops all
// managed data caches when this value differs from what the device last saw, so
// a new app version never reads stale, wrongly-shaped cached data.
export const CACHE_SCHEMA_VERSION = "1";

// Prefixes of the *ephemeral data* caches we manage. User preferences
// (mcc.theme, mcc.introSeen.*, mcc.installHint.*) and Supabase auth tokens are
// intentionally NOT in this list — they must survive a cache purge.
export const MANAGED_CACHE_PREFIXES = ["mcc.cache.", "mcc.weekEvents.", "mcc.chat.", "mcc.members.", "mcc.eventDetail."];

export function isManagedDataCacheKey(key: string): boolean {
  return MANAGED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}
