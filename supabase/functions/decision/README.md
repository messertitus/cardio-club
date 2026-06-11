# `decision` Edge Function

Server-side home of the **fair-constellation decision algorithm**. This is the
central secret of the app: scoring formulas, candidate ranking, fairness / no-go
mechanics and the tuned `DEFAULT_OPTIONS` weights.

## Why this exists

The web/PWA bundle is fully inspectable by anyone. The algorithm used to run in
the browser (`src/lib/fairConstellationSelection.ts`), so its complete logic and
weights shipped to every client. It now runs **only here**. The client calls this
function and renders the sanitized `DecisionView` it returns — it never sees the
raw scores, ranking margins, candidate ids, fairness-debt, weighted vote scores
or option weights.

## Rules (do not break)

- **Never import anything from `supabase/functions/decision/` into client code**
  (`app/**`, `src/**`). Doing so re-bundles the secret. Two guards enforce this:
  - `tests/algorithmIsolation.test.ts` — fails if client source imports the
    algorithm or references `selectFairConstellation`.
  - `scripts/check-web-bundle.mjs` (wired into `npm run pwa:build`) — fails if any
    algorithm sentinel string ends up in `dist/`.
- The frontend may only depend on the **types** in `src/lib/decisionTypes.ts`
  (I/O data shapes / enums) and `src/lib/decisionView.ts` (the sanitized result).
- Keep the `DecisionView` shape in `_shared/sanitize.ts` in sync with
  `src/lib/decisionView.ts` — they are the public contract.

## Layout

| File | Role |
| --- | --- |
| `index.ts` | HTTP handler. Auth, `preview` / `finalize` actions, CORS. |
| `_shared/algorithm.ts` | The algorithm (verbatim copy of the former client file). Self-contained, zero imports. |
| `_shared/decisionService.ts` | Data fetching + running the algorithm + persisting a finalized decision. |
| `_shared/decisionPresentation.ts` | Turns a decision into friendly explanation texts. |
| `_shared/weather.ts` | Open-Meteo weather snapshot for outdoor profiles. |
| `_shared/sanitize.ts` | Builds the sanitized `DecisionView` (the only payload the client receives). |

## API

`POST` with a member's `Authorization: Bearer <jwt>` (the client gets this for
free via `supabase.functions.invoke("decision", { body })`).

```jsonc
// preview — any member that may read the event
{ "eventId": "<uuid>", "action": "preview" }
// -> { "view": DecisionView }

// finalize — admins / managers only; persists the decision with the service role
{ "eventId": "<uuid>", "action": "finalize" }
// -> { "event": <weekly_events row>, "view": DecisionView }
```

Reads use a client scoped to the caller's JWT (RLS applies). Finalize writes use
the service role, so the client never needs write access to the protected
`weekly_events` decision columns (see migration `044`).

## Deploy

```bash
supabase functions deploy decision
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided
by the platform automatically — no extra secrets needed.
