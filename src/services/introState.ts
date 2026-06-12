import AsyncStorage from "@react-native-async-storage/async-storage";

// Tracks whether a user has already seen the one-time welcome tour. Stored
// locally (no TTL, unlike the localCache helpers) and keyed per user so a
// shared device shows the tour once per account. A missing/failed read is
// treated as "not seen yet" so the tour can still appear — never as a blocker.
const INTRO_SEEN_PREFIX = "mcc.introSeen.";

function introSeenKey(userId: string): string {
  return `${INTRO_SEEN_PREFIX}${userId}`;
}

export async function hasSeenIntro(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(introSeenKey(userId));
    return raw === "1";
  } catch {
    // If storage is unavailable, assume seen so we never trap the user in a
    // tour they cannot dismiss on a broken device.
    return true;
  }
}

export async function markIntroSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(introSeenKey(userId), "1");
  } catch {
    // Persisting the flag should never block the app; worst case the tour
    // reappears next session and can be skipped again.
  }
}
