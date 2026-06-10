import { describe, expect, it } from "vitest";
import { getDecisionReleaseDate, getWeekStartDate, isDecisionReleaseOpen, isVotingInputOpen } from "../src/services/date";

describe("MCC event timing", () => {
  it("starts the voting week on Monday", () => {
    expect(getWeekStartDate(new Date("2026-06-08T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-10T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-14T10:00:00Z"))).toBe("2026-06-08");
  });

  it("Sunday event: voting Monday through Wednesday, decision Thursday", () => {
    expect(getDecisionReleaseDate("2026-06-08").toISOString().slice(0, 10)).toBe("2026-06-11");
    expect(getDecisionReleaseDate("2026-06-08", "sunday").toISOString().slice(0, 10)).toBe("2026-06-11");
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-10T12:00:00Z"))).toBe(true);
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-11T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", "sunday", new Date("2026-06-11T00:00:00Z"))).toBe(true);
  });

  it("any weekday works: Friday event decides 3 days earlier (Tuesday)", () => {
    expect(getDecisionReleaseDate("2026-06-08", "friday").toISOString().slice(0, 10)).toBe("2026-06-09");
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-08T12:00:00Z"))).toBe(true);
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-09T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", "friday", new Date("2026-06-09T00:00:00Z"))).toBe(true);
  });

  it("Saturday event: voting Sunday through Tuesday, decision Wednesday", () => {
    expect(getDecisionReleaseDate("2026-06-08", "saturday").toISOString().slice(0, 10)).toBe("2026-06-10");
    // Sunday before the week start (2026-06-07) is already open
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-07T12:00:00Z"))).toBe(true);
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-09T12:00:00Z"))).toBe(true);
    // Wednesday: voting closed, decision open
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-10T00:00:00Z"))).toBe(false);
    expect(isDecisionReleaseOpen("2026-06-08", "saturday", new Date("2026-06-10T00:00:00Z"))).toBe(true);
  });
});
