const DAY_MS = 24 * 60 * 60 * 1000;

export function getWeekStartDate(date = new Date()): string {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  normalized.setUTCDate(normalized.getUTCDate() - daysSinceMonday);

  return normalized.toISOString().slice(0, 10);
}

export function getCardioSundayDate(value?: string | null): Date {
  const base = value ? new Date(value) : new Date();
  const normalized = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const day = normalized.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  normalized.setUTCDate(normalized.getUTCDate() + daysUntilSunday);
  return normalized;
}

export function formatCardioSunday(value?: string | null): string {
  return getCardioSundayDate(value).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

// Formats the actual date (with its real weekday) — used for events that can
// fall on Saturday or Sunday, where forcing the Sunday would be wrong.
export function formatEventDate(value?: string | null): string {
  const base = value ? new Date(value) : new Date();
  return base.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
}

export type EventDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

// Days offset from the week's Monday.
const DAY_OFFSET: Record<EventDay, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export const WEEKDAY_LABELS: Record<EventDay, string> = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
  saturday: "Samstag",
  sunday: "Sonntag",
};

export const WEEKDAY_ORDER: EventDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Title shown on the hero / chat for a Cardiotag, e.g. "Cardio-Samstag".
export function eventDayTitle(eventDay: EventDay): string {
  return `Cardio-${WEEKDAY_LABELS[eventDay]}`;
}

// The real calendar date of the event, derived from the week's Monday and the
// event day. Independent of any stored starts_at, so the weekday label is
// always correct. Decision releases 2 days before the event (Saturday →
// Thursday, Sunday → Friday) so it sits closer to the weather forecast; voting
// runs from the week's Monday until the day before the decision.
export function getEventDate(weekStartDate: string, eventDay: EventDay = "sunday"): Date {
  return addUtcDays(weekStartDate, DAY_OFFSET[eventDay]);
}

export function formatEventDayDate(weekStartDate: string, eventDay: EventDay = "sunday"): string {
  return getEventDate(weekStartDate, eventDay).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
}

export function isEventPast(weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  return startOfUtcDay(now).getTime() > getEventDate(weekStartDate, eventDay).getTime();
}

export function getDecisionReleaseDate(weekStartDate: string, eventDay: EventDay = "sunday"): Date {
  return addUtcDays(weekStartDate, DAY_OFFSET[eventDay] - 2);
}

export function isDecisionReleaseOpen(weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  return startOfUtcDay(now).getTime() >= getDecisionReleaseDate(weekStartDate, eventDay).getTime();
}

// Voting is open from the moment an event is listed (current and next week)
// until its decision is released — so members can already vote on upcoming
// ("Demnächst") events, not only on the current week's Cardiotag.
export function isVotingInputOpen(weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  return startOfUtcDay(now).getTime() < getDecisionReleaseDate(weekStartDate, eventDay).getTime();
}

function addUtcDays(dateString: string, days: number): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
