import { describe, expect, it } from "vitest";
import { getAvailableVoteRanks, isVoteRank, rankToVoteWeight } from "../src/lib/votingRules";

describe("voting rules", () => {
  it("maps ranked votes to weights", () => {
    expect(rankToVoteWeight(1)).toBe(1);
    expect(rankToVoteWeight(2)).toBe(0.6);
    expect(rankToVoteWeight(3)).toBe(0.3);
  });

  it("accepts only the three supported ranks", () => {
    expect(isVoteRank(1)).toBe(true);
    expect(isVoteRank(2)).toBe(true);
    expect(isVoteRank(3)).toBe(true);
    expect(isVoteRank(4)).toBe(false);
  });

  it("returns remaining ranks deterministically", () => {
    expect(getAvailableVoteRanks([2])).toEqual([1, 3]);
  });
});
