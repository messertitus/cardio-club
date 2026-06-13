import { describe, expect, it } from "vitest";
import {
  decideInstallHint,
  INSTALL_HINT_TRIGGER_USAGES,
  type InstallHintEnvironment,
  type InstallHintState,
} from "../src/services/installHintDecision";

const freshState: InstallHintState = { dismissed: false };

// A plain web browser: can install, push available and not yet decided.
const webEnv: InstallHintEnvironment = {
  standalone: false,
  pushPermission: "default",
  pushSupported: true,
  installSupported: true,
};

function decide(overrides: {
  usageCount: number;
  state?: Partial<InstallHintState>;
  env?: Partial<InstallHintEnvironment>;
}) {
  return decideInstallHint({
    usageCount: overrides.usageCount,
    state: { ...freshState, ...overrides.state },
    env: { ...webEnv, ...overrides.env },
  });
}

describe("decideInstallHint", () => {
  it("fires only on the configured logins (2nd and 5th), never otherwise", () => {
    expect(INSTALL_HINT_TRIGGER_USAGES).toEqual([2, 5]);
    expect(decide({ usageCount: 1 })).toEqual({ show: false });
    expect(decide({ usageCount: 2 })).toEqual({ show: true, variant: "install-and-push" });
    expect(decide({ usageCount: 3 })).toEqual({ show: false });
    expect(decide({ usageCount: 4 })).toEqual({ show: false });
    expect(decide({ usageCount: 5 })).toEqual({ show: true, variant: "install-and-push" });
    expect(decide({ usageCount: 6 })).toEqual({ show: false });
    expect(decide({ usageCount: 12 })).toEqual({ show: false });
  });

  it("never shows once permanently dismissed", () => {
    expect(decide({ usageCount: 2, state: { dismissed: true } })).toEqual({ show: false });
    expect(decide({ usageCount: 5, state: { dismissed: true } })).toEqual({ show: false });
  });

  it("shows nothing once the app is installed (standalone) — no push prompt either", () => {
    expect(decide({ usageCount: 2, env: { standalone: true } })).toEqual({ show: false });
    expect(decide({ usageCount: 5, env: { standalone: true, pushPermission: "default" } })).toEqual({ show: false });
  });

  it("shows install-only when push is already granted", () => {
    expect(decide({ usageCount: 2, env: { pushPermission: "granted" } })).toEqual({ show: true, variant: "install-only" });
  });

  it("does not promise push when permission was denied", () => {
    expect(decide({ usageCount: 2, env: { standalone: true, pushPermission: "denied" } })).toEqual({ show: false });
    expect(decide({ usageCount: 2, env: { pushPermission: "denied" } })).toEqual({ show: true, variant: "install-only" });
  });

  it("does not promise push when unsupported", () => {
    expect(decide({ usageCount: 5, env: { pushSupported: false, pushPermission: "unsupported" } })).toEqual({
      show: true,
      variant: "install-only",
    });
  });

  it("shows nothing when neither install nor push is available", () => {
    expect(
      decide({
        usageCount: 2,
        env: { standalone: true, installSupported: false, pushSupported: false, pushPermission: "unsupported" },
      }),
    ).toEqual({ show: false });
  });

  it("shows push-only when install is unsupported but push is available", () => {
    expect(decide({ usageCount: 5, env: { installSupported: false } })).toEqual({ show: true, variant: "push-only" });
  });
});
