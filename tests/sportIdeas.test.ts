import { describe, expect, it, vi } from "vitest";
import { linkSportIdeaToSports, submitSportIdea } from "../src/services/sportIdeas";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("submitSportIdea", () => {
  it("stores requested new sports without sending an empty uuid", async () => {
    const writes: unknown[] = [];
    const supabase = mockSupabase(writes);

    const result = await submitSportIdea(supabase, {
      userId: "user-1",
      name: "Badminton",
      sportId: "",
      sportIds: [],
      profileName: "Badminton: Strandbad Horn",
      locationMode: "fixed",
      location: "Strandbad Horn",
      locationType: "outdoor",
      minimumGroupSize: 2,
      maximumGroupSize: 18,
      weatherRules: { requiresDry: true },
    });

    expect(result.error).toBeNull();
    expect(writes[0]).toMatchObject({
      sport_id: null,
      sport_ids: [],
      name: "Badminton",
      profile_name: "Badminton: Strandbad Horn",
    });
  });
});

describe("linkSportIdeaToSports", () => {
  it("links a requested sport idea to the approved abstract sport", async () => {
    const writes: unknown[] = [];
    const supabase = mockSupabase(writes);

    const result = await linkSportIdeaToSports(supabase, {
      ideaId: "idea-1",
      sportIds: ["sport-badminton", ""],
    });

    expect(result.error).toBeNull();
    expect(writes[0]).toMatchObject({
      sport_id: "sport-badminton",
      sport_ids: ["sport-badminton"],
    });
  });
});

function mockSupabase(writes: unknown[]) {
  return {
    from: () => ({
      insert: (payload: unknown) => {
        writes.push(payload);

        return {
          select: () => ({
            single: async () => ({ data: { id: "idea-1", ...(payload as Record<string, unknown>) }, error: null }),
          }),
        };
      },
      update: (payload: unknown) => {
        writes.push(payload);

        return {
          eq: () => ({
            select: () => ({
              single: async () => ({ data: { id: "idea-1", ...(payload as Record<string, unknown>) }, error: null }),
            }),
          }),
        };
      },
    }),
  } as never;
}
