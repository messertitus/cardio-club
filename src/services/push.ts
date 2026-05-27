import type { Json } from "./database.types";
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
