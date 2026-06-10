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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@messers-cardio-club.de";

  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    return Response.json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VAPID keys" }, { status: 500 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1) Enqueue the time-based notifications (vote reminder / decision / weekly invite).
  await supabase.rpc("run_mcc_notification_jobs");

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

  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (subscriptions ?? []) as SubscriptionRow[]) {
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

  return Response.json({ sent, processed: notifications.length });
});
