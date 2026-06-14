# Architektursicht

> Stand: 2026-06-14 · Pflege siehe [MAINTENANCE.md](../MAINTENANCE.md)

## Kurzfassung

Client-seitige **Expo/React-Native-Web-App** (PWA-fähig) gegen ein **Supabase**-Backend
(PostgreSQL + Auth + Edge Functions). Geschäftslogik liegt zu großen Teilen in der
**Datenbank** (RLS-Policies, SQL-Funktionen, Trigger). Sicherheitskritische bzw.
manipulationsanfällige Logik — vor allem der **Entscheidungs-Algorithmus** — läuft
ausschließlich in **Edge Functions**, nie im Client.

```
[ Expo App (Web/PWA, RN) ]
      |  supabase-js (anon key, RLS-geschützt)
      v
[ Supabase ]
   ├─ PostgreSQL  ── Tabellen + RLS-Policies + SQL-Funktionen + Trigger
   ├─ Auth        ── Phone+Password(PIN), SMS-OTP via Twilio
   └─ Edge Funcs  ── decision/ (Fairness-Algorithmus), send-push/ (Web Push)
```

## Bausteine

### Frontend (`app/`, `src/`)
- **Routing:** `expo-router` (dateibasiert) unter `app/`. Wichtige Routen: `index` (Home/Events), `auth`, `ideas`, `chat`, `members`, `menu`, `profile`, `admin`, `settings`, `push`, `install`, `invites`, `events/history`, `events/[eventId]/{vote,attendance,decision,propose,results,close}`, `clubs/...`.
- **Services (`src/services/`, ~35 Module):** dünne Datenzugriffsschicht über `supabase-js`. Einheitliches `ServiceResult<T>` (`ok/fail/fromPostgrestError`) statt Exceptions. Lokaler Cache (`localCache`) für Listen.
- **Lib (`src/lib/`):** reine Logik/Hilfen (z. B. `sportCompatibility`, `votingRules`, `votingEligibility`, `decisionTypes`, `postalCity`, `analyticsEvents`).
- **Context:** `AuthContext` (Session/User), `ThemeContext`.
- **Komponenten (`src/components/`):** UI-Bausteine (`FormControls`/`MapLocationPicker`, `EventFlowCard`, `BottomNav`, …).

### Backend (`supabase/`)
- **`migrations/` (fortlaufend nummeriert, aktuell bis 062):** Schema, RLS, SQL-Funktionen, Trigger. **Regel: nie eine bestehende Migration ändern — immer neue Datei.**
- **`functions/decision/`:** der Fairness-First-Entscheidungsdienst (TypeScript/Deno). Enthält `_shared/algorithm.ts` etc. — **darf nicht ins Client-Bundle**.
- **`functions/send-push/`:** Versand von Web-Push-Nachrichten.
- **`maintenance/`:** manuelle Ops-SQL/-Skripte (z. B. verwaiste Telefon-Signups löschen).

## Zentrale Architektur-Entscheidungen (ADR-artig)

1. **Logik in der DB + RLS als primäre Sicherheitsgrenze.** Der Client nutzt nur den anon key; jede Tabelle hat RLS. Schreibpfade gehen oft über `security definer`-Funktionen mit Admin-Check.
2. **Entscheidungs-Algorithmus nur serverseitig.** Verhindert Manipulation und Leaks. Ein Build-Guard (`scripts/check-web-bundle.mjs`) bricht den Web-Export ab, falls Algorithmus-Sentinels im `dist/` auftauchen.
3. **Einheitliche Zeit-/Voting-Logik auf Client und Server.** `src/services/date.ts` definiert Voting-/Entscheidungsfenster; die DB spiegelt dieselbe Logik (`weekly_event_is_open_for_voting`, `mcc_decision_release_at`, `mcc_voting_close_at`), damit beide Seiten nie widersprechen.
4. **Stadtgebundene Events.** `weekly_events.city`, `mcc_active_cities`; `ensure_mcc_week()` provisioniert Events je **aktiver** Stadt. UI priorisiert die **Stadt des Nutzers**.
5. **n:m Sportart↔Standort.** `sports` (abstrakt) ↔ `sport_profiles` (konkreter Standort) über `sport_profile_sports`.
6. **Phone-first Auth.** Telefonnummer + aus PIN abgeleitetem Passwort; SMS-OTP zur Bestätigung; Beitritt nur per Einladungscode.

## Wichtige Datenflüsse

- **Wochenstart:** App-Start ruft `ensure_mcc_week()` → legt/liefert die Cardiotage der aktiven Städte; fügt den eingeloggten User automatisch als `club_members` hinzu.
- **Teilnahme/Voting:** Client schreibt in `attendance`/`sport_votes`/`sport_no_gos`; RLS-Gate `weekly_event_is_open_for_voting` prüft das Zeitfenster serverseitig.
- **Entscheidung:** zur Entscheidungszeit (2 Tage vor Event, zur Event-Uhrzeit) erzeugt der `decision`-Dienst den fairen Beschluss; Ergebnisse landen in `event_activities`/Entscheidungsdaten.
- **Benachrichtigungen:** Regeln + geplante Jobs (Migrationen 040/050/052–055) erzeugen Push-Jobs; `send-push` stellt zu.

## Grenzen & Kopplungen

- Harte externe Abhängigkeiten: **Supabase**, **Twilio** (SMS), Web-Push (VAPID).
- Single-Club-Produkt auf Multi-Club-Datenmodell.
- Auth-Eigenheiten (Obfuscation bei bestehender Nummer, OTP-Ablauf) → siehe [operations.md](operations.md) und [security-and-privacy.md](security-and-privacy.md).

## Tiefer eintauchen

- Datenmodell: [../schema.md](../schema.md), Klassendiagramm: [../class-diagram.md](../class-diagram.md)
- Algorithmus: [../fairness-first-algorithmus-handoff.md](../fairness-first-algorithmus-handoff.md)
- Benachrichtigungen: [../notifications-and-weekly-decision.md](../notifications-and-weekly-decision.md)
