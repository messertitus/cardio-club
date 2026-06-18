# Notifications And Weekly Decision

## Weekly Decision

The Fairness-First Constellation algorithm runs **server-side only**, in the
`decision` Edge Function (`supabase/functions/decision/`). The client never
recomputes it.

**One run, no preview.** The algorithm runs **exactly once, 48 h before the
event** (the decision moment = `starts_at − 2 days`), picks the sport
constellation and persists it (`status = decided`, `selected_sport_id`,
`event_activities`, and a **frozen `weather_snapshot`**). There is no live
preview: during the voting phase the UI only shows a hint ("Entscheidung fällt
48 h vorher"); the decision appears once it is finalized, and because the weather
snapshot is frozen it is identical on every device. The event chats open once the
event is `decided`.

**What triggers the single run (`action: "finalize-due"` on the decision
function, idempotent via a `status in (proposing,voting)` guard):**

1. **Server sweep** — the periodic `send-push` Edge Function calls
   `finalize-due` every run (independent of push quiet hours). This is the
   primary, time-driven path (needs `send-push` scheduled).
2. **Client fallback** — when a member opens the Home or Chat screen,
   `triggerDueFinalize()` (throttled) calls the same `finalize-due`, so the
   decision is finalized even without a server cron.

Events that reach the decision moment with fewer than two attending voters have
no eligible constellation; `finalize-due` skips them and
`cancel_underused_events()` archives them (status `cancelled`).

The finalize itself (`finalizeEventDecision`):

1. Load the current weekly event.
2. Call the existing TypeScript decision service.
3. Load concrete `sport_profiles`, No-Gos, `going`/`maybe` attendance, history, and weather data.
4. Build Single, Multi-Sport, and Twin candidates from sport profiles, then rank them with fairness-first ordering: fairness and minority protection can overrule close raw totals, shared events stay preferred until Twin is clearly fairer or stronger.
5. Persist `decision_type`, `decision_scorecard`, `weather_snapshot`, compatibility `selected_sport_id`/`secondary_sport_id`, `decision_reason`, `event_activities`, and `status = decided`.
6. Send notifications to stored push subscriptions.

Votes without an explicit `going` or `maybe` attendance row should not influence the decision. After the event, an admin/AP should use `review_event_attendance` to store actual attendance, which feeds future reliability weighting.

## Push notifications

### Quiet hours (daytime only)

Pushes are delivered only during **Berlin 09:00–22:00**. Both delivery paths
enforce this: the `send-push` edge function (background Web Push) and the in-app
`AppNotificationBridge` (foreground). Outside the window, notifications stay
queued in `app_notifications` and go out on the first run after 09:00 — nothing
is dropped. The shared source of truth is `isWithinPushWindow()` in
`src/services/date.ts`; the edge function mirrors the same Berlin 09–22 check in
Deno. (The weekly invite reminder additionally enqueues only Berlin 10:00–20:00,
a subset of this window.)

### Weekday in the text

Notifications name the event's day, e.g. **"Neue Abstimmung für Samstag"**,
**"Stimme für Sonntag fällig"**, **"Auswertung für Samstag ist da"**. The SQL
helper `mcc_event_day_label_de(weekday)` (migration 064) maps the `event_day`
enum text to a German weekday. Admin-customized titles from `notification_rules`
are preserved and get the day appended as "&lt;title&gt; – Samstag".

### The five notifications

A queue table `app_notifications` is filled, then delivered. The five cases:

1. **Voting opened** — job `enqueue_vote_open_notifications()` (migration 063). Fires when an event's voting window is actually open (`weekly_event_is_open_for_voting`), once per member/event, city-scoped. Replaces the former `enqueue_weekly_event_notification` insert trigger, which fired per created event (so a new week with a Saturday + Sunday event produced two pushes even when only one was votable).
2. **Vote closing in ~12h** (only if the member has not voted and is not `not_going`) — job `enqueue_vote_reminders()`.
3. **Decision released** (only `going`/`maybe` attendees) — job `enqueue_decision_release_notifications()` (time-based, needs no admin finalize) plus the `enqueue_decision_notification` trigger if an admin finalizes.
4. **Chat message** — trigger `enqueue_chat_notification` (event `going`/`maybe` attendees, excluding the author).
5. **Weekly invite reminder** (only members with at least one unused invite code) — job `enqueue_weekly_invite_reminders()` (once per ISO week, **daytime only: Berlin 10:00–20:00**, migration 063).

> The shared runner `run_mcc_notification_jobs()` runs every few minutes (via the `send-push` scheduled function), so time-gated jobs (1 and 5) fire on the first run inside their window.

`run_mcc_notification_jobs()` runs jobs 2/3/5 and is dedup-safe. The app calls it
every few minutes while open (`AppNotificationBridge`), so notifications appear
**in-app without any server cron**. For delivery while the app is **closed**, use
the edge function below.

### Foreground (already working)

`AppNotificationBridge` polls `app_notifications`, shows each with the Web
Notification API, and marks it delivered. This works whenever the PWA is open,
even without VAPID keys.

### Background delivery (real Web Push)

1. Generate VAPID keys: `npx web-push generate-vapid-keys`.
2. Frontend `.env`: `EXPO_PUBLIC_VAPID_PUBLIC_KEY=<public key>` (so the client subscribes via the push worker). Re-export the web build.
3. Function secrets (never expose the private key to the app):
   ```
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:admin@messers-cardio-club.de
   ```
4. Deploy the sender: `supabase functions deploy send-push --no-verify-jwt`.
   It runs `run_mcc_notification_jobs()` and sends every undelivered notification
   to the user's `push_subscriptions`, removing dead endpoints (404/410).
5. Schedule it every 1–5 minutes — a Supabase scheduled function, or pg_cron + pg_net:
   ```sql
   select cron.schedule('mcc-push', '*/2 * * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/send-push',
       headers := jsonb_build_object('Authorization', 'Bearer <anon-or-service-key>')
     );
   $$);
   ```

Never put the private VAPID key into the Expo app.
