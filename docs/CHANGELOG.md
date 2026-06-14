# Doku-Changelog

Chronologisches Protokoll dokumentierter Änderungen am **Stand der App** und an
dieser Dokumentation. **Neuestes oben.** Entferntes wird unter `Entfernt`
ausdrücklich festgehalten (nichts verschwindet stillschweigend).

Format je Eintrag: `## YYYY-MM-DD — Titel` mit Abschnitten
`Hinzugefügt` / `Geändert` / `Behoben` / `Entfernt` / `Doku` (nur was zutrifft).

---

## 2026-06-14 — Menüseite „So entscheidet der Club" (Nutzer-Erklärung)

### Hinzugefügt
- Neue Route `app/how-it-works.tsx` und Menüeintrag „So entscheidet der Club": einfache, motivierende Erklärung des Fairness-Algorithmus für Mitglieder (kein Detail/keine Formeln) mit CTA „Jetzt abstimmen".
- Screen-Event `SCREEN_EVENTS.howItWorks` (+ Label) für Analytics.

---

## 2026-06-14 — Standort-Export/-Import (Admin)

### Hinzugefügt
- **Admin → Sportprofile:** „Standorte exportieren / importieren". Export als JSON (alle Standorte inkl. zugeordneter Sportarten per Name + ID); Import legt fehlende Standorte an und aktualisiert vorhandene (gleiche ID). Sportarten werden über den **Namen** aufgelöst (robust über Datenbanken hinweg), Fallback auf ID.
- **Service:** `exportSportProfiles` / `importSportProfiles` in `src/services/sportProfiles.ts` (+ Typen `SportProfileExport`, `SportProfileImportResult`).
- Datei-Download/-Upload nur im **Web** (Platform-Guard); auf Native erscheint ein Hinweis.

---

## 2026-06-14 — Doku-System eingeführt; Onboarding/Voting/Standorte gehärtet

### Doku
- Neues, sichten-basiertes Doku-System unter `docs/` angelegt:
  `README.md` (Index), `perspectives/{stakeholder,architecture,developer,user-guide,operations,security-and-privacy}.md`,
  `CHANGELOG.md` (dieses Log) und `MAINTENANCE.md` (Pflegeprotokoll).

### Hinzugefügt
- **Admin:** „Sportart mehreren Standorten zuordnen" (Bulk-Zuordnung) + Service `linkSportToProfiles` (additiv, idempotent).
- **Ideen:** „Sportart an bestehenden Standorten" — ein Sport an mehrere bekannte Standorte vorschlagen (Details aus dem Standortprofil).
- **Ideen:** „Zuletzt verwendete Standorte" als Schnellauswahl im Standort-Schritt, Stadt des Nutzers zuerst/hervorgehoben.
- **Auth:** Resend-Cooldown (60 s, Countdown) und klare Rate-Limit-/OTP-Fehlermeldungen.
- **Ops:** `scripts/create-basic-user.mjs` (login-fähiges Basis-Konto via Service-Role) und `supabase/maintenance/delete_orphaned_phone_user.sql`.
- **DB:** Migrationen 060 (`admin_upsert_sport` idempotent auf Name), 061 (Admin-UPDATE-Policy auf `sports`), 062 (Voting-/Attendance-Gate an Event-Zeit angeglichen).

### Geändert
- **Ortssuche** auf Land (DE) eingeschränkt und an die Stadt des Nutzers gebunden (keine USA-/Auslandstreffer).
- **Standort-Picker (Ideen)** nach Ortsnamen dedupliziert; bereits zugeordnete Standorte gesperrt.
- **Sport-Auswahl:** „+"-Chip → „+ Hinzufügen".
- **Event-Default:** `getMccEventState` wählt das Event der **eigenen Stadt** zuerst (greift bei mehreren aktiven Städten).

### Behoben
- Freigabe einer Idee mit „neuer" Sportart: Duplicate-Key (`sports_name_key`) und „Cannot coerce…" (RLS) behoben.
- Freigabe **flexibler** Ideen: Standortname wird aus PLZ/Stadt abgeleitet.
- Registrierung: bestehende Nummer wird erkannt (verschleierte `signUp`-Antwort), kein falsches „SMS geschickt"; Einladungscode wird vor `signUp` revalidiert.

### Entfernt
- `supabase/maintenance/delete_unconfirmed_phone_user.sql` **umbenannt/ersetzt** durch `delete_orphaned_phone_user.sql`. Grund: Die alte Variante löschte nur *unbestätigte* User und ließ verwaiste **bestätigte** User (ohne Club-Mitgliedschaft) stehen, die die Nummer blockierten. Neue Variante guarded auf „keine Club-Mitgliedschaft".

---

## Vor 2026-06-14 (Basis, verdichtet)

Frühere Entwicklung ist in den Migrationen (001–059) und den Themen-Dokus
dokumentiert (Algorithmus-Handoff, Notifications, Push, PWA, Analytics, Schema).
Dieser Changelog wird ab hier fortgeschrieben.
