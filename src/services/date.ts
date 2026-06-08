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

export function getDecisionReleaseDate(weekStartDate: string): Date {
  return addUtcDays(weekStartDate, 3);
}

export function isDecisionReleaseOpen(weekStartDate: string, now = new Date()): boolean {
  return startOfUtcDay(now).getTime() >= getDecisionReleaseDate(weekStartDate).getTime();
}

export function isVotingInputOpen(weekStartDate: string, now = new Date()): boolean {
  const today = startOfUtcDay(now).getTime();
  return today >= addUtcDays(weekStartDate, 0).getTime() && today < getDecisionReleaseDate(weekStartDate).getTime();
}

function addUtcDays(dateString: string, days: number): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
