const DAY_MS = 24 * 60 * 60 * 1000;

// The club's events live in Berlin time. Format event-related instants in this
// zone so a 15:00 Cardiotag always reads 15:00, regardless of the device's zone.
export const CLUB_TIME_ZONE = "Europe/Berlin";

export function formatBerlinDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", timeZone: CLUB_TIME_ZONE });
}

export function formatBerlinTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });
}

export function formatBerlinDateTime(value: string | Date): string {
  return `${formatBerlinDate(value)} um ${formatBerlinTime(value)}`;
}

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

// "YYYY-MM-DD" of an instant in the club's (Berlin) timezone — locale-agnostic
// (formatToParts), so it is stable regardless of the device locale.
function berlinDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CLUB_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// "YYYY-MM-DD" of the event's calendar date.
export function eventDateKey(weekStartDate: string, eventDay: EventDay = "sunday"): string {
  return getEventDate(weekStartDate, eventDay).toISOString().slice(0, 10);
}

// "Running": from the event's exact start time until the end of its calendar day
// (Berlin midnight). Needs a real start time; without one we can't tell, so it
// stays false and the event simply reads "decided" until the day rolls over.
export function isEventRunningNow(
  startsAt: string | null | undefined,
  weekStartDate: string,
  eventDay: EventDay = "sunday",
  now = new Date(),
): boolean {
  if (!startsAt) return false;
  if (now.getTime() < new Date(startsAt).getTime()) return false;
  return berlinDateKey(now) === eventDateKey(weekStartDate, eventDay);
}

// "Over": the event's calendar day (Berlin) has passed → it is archived as
// "vorbei". Day-boundary at local 00:00, independent of the device timezone.
export function isEventOver(
  startsAt: string | null | undefined,
  weekStartDate: string,
  eventDay: EventDay = "sunday",
  now = new Date(),
): boolean {
  return berlinDateKey(now) > eventDateKey(weekStartDate, eventDay);
}

// Attendance and results may only be entered from the event's exact start time
// on (you cannot record who showed up before it starts). Falls back to the event
// date (midnight) when no precise start time is stored.
export function eventInputOpen(
  startsAt: string | null | undefined,
  weekStartDate: string,
  eventDay: EventDay = "sunday",
  now = new Date(),
): boolean {
  if (startsAt) return now.getTime() >= new Date(startsAt).getTime();
  return startOfUtcDay(now).getTime() >= getEventDate(weekStartDate, eventDay).getTime();
}

export function getDecisionReleaseDate(weekStartDate: string, eventDay: EventDay = "sunday"): Date {
  return addUtcDays(weekStartDate, DAY_OFFSET[eventDay] - 2);
}

export function isDecisionReleaseOpen(weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  return startOfUtcDay(now).getTime() >= getDecisionReleaseDate(weekStartDate, eventDay).getTime();
}

// Voting always runs for the 4 days ending the day before the decision, i.e.
// from event − 6 days through event − 3 (decision is event − 2). Weekday
// independent: Sunday → Mon–Thu, Saturday → Sun–Wed, and so on.
export function isVotingInputOpen(weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  const today = startOfUtcDay(now).getTime();
  const decision = getDecisionReleaseDate(weekStartDate, eventDay).getTime();
  return today >= decision - 4 * DAY_MS && today < decision;
}

// An event is shown 14 days in advance and stays visible through the event day.
// Voting still only opens later (see isVotingInputOpen / getVotingOpenDate).
export function isEventVisibleWindow(weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  const today = startOfUtcDay(now).getTime();
  const eventDate = getEventDate(weekStartDate, eventDay).getTime();
  return today >= eventDate - 14 * DAY_MS && today <= eventDate;
}

// First day voting is open: 4 days before the decision (= event − 6 days).
export function getVotingOpenDate(weekStartDate: string, eventDay: EventDay = "sunday"): Date {
  return new Date(getDecisionReleaseDate(weekStartDate, eventDay).getTime() - 4 * DAY_MS);
}

// Time-precise phase boundaries anchored to the event's actual start time, so the
// decision/voting close happen at the event's time of day (e.g. 15:00), not at
// midnight — and push notifications fire at that exact moment.
const DECISION_LEAD_MS = 2 * DAY_MS; // decision is 2 days before the event
const VOTING_WINDOW_MS = 4 * DAY_MS; // voting runs ~4 days before the decision
// Voting closes this long BEFORE the decision, so the last vote and the decision
// never happen at the same instant — a safety buffer that also gives a clear
// "voting closed, decision pending" window.
export const VOTE_CLOSE_BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours

export function decisionReleaseFrom(startsAt: string | Date): Date {
  const start = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  return new Date(start.getTime() - DECISION_LEAD_MS);
}

export function votingOpensFrom(startsAt: string | Date): Date {
  return new Date(decisionReleaseFrom(startsAt).getTime() - VOTING_WINDOW_MS);
}

// Voting closes a buffer before the decision is released.
export function votingClosesFrom(startsAt: string | Date): Date {
  return new Date(decisionReleaseFrom(startsAt).getTime() - VOTE_CLOSE_BUFFER_MS);
}

export function isDecisionReleaseOpenAt(startsAt: string | Date, now = new Date()): boolean {
  return now.getTime() >= decisionReleaseFrom(startsAt).getTime();
}

export function isVotingOpenAt(startsAt: string | Date, now = new Date()): boolean {
  const t = now.getTime();
  return t >= votingOpensFrom(startsAt).getTime() && t < votingClosesFrom(startsAt).getTime();
}

// Unified helpers used by BOTH client and server so they never disagree on
// whether voting is open / the decision is out. Prefer the event's exact start
// time (Berlin); fall back to the date-only computation if it is missing.
export function votingOpenNow(startsAt: string | null | undefined, weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  return startsAt ? isVotingOpenAt(startsAt, now) : isVotingInputOpen(weekStartDate, eventDay, now);
}

export function decisionReleasedNow(startsAt: string | null | undefined, weekStartDate: string, eventDay: EventDay = "sunday", now = new Date()): boolean {
  return startsAt ? isDecisionReleaseOpenAt(startsAt, now) : isDecisionReleaseOpen(weekStartDate, eventDay, now);
}

function addUtcDays(dateString: string, days: number): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
