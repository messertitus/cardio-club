import { describe, expect, it } from "vitest";
import { ensureProfile } from "../src/services/profiles";

describe("ensureProfile", () => {
  it("writes profile email and role when the invite migration is available", async () => {
    const writes: unknown[] = [];
    const supabase = mockSupabase([
      { data: null, error: null },
      {
        data: {
          id: "user-1",
          display_name: "Titus",
          email: "messertitus@outlook.com",
          role: "admin",
          avatar_url: null,
          created_at: "2026-05-27T00:00:00Z",
        },
        error: null,
      },
    ], writes);

    const result = await ensureProfile(supabase, {
      userId: "user-1",
      displayName: "Titus",
      email: "messertitus@outlook.com",
    });

    expect(result.error).toBeNull();
    expect(result.data?.role).toBe("admin");
    expect(writes[0]).toMatchObject({
      id: "user-1",
      display_name: "Titus",
      email: "messertitus@outlook.com",
    });
  });

  it("falls back to the base profile columns if Supabase schema cache misses email or role", async () => {
    const writes: unknown[] = [];
    const supabase = mockSupabase([
      { data: null, error: null },
      {
        data: null,
        error: {
          code: "PGRST204",
          message: "Could not find the 'email' column of 'profiles' in the schema cache",
        },
      },
      {
        data: {
          id: "user-2",
          display_name: "Sam",
          avatar_url: null,
          created_at: "2026-05-27T00:00:00Z",
        },
        error: null,
      },
    ], writes);

    const result = await ensureProfile(supabase, {
      userId: "user-2",
      displayName: "Sam",
      email: "sam@example.com",
    });

    expect(result.error).toBeNull();
    expect(writes[0]).toMatchObject({
      id: "user-2",
      display_name: "Sam",
    });
  });
});

function mockSupabase(responses: Array<{ data: unknown; error: unknown }>, writes: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => responses.shift(),
        }),
      }),
      upsert: (payload: unknown) => {
        writes.push(payload);

        return {
          select: () => ({
            single: async () => responses.shift(),
          }),
        };
      },
    }),
  } as never;
}
