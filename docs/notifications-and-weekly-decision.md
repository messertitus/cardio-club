# Notifications And Weekly Decision

## Weekly Decision

The Fairness-First Constellation algorithm stays in TypeScript (`src/lib/fairConstellationSelection.ts`).

For the MVP test phase:

- Users vote during the week.
- The app shows a live preview.
- On Wednesday, an admin can finalize the event decision from the service layer.

For a fully automatic Wednesday decision, run a small server job or Supabase Edge Function every Wednesday. That job should:

1. Load the current weekly event.
2. Call the existing TypeScript decision service.
3. Load concrete `sport_profiles`, No-Gos, `going`/`maybe` attendance, history, and weather data.
4. Build Single, Multi-Sport, and Twin candidates from sport profiles, then rank them with fairness-first ordering: fairness and minority protection can overrule close raw totals, shared events stay preferred until Twin is clearly fairer or stronger.
5. Persist `decision_type`, `decision_scorecard`, `weather_snapshot`, compatibility `selected_sport_id`/`secondary_sport_id`, `decision_reason`, `event_activities`, and `status = decided`.
6. Send notifications to stored push subscriptions.

Votes without an explicit `going` or `maybe` attendance row should not influence the decision. After the event, an admin/AP should use `review_event_attendance` to store actual attendance, which feeds future reliability weighting.

## Push notifications

### The five notifications

A queue table `app_notifications` is filled, then delivered. The five cases:

1. **Voting opened** — trigger `enqueue_weekly_event_notification` on `weekly_events` insert (all club members).
2. **Vote closing in ~12h** (only if the member has not voted and is not `not_going`) — job `enqueue_vote_reminders()`.
3. **Decision released** (only `going`/`maybe` attendees) — job `enqueue_decision_release_notifications()` (time-based, needs no admin finalize) plus the `enqueue_decision_notification` trigger if an admin finalizes.
4. **Chat message** — trigger `enqueue_chat_notification` (event `going`/`maybe` attendees, excluding the author).
5. **Weekly invite reminder** (only members with at least one unused invite code) — job `enqueue_weekly_invite_reminders()` (once per ISO week).

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
