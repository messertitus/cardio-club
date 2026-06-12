import { describe, expect, it } from "vitest";
import {
  decisionReleaseFrom,
  getDecisionReleaseDate,
  getWeekStartDate,
  isDecisionReleaseOpen,
  isDecisionReleaseOpenAt,
  isVotingInputOpen,
  isVotingOpenAt,
} from "../src/services/date";

describe("MCC event timing", () => {
  it("starts the voting week on Monday", () => {
    expect(getWeekStartDate(new Date("2026-06-08T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-10T10:00:00Z"))).toBe("2026-06-08");
    expect(getWeekStartDate(new Date("2026-06-14T10:00:00Z"))).toBe("2026-06-08");
  });

  it("Sunday event: decision Friday (event−2), voting Mon–Thu (4 days)", () => {
    expect(getDecisionReleaseDate("2026-06-08").toISOString().slice(0, 10)).toBe("2026-06-12");
    expect(getDecisionReleaseDate("2026-06-08", "sunday").toISOString().slice(0, 10)).toBe("2026-06-12");
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-07T12:00:00Z"))).toBe(false); // Sun before: not yet
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-08T12:00:00Z"))).toBe(true); // Mon: opens
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-11T12:00:00Z"))).toBe(true); // Thu: last day
    expect(isVotingInputOpen("2026-06-08", "sunday", new Date("2026-06-12T00:00:00Z"))).toBe(false); // Fri: decision
    expect(isDecisionReleaseOpen("2026-06-08", "sunday", new Date("2026-06-12T00:00:00Z"))).toBe(true);
  });

  it("Saturday event: decision Thursday (event−2), voting Sun–Wed (4 days)", () => {
    expect(getDecisionReleaseDate("2026-06-08", "saturday").toISOString().slice(0, 10)).toBe("2026-06-11");
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-06T12:00:00Z"))).toBe(false); // Sat before: not yet
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-07T12:00:00Z"))).toBe(true); // Sun: opens
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-10T12:00:00Z"))).toBe(true); // Wed: last day
    expect(isVotingInputOpen("2026-06-08", "saturday", new Date("2026-06-11T00:00:00Z"))).toBe(false); // Thu: decision
    expect(isDecisionReleaseOpen("2026-06-08", "saturday", new Date("2026-06-11T00:00:00Z"))).toBe(true);
  });

  it("anchors decision and voting to the event's time of day", () => {
    const sundayAt15 = "2026-06-14T15:00:00.000Z"; // Sunday 15:00
    expect(decisionReleaseFrom(sundayAt15).toISOString()).toBe("2026-06-12T15:00:00.000Z"); // Friday 15:00
    expect(isDecisionReleaseOpenAt(sundayAt15, new Date("2026-06-12T14:59:00Z"))).toBe(false);
    expect(isDecisionReleaseOpenAt(sundayAt15, new Date("2026-06-12T15:00:00Z"))).toBe(true);
    // Voting opens Monday 15:00 and closes a 2h buffer before the decision (13:00).
    expect(isVotingOpenAt(sundayAt15, new Date("2026-06-08T14:59:00Z"))).toBe(false);
    expect(isVotingOpenAt(sundayAt15, new Date("2026-06-08T15:00:00Z"))).toBe(true);
    expect(isVotingOpenAt(sundayAt15, new Date("2026-06-12T12:59:00Z"))).toBe(true); // just before close
    expect(isVotingOpenAt(sundayAt15, new Date("2026-06-12T13:00:00Z"))).toBe(false); // buffered close
    expect(isVotingOpenAt(sundayAt15, new Date("2026-06-12T15:00:00Z"))).toBe(false); // decision time
    // Buffer window: voting closed (13:00) but decision not yet out (15:00).
    expect(isDecisionReleaseOpenAt(sundayAt15, new Date("2026-06-12T13:30:00Z"))).toBe(false);
  });

  it("any weekday: Friday event decides Wednesday, voting Sat–Tue (4 days)", () => {
    expect(getDecisionReleaseDate("2026-06-08", "friday").toISOString().slice(0, 10)).toBe("2026-06-10");
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-06T12:00:00Z"))).toBe(true); // Sat: opens
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-09T12:00:00Z"))).toBe(true); // Tue: last day
    expect(isVotingInputOpen("2026-06-08", "friday", new Date("2026-06-10T00:00:00Z"))).toBe(false); // Wed: decision
  });
});
