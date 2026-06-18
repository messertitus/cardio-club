import { describe, expect, it } from "vitest";
import { CACHE_SCHEMA_VERSION, isManagedDataCacheKey } from "../src/lib/appInfo";

describe("appInfo cache keys", () => {
  it("treats only ephemeral data caches as managed (purgeable)", () => {
    expect(isManagedDataCacheKey("mcc.cache.activeSportsWithProfiles.v2")).toBe(true);
    expect(isManagedDataCacheKey("mcc.weekEvents.user-123")).toBe(true);
    expect(isManagedDataCacheKey("mcc.chat.user-123")).toBe(true);
    expect(isManagedDataCacheKey("mcc.members.user-123")).toBe(true);
    expect(isManagedDataCacheKey("mcc.eventDetail.event-1.user-123")).toBe(true);
  });

  it("never purges user preferences or auth tokens", () => {
    expect(isManagedDataCacheKey("mcc.theme")).toBe(false);
    expect(isManagedDataCacheKey("mcc.introSeen.user-123")).toBe(false);
    expect(isManagedDataCacheKey("mcc.installHint.count.user-123")).toBe(false);
    expect(isManagedDataCacheKey("mcc.installHint.state.user-123")).toBe(false);
    expect(isManagedDataCacheKey("sb-xyz-auth-token")).toBe(false);
    expect(isManagedDataCacheKey("mcc.cacheSchemaVersion")).toBe(false);
  });

  it("exposes a cache schema version string", () => {
    expect(typeof CACHE_SCHEMA_VERSION).toBe("string");
    expect(CACHE_SCHEMA_VERSION.length).toBeGreaterThan(0);
  });
});
