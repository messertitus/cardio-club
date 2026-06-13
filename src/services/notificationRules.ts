import type { Json, NotificationRuleKind, NotificationRuleStatus, Row } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";
import type { NotificationRuleConditions, NotificationRuleSchedule } from "../lib/notificationRuleView";

export type NotificationRule = Row<"notification_rules">;

export type NotificationRuleInput = {
  kind: NotificationRuleKind;
  title: string;
  body: string;
  href?: string;
  clubId?: string | null;
  conditions: NotificationRuleConditions;
  schedule: NotificationRuleSchedule;
  status?: NotificationRuleStatus;
};

// Admin-only reads are enforced by RLS (the table has no policy for non-admins),
// so a normal user simply gets an empty list / permission error from Postgres.
export async function listNotificationRules(supabase: AppSupabaseClient): Promise<ServiceResult<NotificationRule[]>> {
  const { data, error } = await supabase.from("notification_rules").select().order("created_at", { ascending: false });
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigungsregeln konnten nicht geladen werden.") };
  }
  return ok(data);
}

export async function createNotificationRule(supabase: AppSupabaseClient, input: NotificationRuleInput): Promise<ServiceResult<NotificationRule>> {
  const validation = validateRule(input);
  if (validation) return fail(validation);

  const { data, error } = await supabase
    .from("notification_rules")
    .insert({
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      href: input.href?.trim() || "/",
      club_id: input.clubId ?? null,
      conditions: input.conditions as Json,
      schedule: input.schedule as Json,
      status: input.status ?? "draft",
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Regel konnte nicht erstellt werden.") };
  }
  return ok(data);
}

export async function updateNotificationRule(
  supabase: AppSupabaseClient,
  id: string,
  input: NotificationRuleInput,
): Promise<ServiceResult<NotificationRule>> {
  const validation = validateRule(input);
  if (validation) return fail(validation);

  const { data, error } = await supabase
    .from("notification_rules")
    .update({
      kind: input.kind,
      title: input.title.trim(),
      body: input.body.trim(),
      href: input.href?.trim() || "/",
      club_id: input.clubId ?? null,
      conditions: input.conditions as Json,
      schedule: input.schedule as Json,
      ...(input.status ? { status: input.status } : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Regel konnte nicht gespeichert werden.") };
  }
  return ok(data);
}

export async function setNotificationRuleStatus(
  supabase: AppSupabaseClient,
  id: string,
  status: NotificationRuleStatus,
): Promise<ServiceResult<NotificationRule>> {
  const { data, error } = await supabase.from("notification_rules").update({ status }).eq("id", id).select().single();
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Status konnte nicht geändert werden.") };
  }
  return ok(data);
}

export async function deleteNotificationRule(supabase: AppSupabaseClient, id: string): Promise<ServiceResult<{ deleted: true }>> {
  const { error } = await supabase.from("notification_rules").delete().eq("id", id);
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Regel konnte nicht gelöscht werden.") };
  }
  return ok({ deleted: true });
}

// Controlled send. `testOnly` delivers only to the calling admin (live preview);
// a real send requires the rule to be active and is enforced server-side.
export async function sendNotificationRule(
  supabase: AppSupabaseClient,
  id: string,
  options: { testOnly?: boolean } = {},
): Promise<ServiceResult<{ queued: number }>> {
  const { data, error } = await supabase.rpc("admin_send_notification_rule", { rule_id: id, test_only: options.testOnly ?? false });
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigung konnte nicht gesendet werden.") };
  }
  return ok({ queued: typeof data === "number" ? data : 0 });
}

function validateRule(input: NotificationRuleInput): string | null {
  if (!input.title.trim()) return "Bitte gib einen Titel ein.";
  if (!input.body.trim()) return "Bitte gib einen Nachrichtentext ein.";
  return null;
}

// ---- Queue management (the actual app_notifications rows) -------------------
// Admin-only via RLS (admins can read/delete the whole queue; normal users only
// their own rows).

export type AppNotificationView = {
  id: string;
  recipientName: string;
  kind: string;
  title: string;
  body: string;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listRecentNotifications(supabase: AppSupabaseClient, limit = 80): Promise<ServiceResult<AppNotificationView[]>> {
  const { data, error } = await supabase
    .from("app_notifications")
    .select("id, user_id, kind, title, body, delivered_at, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigungen konnten nicht geladen werden.") };
  }

  const userIds = [...new Set(data.map((row) => row.user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
    for (const profile of profiles ?? []) names.set(profile.id, profile.display_name);
  }

  return ok(
    data.map((row) => ({
      id: row.id,
      recipientName: names.get(row.user_id) ?? "Mitglied",
      kind: row.kind,
      title: row.title,
      body: row.body,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
  );
}

export async function deleteAppNotification(supabase: AppSupabaseClient, id: string): Promise<ServiceResult<{ deleted: true }>> {
  const { error } = await supabase.from("app_notifications").delete().eq("id", id);
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigung konnte nicht gelöscht werden.") };
  }
  return ok({ deleted: true });
}

export async function clearAppNotifications(
  supabase: AppSupabaseClient,
  scope: "pending" | "delivered",
): Promise<ServiceResult<{ cleared: true }>> {
  const query = supabase.from("app_notifications").delete();
  const { error } = scope === "pending" ? await query.is("delivered_at", null) : await query.not("delivered_at", "is", null);
  if (error) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigungen konnten nicht gelöscht werden.") };
  }
  return ok({ cleared: true });
}
