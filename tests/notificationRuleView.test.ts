import { describe, expect, it } from "vitest";
import {
  CONDITION_KEYS,
  NOTIFICATION_RULE_KIND_LABELS,
  describeSchedule,
  parseConditions,
  parseSchedule,
  summarizeConditions,
} from "../src/lib/notificationRuleView";

describe("notificationRuleView", () => {
  it("summarizes no conditions as everyone", () => {
    expect(summarizeConditions({})).toBe("Alle Mitglieder");
    expect(summarizeConditions(null)).toBe("Alle Mitglieder");
    expect(summarizeConditions("nonsense")).toBe("Alle Mitglieder");
  });

  it("summarizes active conditions in order", () => {
    expect(summarizeConditions({ activeOnly: true, adminsOnly: true })).toBe("Nur aktive Mitglieder · Nur Admins");
    expect(summarizeConditions({ notVoted: true })).toBe("Noch nicht abgestimmt");
  });

  it("parses only the known boolean condition flags", () => {
    const parsed = parseConditions({ activeOnly: true, bogus: true });
    expect(parsed).toEqual({ activeOnly: true });
    expect(Object.keys(parsed).every((key) => (CONDITION_KEYS as string[]).includes(key))).toBe(true);
  });

  it("supports the richer condition set", () => {
    expect(summarizeConditions({ hasCity: true, notGoing: true })).toBe("Mit Standort · Nicht dabei");
    expect(parseConditions({ voted: true, noCity: true })).toEqual({ voted: true, noCity: true });
    // push targeting is implicit now and not offered as a condition
    expect(parseConditions({ pushOnly: true, noPush: true })).toEqual({});
  });

  it("describes the schedule incl. one-time date/time", () => {
    expect(describeSchedule({})).toBe("Einmalig");
    expect(describeSchedule({ mode: "once" })).toBe("Einmalig");
    expect(describeSchedule({ mode: "once", date: "2026-06-20", time: "18:00" })).toBe("Einmalig · 2026-06-20 · 18:00");
    expect(describeSchedule({ mode: "recurring", weekday: "Freitag", time: "18:00" })).toBe("Wiederkehrend · Freitag · 18:00");
  });

  it("parses schedule defensively", () => {
    expect(parseSchedule({ mode: "weird" })).toEqual({});
    expect(parseSchedule({ mode: "recurring", time: "09:00" })).toEqual({ mode: "recurring", time: "09:00" });
  });

  it("has a label for every notification kind", () => {
    expect(NOTIFICATION_RULE_KIND_LABELS.manual).toBe("Manuelle Mitteilung");
    expect(NOTIFICATION_RULE_KIND_LABELS.vote_closing).toBe("Abstimmung endet bald");
  });
});
