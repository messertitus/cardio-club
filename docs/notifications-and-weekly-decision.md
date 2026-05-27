# Notifications And Weekly Decision

## Weekly Decision

The fair sport-selection algorithm stays in TypeScript (`src/lib/fairSportSelection.ts`).

For the MVP test phase:

- Users vote during the week.
- The app shows a live preview.
- On Wednesday, an admin can finalize the event decision from the service layer.

For a fully automatic Wednesday decision, run a small server job or Supabase Edge Function every Wednesday. That job should:

1. Load the current weekly event.
2. Call the existing TypeScript decision service.
3. Persist `selected_sport_id`, optional `secondary_sport_id`, `decision_reason`, and `status = decided`.
4. Send notifications to stored push subscriptions.

## Web Push

The database is ready through `push_subscriptions`.

The app can request browser notification permission and store the subscription. Real web push sending requires:

- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` in the frontend.
- A private VAPID key on the server only.
- A server or Supabase Edge Function that sends push payloads.

Never put the private VAPID key into the Expo app.
