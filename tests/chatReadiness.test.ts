import { describe, expect, it } from "vitest";
import { isEventDecisionReadyForChat } from "../src/lib/eventChatReadiness";
import type { Row } from "../src/services/database.types";

// starts_at drives decisionReleasedNow (decision releases at starts_at − 2 days).
const DAY_MS = 24 * 60 * 60 * 1000;
const longPast = new Date(Date.now() - 10 * DAY_MS).toISOString(); // decision released ~12d ago
const farFuture = new Date(Date.now() + 10 * DAY_MS).toISOString(); // decision still ~8d away

function event(overrides: Partial<Row<"weekly_events">>): Row<"weekly_events"> {
  return {
    status: "voting",
    starts_at: farFuture,
    week_start_date: "2026-06-08",
    event_day: "sunday",
    ...overrides,
  } as Row<"weekly_events">;
}

describe("isEventDecisionReadyForChat — which event chats appear", () => {
  it("never shows a chat for a cancelled event", () => {
    expect(isEventDecisionReadyForChat(event({ status: "cancelled", starts_at: longPast }), 5)).toBe(false);
  });

  it("always keeps the chat for a completed event (close-out window)", () => {
    expect(isEventDecisionReadyForChat(event({ status: "completed", starts_at: farFuture }), 0)).toBe(true);
  });

  it("hides the chat when fewer than two distinct voters attend (mirrors skip)", () => {
    expect(isEventDecisionReadyForChat(event({ status: "decided", starts_at: longPast }), 1)).toBe(false);
    expect(isEventDecisionReadyForChat(event({ status: "decided", starts_at: longPast }), 2)).toBe(true);
  });

  it("opens the chat only once the decision is finalized (status), not by time", () => {
    // The 48h moment passing is NOT enough — the decision must be persisted.
    expect(isEventDecisionReadyForChat(event({ status: "voting", starts_at: longPast }), 3)).toBe(false);
    // Finalized → chat opens, regardless of timing.
    expect(isEventDecisionReadyForChat(event({ status: "decided", starts_at: farFuture }), 2)).toBe(true);
    expect(isEventDecisionReadyForChat(event({ status: "decided", starts_at: longPast }), 3)).toBe(true);
  });
});
