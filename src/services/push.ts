import type { Json, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function saveWebPushSubscription(
  supabase: AppSupabaseClient,
  input: { userId: string; endpoint: string; subscription: Json },
): Promise<ServiceResult<{ saved: true }>> {
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: input.userId,
      platform: "web",
      endpoint: input.endpoint,
      subscription: input.subscription,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Push-Abo konnte nicht gespeichert werden.") };
  }

  return ok({ saved: true });
}

export async function listUndeliveredAppNotifications(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<ServiceResult<Row<"app_notifications">[]>> {
  const { data, error } = await supabase
    .from("app_notifications")
    .select()
    .eq("user_id", userId)
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigungen konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function markAppNotificationsDelivered(
  supabase: AppSupabaseClient,
  notificationIds: string[],
): Promise<ServiceResult<{ saved: true }>> {
  if (notificationIds.length === 0) return ok({ saved: true });

  const { error } = await supabase
    .from("app_notifications")
    .update({ delivered_at: new Date().toISOString() })
    .in("id", notificationIds);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Benachrichtigungen konnten nicht bestaetigt werden.") };
  }

  return ok({ saved: true });
}

// Runs the time-based notification jobs (vote reminders, decision release,
// weekly invite reminder). Dedup-safe, so the app can call it on each poll —
// this keeps notifications flowing even without a server-side cron.
export async function runNotificationJobs(supabase: AppSupabaseClient): Promise<void> {
  try {
    await supabase.rpc("run_mcc_notification_jobs");
  } catch {
    // Best-effort: never block notification delivery on the job run.
  }
}

export function canUseWebPush(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function requestWebPushSubscription(): Promise<{ endpoint: string; subscription: Json } | null> {
  if (!canUseWebPush()) {
    return null;
  }

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    const permission = await Notification.requestPermission();
    return permission === "granted" ? { endpoint: "browser-notification-permission", subscription: { permission } } : null;
  }

  const registration = await navigator.serviceWorker.register("/mcc-push-worker.js");
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return null;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  return {
    endpoint: subscription.endpoint,
    subscription: subscription.toJSON() as Json,
  };
}

export async function showBrowserNotification(notification: Pick<Row<"app_notifications">, "title" | "body" | "href" | "kind">): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const options: NotificationOptions = {
    body: notification.body,
    tag: `mcc-${notification.kind}`,
    icon: "/mcc-icon.png",
    badge: "/mcc-icon.png",
    data: { href: notification.href },
  };

  const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (registration?.showNotification) {
    await registration.showNotification(notification.title, options);
    return true;
  }

  const browserNotification = new Notification(notification.title, options);
  browserNotification.onclick = () => {
    window.focus();
    window.location.assign(notification.href);
  };
  return true;
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}
