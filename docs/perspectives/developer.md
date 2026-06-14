# Entwicklersicht

> Stand: 2026-06-14 · Pflege siehe [MAINTENANCE.md](../MAINTENANCE.md)

## Kurzfassung (Quickstart)

```powershell
npm.cmd install
# .env aus .env.example anlegen:
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   (anon/publishable, NIE service role)
npm.cmd run web        # Dev-Server (Expo Web)
npm.cmd run typecheck  # tsc --noEmit
npm.cmd test           # vitest run
```

- **Stack:** Expo (SDK, React Native + react-native-web), `expo-router`, TypeScript, Supabase (`@supabase/supabase-js`), Vitest.
- **DB-Änderungen:** **immer neue Migration** `NNN_*.sql` (nie bestehende editieren).
- **Pflicht vor Commit:** `typecheck` grün; relevante Tests grün.

## Projektstruktur

| Pfad | Inhalt |
|---|---|
| `app/` | Routen (expo-router), je Datei ein Screen |
| `src/services/` | Datenzugriff (supabase-js), `ServiceResult<T>` |
| `src/lib/` | reine Logik/Hilfen (Voting-, Kompatibilitäts-, Zeitregeln) |
| `src/components/` | UI-Komponenten |
| `src/context/` | `AuthContext`, `ThemeContext` |
| `supabase/migrations/` | Schema/RLS/Funktionen/Trigger (bis 062) |
| `supabase/functions/` | `decision/`, `send-push/` (Edge, Deno) |
| `supabase/maintenance/` | manuelle Ops-SQL/-Skripte |
| `scripts/` | Build-Guards & Tools (`check-web-bundle.mjs`, `create-basic-user.mjs`) |
| `tests/` | Vitest |
| `docs/` | diese Dokumentation |

## Konventionen

- **Services geben `ServiceResult<T>` zurück** (`ok`, `fail`, `fromPostgrestError`) — nicht werfen. Fehler-`message` ist nutzerlesbar (oft deutsch).
- **Lokaler Cache:** Listen über `localCache` mit kurzen TTLs; nach Schreibzugriffen invalidieren (`removeLocalCache`).
- **Zeit/Voting:** ausschließlich Helfer aus `src/services/date.ts` nutzen (`votingOpenNow`, `decisionReleasedNow`, …). Server spiegelt dieselbe Logik — Änderungen **immer auf beiden Seiten** (DB-Funktion + date.ts).
- **Auth-Passwort:** `appPinToAuthPassword(phone, pin)` = `mcc-<letzte6Ziffern>-<pin>`. Wird in `app/auth.tsx` und `scripts/create-basic-user.mjs` identisch gehalten.
- **Stadtbezug:** Mitglieds-Auswahllisten (Standorte/Events) priorisieren die Stadt des Nutzers (`profiles.city`), siehe `recentLocationsFromProfiles`, `uniqueLocationsFromProfiles`, `getMccEventState`.
- **Sprache:** UI-Texte deutsch; Code/Bezeichner englisch.
- **Plattform:** Entwicklung unter Windows/PowerShell (siehe README-Hinweise).

## DB-Migrationen

- Nummeriert `NNN_kurzbeschreibung.sql`, **streng additiv**. Aktuell höchste: **062**.
- RLS auf jeder App-Tabelle. Schreib-/Adminpfade häufig über `security definer`-Funktionen mit `is_current_mcc_admin()`/`is_club_member()`.
- Wichtige Funktionen: `ensure_mcc_week`, `consume_invitation_code`, `validate_invitation_code`, `admin_upsert_sport`, `weekly_event_is_open_for_voting`, `mcc_decision_release_at`, `mcc_voting_close_at`, `mcc_event_weekday_offset`.
- Nach Funktions-/Policy-Änderungen ggf. `notify pgrst, 'reload schema';`.

## Edge Functions

- `supabase/functions/decision/` — Fairness-First-Entscheidung (Deno/TS). **Nie** Algorithmus-Code in den Client importieren.
- `supabase/functions/send-push/` — Web-Push-Versand (VAPID).
- **Bundle-Guard:** `npm.cmd run check:bundle` (`scripts/check-web-bundle.mjs`) bricht ab, falls Algorithmus-Sentinels im `dist/` landen. Teil des PWA-Builds.

## Build / Test / Deploy

| Befehl | Zweck |
|---|---|
| `npm.cmd run web` | Dev-Server |
| `npm.cmd run typecheck` | `tsc --noEmit` |
| `npm.cmd test` | Vitest (gesamt) |
| `npx vitest run <name>` | einzelne Testdatei (gesamter Lauf kann unter Windows OOM-en) |
| `npm.cmd run export:web` / `pwa:build` | statischer Web-/PWA-Export (inkl. Bundle-Guard) |
| `npm.cmd run check:bundle` | Guard separat |

Deploy: statischer Export, z. B. via nginx — siehe [../deployment-ubuntu.md](../deployment-ubuntu.md). DB-Migrationen separat im Supabase SQL-Editor einspielen.

## Stolperfallen

- **Vitest gesamt** kann unter Windows mit libuv-/OOM-Fehlern abbrechen; einzelne Dateien laufen stabil.
- **`*_PUBLIC_`-Präfixe** (`EXPO_PUBLIC_`, `NEXT_PUBLIC_`) landen im Client-Bundle → **niemals** Secrets (Service-Role-Key, Twilio-Token) so benennen.
- **Auth bei bestehender Nummer:** `signUp` verschleiert (leere `identities`, keine SMS). Re-Registrierung scheitert dann lautlos — siehe [operations.md](operations.md).
- **README** ist teils veraltet (nennt noch E-Mail-Auth); maßgeblich ist diese Doku (Phone+PIN, Migration 012+).

## Tests

- Vitest unter `tests/` (z. B. `sportIdeas.test.ts`, `fairConstellationSelection.test.ts`, `sportCompatibility.test.ts`).
- Vor Commit mindestens `typecheck` + die zum Change passenden Tests.
