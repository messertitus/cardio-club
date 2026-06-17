// Supabase Edge Function: delivers queued app_notifications as Web Push.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:admin@messers-cardio-club.de
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)
// Schedule: call this function every 1–5 minutes (Supabase scheduled function or
//           pg_cron + pg_net). It also runs run_mcc_notification_jobs() first, so
//           the time-based reminders (vote / decision / weekly invite) get enqueued.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
};

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
};

Deno.serve(async () => {
 try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
  const vapidPrivate = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();
  // The VAPID "subject" is a contact identifier for the push service (NOT the
  // recipient) and must be a mailto: or https: URL. Auto-prefix a bare email so
  // a value like "you@example.com" works instead of throwing.
  let vapidSubject = (Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@messers-cardio-club.de").trim();
  if (vapidSubject && !/^https?:\/\//i.test(vapidSubject) && !vapidSubject.startsWith("mailto:")) {
    vapidSubject = `mailto:${vapidSubject}`;
  }

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return Response.json(
      {
        error: "Missing env",
        hasUrl: Boolean(supabaseUrl),
        hasServiceKey: Boolean(serviceKey),
        hasVapidPublic: Boolean(vapidPublic),
        hasVapidPrivate: Boolean(vapidPrivate),
      },
      { status: 500 },
    );
  }

  // Malformed VAPID keys make setVapidDetails throw — surface that clearly
  // instead of a bare 500, so the cause is visible in net._http_response.
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (vapidError) {
    return Response.json({ error: `Invalid VAPID config: ${(vapidError as Error)?.message ?? vapidError}` }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 0) Quiet hours: never deliver a push at night. Outside Berlin 09:00–22:00 we
  // skip both enqueueing and delivery; queued notifications simply wait and go
  // out on the first run after 09:00. Mirrors isWithinPushWindow() in
  // src/services/date.ts (shared with the in-app AppNotificationBridge).
  const PUSH_WINDOW_START_HOUR = 9;
  const PUSH_WINDOW_END_HOUR = 22;
  const berlinHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  if (berlinHour < PUSH_WINDOW_START_HOUR || berlinHour >= PUSH_WINDOW_END_HOUR) {
    return Response.json({ skipped: "quiet-hours", berlinHour });
  }

  // 1) Enqueue the time-based notifications (vote reminder / decision / weekly invite).
  // Best-effort: a job error must not abort delivery of already-queued notifications.
  const jobs = await supabase.rpc("run_mcc_notification_jobs");
  if (jobs.error) console.error("run_mcc_notification_jobs failed:", jobs.error.message);

  // 2) Load undelivered notifications.
  const { data: notifications, error } = await supabase
    .from("app_notifications")
    .select("id, user_id, kind, title, body, href")
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!notifications || notifications.length === 0) return Response.json({ sent: 0, processed: 0 });

  const userIds = [...new Set(notifications.map((n: NotificationRow) => n.user_id))];
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, subscription")
    .eq("platform", "web")
    .in("user_id", userIds);

  // Only real Web Push endpoints (https URLs). The no-VAPID client fallback used
  // to store a sentinel endpoint "browser-notification-permission" — those can
  // never receive a push, so skip (and count) them instead of trying.
  const subsByUser = new Map<string, SubscriptionRow[]>();
  let skippedInvalid = 0;
  for (const sub of (subscriptions ?? []) as SubscriptionRow[]) {
    if (!/^https?:\/\//i.test(sub.endpoint)) {
      skippedInvalid += 1;
      continue;
    }
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let sent = 0;
  const deadEndpoints: string[] = [];
  const deliveredIds: string[] = [];

  for (const notification of notifications as NotificationRow[]) {
    const userSubs = subsByUser.get(notification.user_id) ?? [];
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: `mcc-${notification.kind}`,
      data: { href: notification.href ?? "/" },
    });

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        sent += 1;
      } catch (sendError) {
        const statusCode = (sendError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) deadEndpoints.push(sub.endpoint);
      }
    }
    deliveredIds.push(notification.id);
  }

  if (deliveredIds.length > 0) {
    await supabase.from("app_notifications").update({ delivered_at: new Date().toISOString() }).in("id", deliveredIds);
  }
  if (deadEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", deadEndpoints);
  }

  return Response.json({ sent, processed: notifications.length, skippedInvalid });
 } catch (handlerError) {
  // Surface the real cause in the response body (and logs) instead of a bare
  // platform "Internal Server Error".
  console.error("send-push failed:", handlerError);
  return Response.json({ error: String((handlerError as Error)?.message ?? handlerError) }, { status: 500 });
 }
});
