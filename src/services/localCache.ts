import AsyncStorage from "@react-native-async-storage/async-storage";

type CachePayload<T> = {
  savedAt: number;
  data: T;
};

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
