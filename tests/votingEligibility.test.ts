import { describe, expect, it } from "vitest";
import { excludeNonAttendingEntries, excludeNonAttendingVotes } from "../src/lib/votingEligibility";

describe("voting eligibility", () => {
  it("excludes votes from members who are not attending", () => {
    const votes = [
      { user_id: "u1", sport_id: "running" },
      { user_id: "u2", sport_id: "swimming" },
      { user_id: "u3", sport_id: "boxing" },
    ];
    const attendance = [
      { user_id: "u1", status: "going" as const },
      { user_id: "u2", status: "not_going" as const },
      { user_id: "u3", status: "maybe" as const },
    ];

    expect(excludeNonAttendingVotes(votes, attendance)).toEqual([
      { user_id: "u1", sport_id: "running" },
      { user_id: "u3", sport_id: "boxing" },
    ]);
  });

  it("excludes votes when a member has no explicit going or maybe status", () => {
    const votes = [{ user_id: "u1", sport_id: "running" }];

    expect(excludeNonAttendingVotes(votes, [])).toEqual([]);
  });

  it("uses the same attendance gate for no-gos and other user-scoped entries", () => {
    const noGos = [
      { user_id: "u1", sport_id: "boxing" },
      { user_id: "u2", sport_id: "cycling" },
    ];
    const attendance = [
      { user_id: "u1", status: "maybe" as const },
      { user_id: "u2", status: "not_going" as const },
    ];

    expect(excludeNonAttendingEntries(noGos, attendance)).toEqual([{ user_id: "u1", sport_id: "boxing" }]);
  });
});
