import type { Json, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";
import { isValidStatKey, type StatKey } from "../lib/analyticsEvents";

// Re-export the pure registry so callers have a single import surface
// (`from "../src/services"`) for both tracking and the blessed key constants.
export * from "../lib/analyticsEvents";

// Central, privacy-first analytics/stats service.
//
// Self-tracking (trackAppEvent / recordUserMetric) is fire-and-forget and never
// throws or blocks the UI — instrumentation must never break a real action.
// All writes go through the SECURITY DEFINER `record_user_metric` RPC, which
// forces user_id = auth.uid(), so a user can only ever record their own data.
// Reading other users and all mutations are admin-gated server-side.

// A tiny, non-sensitive context bag. Identifiers and enums only — never names,
// message bodies, phone numbers, or coordinates.
export type TrackContext = Record<string, string | number | boolean | null>;

export type UserStatCounter = {
  metricKey: string;
  value: number;
  lastEventAt: string | null;
};

export type UserStats = {
  userId: string;
  lastActiveAt: string | null;
  totalEvents: number;
  counters: UserStatCounter[];
};

// Derived "insights" — combination metrics computed server-side at read time
// (migration 058) from the raw analytics tables. Shape mirrors get_user_stat_insights.
export type UserStatInsights = {
  userId: string;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
  daysSinceLastActive: number | null;
  activeDays: number;
  activeWeeks: number;
  currentWeekStreak: number;
  distinctVotedSports: number;
  timeOfDay: { morning: number; afternoon: number; evening: number; night: number };
  weekday: Record<string, number>;
  rates: {
    reliabilityPercent: number | null;
    attendanceFollowThrough: number | null;
    wishFulfilledPercent: number | null;
    wishCoveredPercent: number | null;
    ideaAcceptancePercent: number | null;
    voteRevisionPercent: number | null;
  };
  scores: { participation: number; contribution: number; social: number; engagement: number };
};

// Track an app event: appends an activity breadcrumb AND (by default) bumps a
// counter of the same key. Pass `countKey: null` to log without counting, or a
// different key to count under another name. Best-effort; errors are swallowed.
export async function trackAppEvent(
  supabase: AppSupabaseClient,
  eventType: StatKey,
  options: { context?: TrackContext; countKey?: StatKey | null; increment?: number } = {},
): Promise<void> {
  const countKey = options.countKey === undefined ? eventType : options.countKey;
  try {
    await supabase.rpc("record_user_metric", {
      p_metric_key: countKey ?? undefined,
      p_increment: options.increment ?? 1,
      p_event_type: eventType,
      p_context: (options.context ?? {}) as Json,
    });
  } catch {
    // Tracking is non-essential: never surface or rethrow.
  }
}

// Increment a counter without an activity-log breadcrumb. Best-effort.
export async function recordUserMetric(
  supabase: AppSupabaseClient,
  metricKey: StatKey,
  increment = 1,
): Promise<void> {
  try {
    await supabase.rpc("record_user_metric", { p_metric_key: metricKey, p_increment: increment });
  } catch {
    // Non-essential.
  }
}

// Read aggregated stats for self (any user) or a target (admins only).
export async function getUserStats(
  supabase: AppSupabaseClient,
  targetUserId?: string,
): Promise<ServiceResult<UserStats>> {
  const { data, error } = await supabase.rpc("get_user_stats", {
    target_user_id: targetUserId ?? undefined,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Statistik konnte nicht geladen werden.") };
  }

  return ok(normalizeStats(data as Record<string, unknown>));
}

function normalizeStats(raw: Record<string, unknown>): UserStats {
  const counters = Array.isArray(raw.counters) ? raw.counters : [];
  return {
    userId: typeof raw.userId === "string" ? raw.userId : "",
    lastActiveAt: typeof raw.lastActiveAt === "string" ? raw.lastActiveAt : null,
    totalEvents: typeof raw.totalEvents === "number" ? raw.totalEvents : Number(raw.totalEvents ?? 0),
    counters: counters
      .map((entry) => {
        const item = entry as Record<string, unknown>;
        return {
          metricKey: String(item.metricKey ?? ""),
          value: Number(item.value ?? 0),
          lastEventAt: typeof item.lastEventAt === "string" ? item.lastEventAt : null,
        };
      })
      .filter((counter) => counter.metricKey.length > 0),
  };
}

// Read derived insights for self (any user) or a target (admins only).
export async function getUserStatInsights(
  supabase: AppSupabaseClient,
  targetUserId?: string,
): Promise<ServiceResult<UserStatInsights>> {
  const { data, error } = await supabase.rpc("get_user_stat_insights", {
    target_user_id: targetUserId ?? undefined,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Insights konnten nicht geladen werden.") };
  }

  return ok(data as unknown as UserStatInsights);
}

// --- Admin / test only -----------------------------------------------------

// Manually set one counter to an exact value. Server-gated to admins + audited.
export async function updateUserStatisticForTesting(
  supabase: AppSupabaseClient,
  input: { targetUserId: string; metricKey: string; value: number; note?: string },
): Promise<ServiceResult<{ saved: true }>> {
  if (!isValidStatKey(input.metricKey)) {
    return { data: null, error: { message: "Ungültiger Statistik-Schlüssel." } };
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    return { data: null, error: { message: "Bitte einen Wert von 0 oder größer eingeben." } };
  }

  const { error } = await supabase.rpc("admin_set_user_metric", {
    target_user_id: input.targetUserId,
    p_metric_key: input.metricKey,
    p_value: Math.round(input.value),
    p_note: input.note ?? null,
  });

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Statistikwert konnte nicht gespeichert werden.") };
  }

  return ok({ saved: true });
}

// Reset one counter to zero. Server-gated to admins + audited.
export async function resetUserStatistic(
  supabase: AppSupabaseClient,
  input: { targetUserId: string; metricKey: string; note?: string },
): Promise<ServiceResult<{ reset: true }>> {
  const { error } = await supabase.rpc("admin_reset_user_metric", {
    target_user_id: input.targetUserId,
    p_metric_key: input.metricKey,
    p_note: input.note ?? null,
  });

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Statistikwert konnte nicht zurückgesetzt werden.") };
  }

  return ok({ reset: true });
}

// Wipe ALL test statistics of one user. Server-gated to admins + audited.
export async function resetAllUserStatistics(
  supabase: AppSupabaseClient,
  input: { targetUserId: string; note?: string },
): Promise<ServiceResult<{ reset: true }>> {
  const { error } = await supabase.rpc("admin_reset_user_stats", {
    target_user_id: input.targetUserId,
    p_note: input.note ?? null,
  });

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Statistiken konnten nicht zurückgesetzt werden.") };
  }

  return ok({ reset: true });
}

// Recent admin audit entries for one user. Admin-only server-side.
export async function listUserStatAudit(
  supabase: AppSupabaseClient,
  targetUserId: string,
  maxRows = 50,
): Promise<ServiceResult<Row<"admin_stat_audit_log">[]>> {
  const { data, error } = await supabase.rpc("admin_list_stat_audit", {
    target_user_id: targetUserId,
    max_rows: maxRows,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Audit-Log konnte nicht geladen werden.") };
  }

  return ok(data);
}
