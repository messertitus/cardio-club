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

## Web Push

The database is ready through `push_subscriptions`.

The app can request browser notification permission and store the subscription. Real web push sending requires:

- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` in the frontend.
- A private VAPID key on the server only.
- A server or Supabase Edge Function that sends push payloads.

Never put the private VAPID key into the Expo app.
