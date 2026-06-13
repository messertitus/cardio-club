import { describe, expect, it } from "vitest";
import {
  ALL_STAT_KEYS,
  STAT_KEY_LABELS,
  STAT_KEY_PATTERN,
  attendanceStatusKey,
  isValidStatKey,
  statKeyLabel,
  voteRankKey,
} from "../src/lib/analyticsEvents";

describe("analytics event registry", () => {
  it("registers a meaningful number of blessed keys", () => {
    expect(ALL_STAT_KEYS.length).toBeGreaterThan(20);
  });

  it("every blessed key matches the DB-enforced key format", () => {
    // Mirrors is_valid_stat_key() in migration 056: lowercase dotted/underscored
    // segments, 2..80 chars. Guards purpose binding — no free text can be a key.
    for (const key of ALL_STAT_KEYS) {
      expect(isValidStatKey(key), key).toBe(true);
      expect(STAT_KEY_PATTERN.test(key), key).toBe(true);
      expect(key.length).toBeLessThanOrEqual(80);
    }
  });

  it("has no duplicate keys", () => {
    expect(new Set(ALL_STAT_KEYS).size).toBe(ALL_STAT_KEYS.length);
  });

  it("rejects sensitive / malformed keys", () => {
    expect(isValidStatKey("Vote.Submitted")).toBe(false); // uppercase
    expect(isValidStatKey("message body text")).toBe(false); // spaces
    expect(isValidStatKey(".leading")).toBe(false);
    expect(isValidStatKey("a")).toBe(false); // too short
    expect(isValidStatKey("x".repeat(81))).toBe(false); // too long
  });

  it("provides a German label for every blessed key", () => {
    for (const key of ALL_STAT_KEYS) {
      expect(STAT_KEY_LABELS[key], key).toBeTruthy();
    }
  });

  it("falls back to the raw key for unknown keys", () => {
    expect(statKeyLabel("future.unmapped_key")).toBe("future.unmapped_key");
  });

  it("maps attendance status and vote rank to valid blessed keys", () => {
    for (const status of ["going", "maybe", "not_going"] as const) {
      const key = attendanceStatusKey(status);
      expect(ALL_STAT_KEYS).toContain(key);
    }
    for (const rank of [1, 2, 3] as const) {
      const key = voteRankKey(rank);
      expect(ALL_STAT_KEYS).toContain(key);
    }
  });
});
