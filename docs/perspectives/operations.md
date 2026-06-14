# Betrieb / Ops

> Stand: 2026-06-14 · Pflege siehe [MAINTENANCE.md](../MAINTENANCE.md)

## Kurzfassung

- **Frontend:** statischer Web-/PWA-Export (Expo) → z. B. nginx ([../deployment-ubuntu.md](../deployment-ubuntu.md)).
- **Backend:** Supabase (DB/Auth/Edge Functions). **Migrationen manuell** im SQL-Editor in Reihenfolge einspielen.
- **SMS:** Twilio über Supabase Auth.
- **Wartung:** manuelle SQL/Skripte unter `supabase/maintenance/` und `scripts/`.

## Deploy-Ablauf

1. **DB-Migrationen** (neue `NNN_*.sql`) im Supabase SQL-Editor in Reihenfolge ausführen. Aktuell offen je nach Umgebung: bis **062**.
2. **Edge Functions** deployen, wenn `decision/` oder `send-push/` geändert wurden.
3. **Frontend** bauen (`pwa:build`, inkl. Bundle-Guard) und Export ausliefern.
4. Bei Funktions-/Policy-Änderungen ggf. PostgREST-Schema-Reload (`notify pgrst, 'reload schema';`).

> Reihenfolge beachten: DB-Migrationen, die das Frontend voraussetzt, **vor** dem Frontend-Deploy einspielen. RLS-/Server-Fixes (z. B. Voting-Gate) wirken unabhängig vom Client-Deploy.

## Konfiguration / Secrets

- **Client:** nur `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon). Diese dürfen öffentlich sein (RLS schützt).
- **Niemals** Secrets mit `EXPO_PUBLIC_`/`NEXT_PUBLIC_`-Präfix — die landen im Client-Bundle. Service-Role-Key, Twilio-Token etc. nur unpräfixiert/serverseitig.
- **Supabase-Dashboard:** Auth-Provider (Phone/Twilio), Rate Limits, OTP-Ablauf, aktive VAPID-Keys für Push.

## Runbooks (häufige Vorfälle)

### SMS kommt bei Registrierung nicht an
1. **Twilio-Logs** und **Supabase → Logs → Auth** prüfen (echter Provider-Fehler/Rate-Limit).
2. **Supabase → Authentication → Rate Limits → SMS** prüfen/erhöhen.
3. **OTP-Ablauf** (Provider/Phone) erhöhen, falls Codes „expired" sind, bevor die SMS ankommt (Empfehlung ~600 s).
4. **Nummer bereits registriert?** `signUp` verschleiert bestehende Nummern und sendet **keine** SMS.

### „Phone number already registered" / Nummer blockiert (verwaister Auth-User)
- Ursache: Auth-User existiert, aber Onboarding nie abgeschlossen (kein `club_members`-Eintrag) — Telefon evtl. bestätigt.
- Fix: `supabase/maintenance/delete_orphaned_phone_user.sql` (löscht nur Nutzer **ohne** Club-Mitgliedschaft, egal ob bestätigt; echte Mitglieder bleiben unangetastet). Erst Teil 1 (prüfen `has_club_membership=false`), dann Teil 2 (löschen).

### Mitglied manuell anlegen (Notfall)
- `scripts/create-basic-user.mjs` (benötigt **Service-Role-Key**, nur lokal):
  ```powershell
  $env:SUPABASE_URL="https://<projekt>.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
  node scripts/create-basic-user.mjs "+49..." "1234" "Vorname"
  ```
  Telefon-bestätigter Account, Passwort aus PIN. Profil legt der Trigger an, Club-Mitgliedschaft entsteht beim ersten Login.

### Abstimmen schlägt mit RLS-Fehler fehl
- „new row violates row-level security policy for table attendance": Voting-Zeitfenster-Gate (`weekly_event_is_open_for_voting`) muss zur clientseitigen Logik passen (Migration 062). DB-Migration einspielen.

### Push kommt nicht an
- VAPID-Keys, Subscriptions und `send-push` prüfen; Details in [../push-setup.md](../push-setup.md) und [../notifications-and-weekly-decision.md](../notifications-and-weekly-decision.md).

## Wartungsartefakte

| Pfad | Zweck |
|---|---|
| `supabase/maintenance/delete_orphaned_phone_user.sql` | verwaiste Telefon-Signups gezielt löschen |
| `supabase/maintenance/reset_for_phone_test.sql` | **destruktiv** — alle User/Daten zurücksetzen (nur Test) |
| `scripts/create-basic-user.mjs` | login-fähiges Basis-Konto via Service-Role |
| `scripts/check-web-bundle.mjs` | Build-Guard gegen Algorithmus-Leak |

## Monitoring / Logs (heute)

- Kein dediziertes Observability-Stack; Quellen sind **Supabase-Logs** (Auth/DB/Edge) und **Twilio-Logs**.
- App-seitig: privacy-first Analytics-Grundlage (siehe [../analytics-and-privacy.md](../analytics-and-privacy.md)).
