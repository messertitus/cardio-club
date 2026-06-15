# Doku-Changelog

Chronologisches Protokoll dokumentierter Änderungen am **Stand der App** und an
dieser Dokumentation. **Neuestes oben.** Entferntes wird unter `Entfernt`
ausdrücklich festgehalten (nichts verschwindet stillschweigend).

Format je Eintrag: `## YYYY-MM-DD — Titel` mit Abschnitten
`Hinzugefügt` / `Geändert` / `Behoben` / `Entfernt` / `Doku` (nur was zutrifft).

---

## 2026-06-15 — Kombinierte Events mit 3+ Sportarten möglich

### Hinzugefügt
- Der Entscheidungs-Algorithmus kann jetzt **mehr als zwei** Sportarten zu **einem** kombinierten Event an einem Ort zusammenfassen (z. B. Beachvolleyball + Outdoor-Boxen + Schwimmen am Strandbad). Neuer Generator `generateCombinedCandidates`: ankert an jeder Sportart und nimmt greedy weitere **ko-lokalisierte** Sportarten (selber Standort/Rufnähe) auf, die jede für sich **echten Support** haben, bis `maxActivities`.
- Test: „combines three co-located sports into one multi-sport event".

### Geändert
- `DEFAULT_OPTIONS.maxActivities` von 2 auf **4** erhöht und in der Generierung **erzwungen** (bisher nur deklariert). Single- und 2-Sport-Kandidaten unverändert; nur größere Kombinationen kommen hinzu.
- Greift nach **Neu-Deploy der `decision`-Function**. Bestehende 27 Algorithmus-Tests weiter grün.

---

## 2026-06-15 — „Selber Standort"-Radius erhöht (120 m → 300 m)

### Geändert
- `DEFAULT_OPTIONS.sameSpotRadiusKm` von 0.12 auf **0.3 km** erhöht, damit eine größere Anlage (z. B. Strandbad) als **ein** Standort zählt. Bleibt unter `socialRadiusKm` (0.75 km, Rufnähe). Greift nach Neu-Deploy der `decision`-Function.

---

## 2026-06-15 — Gleicher Ort: Distanz statt Name als primäres Signal

### Geändert
- `getProfileProximity` (Entscheidungs-Algorithmus) entscheidet „gleicher Ort/Rufnähe" jetzt **zuerst über die Distanz** der Koordinaten (Haversine; `sameSpotRadiusKm`=120 m „selber Standort", `socialRadiusKm`=750 m „Rufnähe"). Der namensbasierte `venue_group_key` ist nur noch **Fallback**, wenn bei mindestens einem Profil Koordinaten fehlen.
- Die Standort-/Kapazitätsgruppierung (`groupActivitiesByLocation`) nutzt dieselbe distanzbasierte Logik, statt direkt über den `venue_group_key` (Namen) kurzzuschließen. Verhindert, dass zwei gleichnamige, aber weit entfernte Orte als einer behandelt werden.
- Praxis: Standorte am selben Platz brauchen primär **Koordinaten** (Map-Pin). Der Namens-Key bleibt für koordinatenlose Profile nützlich.

---

## 2026-06-15 — Standorte gruppieren (venue_group_key) + Beispiel verfeinert

### Hinzugefügt
- `supabase/maintenance/align_venue_group_keys.sql`: prüft/füllt `venue_group_key` aus dem Standortnamen, damit gleichnamige Profile (z. B. drei Profile „Strandbad Horn" für Boxen/Volleyball/Schwimmen) vom Entscheidungs-Algorithmus als **ein Ort** gruppiert werden und gemeinsam laufen können.

### Geändert
- how-it-works-Beispiel auf das realistische Szenario umgestellt: Beachvolleyball, Outdoor-Boxen und Schwimmen → ein Standort (Strandbad Horn), an dem alles zusammen möglich ist.

### Doku
- Hintergrund zur Standort-Gruppierung (`venue_group_key`, „same_spot") ergänzt — siehe [operations.md](perspectives/operations.md).

---

## 2026-06-15 — Benachrichtigungen: „Voting offen" statt „neue Woche"; Einladung nur tagsüber

### Geändert
- **„Neue Cardio-Abstimmung"** wird nicht mehr beim Anlegen der Wochen-Events ausgelöst, sondern erst, **wenn das Voting eines Events wirklich offen ist** (zeitgesteuerter, dedup-sicherer Job `enqueue_vote_open_notifications`, eingehängt in `run_mcc_notification_jobs`). Verhindert die doppelte Meldung bei zwei neuen Cardiotagen, von denen nur einer abstimmbar ist.
- **Wöchentliche Einladungs-Erinnerung** nur noch **tagsüber** (Berlin 10:00–20:00) — keine 02:00-Push mehr (`enqueue_weekly_invite_reminders` mit Tageszeit-Gate).

### Entfernt
- Insert-Trigger `enqueue_weekly_event_notification_trigger` auf `weekly_events` entfernt. Grund: löste die „neue Woche"-Push pro angelegtem Event aus, unabhängig vom Voting-Status. Ersatz: o. g. zeitgesteuerter Job.
- DB: Migration **063**.

---

## 2026-06-14 — Menüseite „So entscheidet der Club" (Nutzer-Erklärung)

### Hinzugefügt
- Neue Route `app/how-it-works.tsx` und Menüeintrag „So entscheidet der Club": Erklärung des Fairness-Algorithmus für Mitglieder mit CTA „Jetzt abstimmen".
- Screen-Event `SCREEN_EVENTS.howItWorks` (+ Label) für Analytics.

### Geändert
- Seite **detaillierter**: 5-Schritte-Ablauf, Karte „Was fair abgewogen wird" (Ranked Voting, No-Go-Härte, Vernachlässigungs-/Mehrheitsschutz, Standort/Wetter, parallele Gruppen) und ein konkretes Beispiel — weiterhin einfach und ohne Formeln.

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
