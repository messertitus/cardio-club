import { describe, expect, it } from "vitest";
import { getDecisionReleaseDate, getWeekStartDate, isDecisionReleaseOpen, isVotingInputOpen } from "../src/services/date";

describe("MCC event timing", () => {
  it("starts the voting week on Monday", () => {
    expect(getWeekStartDate(new Date("2026-06-08T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-10T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-14T10:00:00Z"))).toBe("2026-06-08");
  });

  it("Sunday event: decision 2 days before (Friday), voting Mon–Thu", () => {
    expect(getDecisionReleaseDate("2026-06-08").toISOString().slice(0, 10)).toBe("2026-06-12");
    expect(getDecisionReleaseDate("2026-06-08", "sunday").toISOString().slice(0, 10)).toBe("2026-06-12");
    // Thursday still open, Friday (decision) closed
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-11T12:00:00Z"))).toBe(true);
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-12T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", "sunday", new Date("2026-06-12T00:00:00Z"))).toBe(true);
  });

  it("any weekday: Friday event decides 2 days before (Wednesday)", () => {
    expect(getDecisionReleaseDate("2026-06-08", "friday").toISOString().slice(0, 10)).toBe("2026-06-10");
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-09T12:00:00Z"))).toBe(true);
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-10T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", "friday", new Date("2026-06-10T00:00:00Z"))).toBe(true);
  });

  it("Saturday event: decision 2 days before (Thursday), voting Mon–Wed", () => {
    expect(getDecisionReleaseDate("2026-06-08", "saturday").toISOString().slice(0, 10)).toBe("2026-06-11");
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-10T12:00:00Z"))).toBe(true);
    // Thursday: voting closed, decision open
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-11T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", "saturday", new Date("2026-06-11T00:00:00Z"))).toBe(true);
  });
});
