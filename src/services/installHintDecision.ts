// Pure decision logic for the PWA/Push install hint — no storage, no platform
// imports, so it stays trivially unit-testable. Storage and environment probes
// live in ./pwaInstallHint, which re-exports everything here.

// Show on exactly these app starts (logins), then never again — the 2nd and the
// 5th. The counter is per user and only starts the first time this feature runs,
// so a long-standing user first sees it on their 2nd login after the update.
export const INSTALL_HINT_TRIGGER_USAGES = [2, 5];

// Only the permanent opt-out is persisted. "Später"/"Mehr erfahren" are handled
// in-memory for the session — the login counter naturally moves past the trigger
// on the next app open, so they never need a durable flag.
export type InstallHintState = { dismissed: boolean };

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export type InstallHintEnvironment = {
  // App already runs installed/standalone — no install hint needed.
  standalone: boolean;
  // Browser-level Notification permission, or "unsupported" where unavailable.
  pushPermission: PushPermission;
  // Web Push is technically usable in this browser.
  pushSupported: boolean;
  // The platform can install a PWA at all (service worker capable web runtime).
  installSupported: boolean;
};

export type InstallHintVariant = "install-and-push" | "install-only" | "push-only";

export type InstallHintDecision = { show: false } | { show: true; variant: InstallHintVariant };

// Given how often the app was used, whether the user opted out, and the current
// runtime, decide whether (and how) to show the hint. It fires only on the
// configured usage counts, and makes no promises for things the platform can't
// do — if neither install nor push is on the table, the hint stays hidden.
export function decideInstallHint(params: {
  usageCount: number;
  state: InstallHintState;
  env: InstallHintEnvironment;
}): InstallHintDecision {
  const { usageCount, state, env } = params;

  if (state.dismissed) return { show: false };
  if (!INSTALL_HINT_TRIGGER_USAGES.includes(usageCount)) return { show: false };
  // Already installed as an app → no hint at all, and explicitly no push prompt.
  if (env.standalone) return { show: false };

  const canOfferInstall = env.installSupported;
  // Only offer push when it can actually be granted — a "denied" or unsupported
  // state must not promise notifications we cannot deliver.
  const canOfferPush = env.pushSupported && env.pushPermission === "default";

  if (canOfferInstall && canOfferPush) return { show: true, variant: "install-and-push" };
  if (canOfferInstall) return { show: true, variant: "install-only" };
  if (canOfferPush) return { show: true, variant: "push-only" };
  return { show: false };
}
