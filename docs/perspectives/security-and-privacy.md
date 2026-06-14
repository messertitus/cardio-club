# Security & Datenschutz

> Stand: 2026-06-14 · Pflege siehe [MAINTENANCE.md](../MAINTENANCE.md)

## Kurzfassung

- **RLS auf jeder App-Tabelle** ist die primäre Sicherheitsgrenze; der Client nutzt nur den **anon key**.
- **Phone-first Auth** (Telefonnummer + aus PIN abgeleitetem Passwort), SMS-OTP via Twilio, Beitritt nur per **Einladungscode**.
- **Sensible Logik nur serverseitig** (Entscheidungs-Algorithmus in Edge Function, Build-Guard gegen Leak).
- **Analytics privacy-first** — strukturiert, ohne Gamification/Tracking-Schnickschnack.

## Authentifizierung & Autorisierung

- **Login:** `signInWithPassword({ phone, password })`. Passwort = `appPinToAuthPassword(phone, pin)` (`mcc-<6>-<pin>`), mit Fallback auf reine PIN für Altbestände.
- **Registrierung:** einladungsgated → `signUp(phone, password)` → SMS-OTP (`verifyOtp type:"sms"`) → `consume_invitation_code` → Profil/Mitgliedschaft.
- **Rollen:** `profiles.role` und `club_members.role`; Admin-Check zentral via `is_current_mcc_admin()` / `is_club_member()`.
- **Bekannte Auth-Eigenheiten:**
  - `signUp` einer **bestehenden** Nummer liefert eine verschleierte Erfolgsantwort (leere `identities`) und sendet **keine** SMS (Anti-Enumeration).
  - Einladungscode wird **vor** `signUp` erneut validiert, damit kein bestätigter Auth-User ohne Mitgliedschaft („Orphan") entsteht.

## Row Level Security (RLS)

- Jede App-Tabelle hat Policies; Schreib-/Adminpfade häufig über `security definer`-Funktionen.
- **Beispiele/Lehren:**
  - `sports`: UPDATE nur durch Ersteller **oder Admin** (Admin-Policy ergänzt, Migration 061).
  - `attendance`/`sport_votes`/`sport_no_gos`: INSERT/UPDATE durch das gleiche **Voting-Zeitfenster-Gate** (`weekly_event_is_open_for_voting`, an Event-Zeit angeglichen, Migration 062).
  - `mcc_active_cities`, `sport_profile_sports`: lesbar für Mitglieder, verwaltet durch Admins.

## Secrets & Konfiguration

- **Öffentlich (ok im Client):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon).
- **Geheim (nie im Client / nie `*_PUBLIC_`):** Service-Role-Key, Twilio-Account-Token, VAPID-Private-Key.
- ⚠️ **`EXPO_PUBLIC_`/`NEXT_PUBLIC_`-Variablen werden ins Client-Bundle eingebettet.** Ein Service-Role-Key mit solchem Präfix ist ein RLS-Bypass-Leck → entfernen und **rotieren**.

## Schutz des Entscheidungs-Algorithmus

- Läuft ausschließlich in `supabase/functions/decision/`. **Kein** Import in Client-Code.
- `scripts/check-web-bundle.mjs` bricht den Web-Export ab, wenn Algorithmus-Sentinels im `dist/` erscheinen.

## Datenschutz / Privacy

- Analytics-Grundlage ist **privacy-first** strukturiert; es werden Daten erfasst, aber keine Gamification/Badges angezeigt (siehe [../analytics-and-privacy.md](../analytics-and-privacy.md)).
- Personenbezug: Telefonnummer, Anzeigename, Stadt/PLZ, Teilnahme-/Voting-Verhalten. Zugriff über RLS auf Club-Mitglieder beschränkt.

## Offene Punkte / Empfehlungen

- Optionaler Build-/CI-Guard, der **Service-Role-Keys im `dist/`** erkennt.
- Periodischer Cleanup verwaister, unbestätigter Auth-User (heute manuell via `delete_orphaned_phone_user.sql`).
