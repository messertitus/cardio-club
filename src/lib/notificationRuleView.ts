import type { NotificationRuleKind, NotificationRuleStatus } from "../services/database.types";

// Pure presentation helpers for notification rules. No service/storage imports,
// so this stays trivially unit-testable.

export const NOTIFICATION_RULE_KIND_LABELS: Record<NotificationRuleKind, string> = {
  vote_open: "Abstimmung geöffnet",
  vote_closing: "Abstimmung endet bald",
  decision_available: "Entscheidung verfügbar",
  event_reminder: "Event-Erinnerung",
  idea_proposed: "Neue Sportart/Standort",
  chat_hint: "Chat-/Club-Hinweis",
  manual: "Manuelle Mitteilung",
};

export const NOTIFICATION_RULE_STATUS_LABELS: Record<NotificationRuleStatus, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  inactive: "Inaktiv",
};

// Labels for the kinds that already live in the app_notifications queue.
export const APP_NOTIFICATION_KIND_LABELS: Record<string, string> = {
  event_created: "Event erstellt",
  decision_released: "Entscheidung",
  chat_message: "Chat",
  vote_reminder: "Vote-Erinnerung",
  invite_reminder: "Einladung",
  admin_rule: "Admin-Regel",
};

// The condition flags an admin can toggle. They narrow the base audience (AND).
export type NotificationRuleConditions = {
  activeOnly?: boolean;
  pushOnly?: boolean;
  noPush?: boolean;
  hasCity?: boolean;
  noCity?: boolean;
  adminsOnly?: boolean;
  notVoted?: boolean;
  voted?: boolean;
  attendanceNotSet?: boolean;
  goingOrMaybe?: boolean;
  notGoing?: boolean;
};

export type NotificationRuleScheduleMode = "once" | "recurring";

export type NotificationRuleSchedule = {
  mode?: NotificationRuleScheduleMode;
  date?: string;
  weekday?: string;
  time?: string;
};

// Note: every notification now requires a push subscription (DB trigger), so a
// "no push" target is impossible and "push only" is implicit — neither is offered.
export const CONDITION_KEYS: (keyof NotificationRuleConditions)[] = [
  "activeOnly",
  "hasCity",
  "noCity",
  "adminsOnly",
  "notVoted",
  "voted",
  "attendanceNotSet",
  "goingOrMaybe",
  "notGoing",
];

export const CONDITION_LABELS: Record<keyof NotificationRuleConditions, string> = {
  activeOnly: "Nur aktive Mitglieder",
  pushOnly: "Nur mit Push",
  noPush: "Nur ohne Push",
  hasCity: "Mit Standort",
  noCity: "Ohne Standort",
  adminsOnly: "Nur Admins",
  notVoted: "Noch nicht abgestimmt",
  voted: "Bereits abgestimmt",
  attendanceNotSet: "Teilnahme offen",
  goingOrMaybe: "Dabei / Vielleicht",
  notGoing: "Nicht dabei",
};

// Short hint per condition, shown under the toggle so it stays understandable.
export const CONDITION_HINTS: Partial<Record<keyof NotificationRuleConditions, string>> = {
  notVoted: "Bezieht sich auf das aktuelle offene Event.",
  voted: "Bezieht sich auf das aktuelle offene Event.",
  attendanceNotSet: "Bezieht sich auf das aktuelle offene Event.",
  goingOrMaybe: "Bezieht sich auf das aktuelle offene Event.",
  notGoing: "Bezieht sich auf das aktuelle offene Event.",
};

// Defensive parse — conditions/schedule are stored as JSON columns.
export function parseConditions(value: unknown): NotificationRuleConditions {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const result: NotificationRuleConditions = {};
  for (const key of CONDITION_KEYS) {
    if (record[key] === true) result[key] = true;
  }
  return result;
}

export function parseSchedule(value: unknown): NotificationRuleSchedule {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const schedule: NotificationRuleSchedule = {};
  if (record.mode === "once" || record.mode === "recurring") schedule.mode = record.mode;
  if (typeof record.date === "string") schedule.date = record.date;
  if (typeof record.weekday === "string") schedule.weekday = record.weekday;
  if (typeof record.time === "string") schedule.time = record.time;
  return schedule;
}

// Compact, human summary of the conditions for the rule list ("Nur aktive
// Mitglieder · Nur mit Push" or "Alle Mitglieder" when nothing is set).
export function summarizeConditions(value: unknown): string {
  const conditions = parseConditions(value);
  const active = CONDITION_KEYS.filter((key) => conditions[key]).map((key) => CONDITION_LABELS[key]);
  return active.length === 0 ? "Alle Mitglieder" : active.join(" · ");
}

export function describeSchedule(value: unknown): string {
  const schedule = parseSchedule(value);
  if (schedule.mode === "recurring") {
    const parts = ["Wiederkehrend"];
    if (schedule.weekday) parts.push(schedule.weekday);
    if (schedule.time) parts.push(schedule.time);
    return parts.join(" · ");
  }
  const parts = ["Einmalig"];
  if (schedule.date) parts.push(schedule.date);
  if (schedule.time) parts.push(schedule.time);
  return parts.join(" · ");
}
