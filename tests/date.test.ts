import { describe, expect, it } from "vitest";
import { getDecisionReleaseDate, getWeekStartDate, isDecisionReleaseOpen, isVotingInputOpen } from "../src/services/date";

describe("MCC event timing", () => {
  it("starts the voting week on Monday", () => {
    expect(getWeekStartDate(new Date("2026-06-08T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-10T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-14T10:00:00Z"))).toBe("2026-06-08");
  });

  it("opens the decision on Thursday and keeps voting to Monday through Wednesday", () => {
    expect(getDecisionReleaseDate("2026-06-08").toISOString().slice(0, 10)).toBe("2026-06-11");
    expect(isVotingInputOpen("2026-06-08", new Date("2026-06-10T12:00:00Z"))).toBe(true);
    expect(isVotingInputOpen("2026-06-08", new Date("2026-06-11T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", new Date("2026-06-11T00:00:00Z"))).toBe(true);
  });
});
