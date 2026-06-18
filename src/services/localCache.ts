import AsyncStorage from "@react-native-async-storage/async-storage";
import { isManagedDataCacheKey } from "../lib/appInfo";

type CachePayload<T> = {
  savedAt: number;
  data: T;
};

// Cache-key builders, defined once so a screen and the prefetch can never write
// to slightly different keys. Prefixes must stay in MANAGED_CACHE_PREFIXES
// (src/lib/appInfo.ts) so a schema bump purges them.
export const membersCacheKey = (userId: string): string => `mcc.members.${userId}`;
export const chatCacheKey = (userId: string): string => `mcc.chat.${userId}`;
export const weekEventsCacheKey = (userId: string): string => `mcc.weekEvents.${userId}`;
export const eventDetailCacheKey = (eventId: string, userId: string): string => `mcc.eventDetail.${eventId}.${userId}`;

const CACHE_SCHEMA_KEY = "mcc.cacheSchemaVersion";

// Drops all managed data caches when the cache schema version changes, so a new
// app build never feeds stale, wrongly-shaped data to new code. User preferences
// and auth tokens are preserved. Best-effort: never blocks startup.
export async function purgeAppCachesIfOutdated(schemaVersion: string): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_SCHEMA_KEY);
    if (stored === schemaVersion) return;
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(isManagedDataCacheKey);
    if (stale.length > 0) await Promise.all(stale.map((key) => AsyncStorage.removeItem(key)));
    await AsyncStorage.setItem(CACHE_SCHEMA_KEY, schemaVersion);
  } catch {
    // Cache maintenance must never block app start.
  }
}

export async function readLocalCache<T>(key: string, maxAgeMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw) as CachePayload<T>;
    if (!payload || typeof payload.savedAt !== "number") return null;
    if (Date.now() - payload.savedAt > maxAgeMs) {
      void AsyncStorage.removeItem(key);
      return null;
    }
    return payload.data;
  } catch {
    return null;
  }
}

export async function writeLocalCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cache failures should never block the app.
  }
}

export async function removeLocalCache(keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
  } catch {
    // Cache failures should never block the app.
  }
}
