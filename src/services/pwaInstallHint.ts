import AsyncStorage from "@react-native-async-storage/async-storage";
import { type InstallHintEnvironment, type InstallHintState, type PushPermission } from "./installHintDecision";
import { canUseWebPush } from "./push";

// Storage + web-environment probes for the install/push hint. The pure decision
// (decideInstallHint) and its types/constants live in ./installHintDecision and
// are re-exported here so callers have a single import surface. Nothing here ever
// requests a push permission — that stays an explicit action on the Push screen.
export * from "./installHintDecision";

const COUNT_PREFIX = "mcc.installHint.count.";
const STATE_PREFIX = "mcc.installHint.state.";

// Counts one app start/login per user. Call once per session; a failed read is
// treated as "unknown" (0), which keeps the hint hidden rather than mis-firing.
export async function recordAppUsage(userId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(COUNT_PREFIX + userId);
    const next = (Number(raw) || 0) + 1;
    await AsyncStorage.setItem(COUNT_PREFIX + userId, String(next));
    return next;
  } catch {
    return 0;
  }
}

export async function readInstallHintState(userId: string): Promise<InstallHintState> {
  try {
    const raw = await AsyncStorage.getItem(STATE_PREFIX + userId);
    if (!raw) return { dismissed: false };
    const parsed = JSON.parse(raw) as Partial<InstallHintState>;
    return { dismissed: parsed.dismissed === true };
  } catch {
    // If storage is unreadable, assume "handled" so a broken device never nags.
    return { dismissed: true };
  }
}

// "Nicht mehr anzeigen": hide for good.
export async function dismissInstallHintForever(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STATE_PREFIX + userId, JSON.stringify({ dismissed: true } satisfies InstallHintState));
  } catch {
    // Persisting the choice must never block the UI; worst case it reappears.
  }
}

// Web-only probes — all guarded so they are safe (and falsy) under tests/native.
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav?.standalone) return true;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: minimal-ui)").matches;
}

export function webPushPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isInstallSupported(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function readInstallHintEnvironment(): InstallHintEnvironment {
  return {
    standalone: isStandaloneDisplay(),
    pushPermission: webPushPermission(),
    pushSupported: canUseWebPush(),
    installSupported: isInstallSupported(),
  };
}
