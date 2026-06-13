# Analytics & Statistik – Datenschutz und Technik

Diese Doku beschreibt die **privacy-first Analytics-Grundlage** (Migration `056_user_analytics_foundation.sql`), auf der später Gamification, Meilensteine, Aktivitätslevel, Club-Insights und persönliche Fortschrittsanzeigen aufbauen können. In diesem Stand werden **keine** Gamification-Features, Achievements oder Badges angezeigt – nur Daten strukturiert erfasst.

## Grundsätze (Privacy by Design / DSGVO)

- **Datenminimierung:** Nur app-relevante Zähler und ein dünnes Event-Log. Kein Rohdaten-Dump im UI.
- **Zweckbindung:** `event_type`/`metric_key` folgen einem festen Schlüsselformat (`^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`, 2–80 Zeichen), erzwungen in DB (`is_valid_stat_key`) und Client (`isValidStatKey`). So kann kein Freitext/sensibler Wert „durchrutschen". Das `context`-Feld ist auf 2 KB begrenzt.
- **Transparenz & Löschbarkeit:** Jeder Wert ist zurücksetzbar; Admins können alle Teststatistiken eines Nutzers löschen.
- **Least Privilege (RLS):** Normale Nutzer sehen **nur eigene** Statistiken und schreiben **nur eigene** Events. Alle Counter-Writes und alle Adminaktionen laufen über `SECURITY DEFINER`-RPCs, die `auth.uid()` erzwingen bzw. `is_admin_user()` prüfen.
- **Kein Heimlich-Tracking:** Erfassung passiert ausschließlich in der App, im angemeldeten Zustand. Kein Hintergrund-Tracking, keine Standort-Historie, keine Erfassung außerhalb der App ohne separate Einwilligung.

## Welche Events werden erfasst?

Zentrale Registry: [`src/lib/analyticsEvents.ts`](../src/lib/analyticsEvents.ts).

| Gruppe | Schlüssel (Beispiele) | Wo getrackt |
| --- | --- | --- |
| Engagement | `app.session_started`, `app.standalone_detected` | `AppActivityTracker` (Login je Session) |
| | `onboarding.completed` | `TourGuide.finish` |
| | `install_hint.seen`, `install_hint.dismissed` | Startseite (Install-Hinweis) |
| | `app.push_enabled` | Push-Screen (nach erfolgreichem Abo) |
| Screen-Views | `screen.members_viewed`, `screen.profile_viewed`, `screen.chat_viewed`, `screen.ideas_viewed` | `useScreenView`-Hook |
| Screen-Views | `screen.event/vote/decision/chat/members/profile/ideas/invites/menu/settings/push/install/history/clubs_viewed` | `useScreenView`-Hook |
| Feature-Adoption | `feature.map_route_opened`, `feature.theme_toggled`, `feature.direct_chat_started`, `feature.chat_reply_sent` | MapRouteButton, ThemeContext, directChats, chat |
| Voting | `vote.submitted`, `vote.changed`, `vote.removed`, `vote.rank1/2/3` | `votes.ts` (nach Erfolg) |
| No-Go | `nogo.added`, `nogo.removed` | `noGos.ts` |
| Beitrag | `idea.suggested`, `proposal.created`, `profile.updated` | `sportIdeas.ts`, `proposals.ts`, `profiles.ts` |
| Community | `chat.message_sent` (nur Metadatum), `invite.created` | `chat.ts`, `invitations.ts` |

### Server-seitige Outcome-Events (Migration 057)

Diese Kennzahlen entstehen durch eine **andere** Person bzw. ein Ereignis als den betroffenen Nutzer und werden daher per `SECURITY DEFINER`-Trigger für das *Subjekt* erfasst (nicht über das `auth.uid()`-gebundene `record_user_metric`). Rein additive Beobachtung – kein Eingriff in Entscheidungs-/Voting-/Fairness-Logik.

| Gruppe | Schlüssel | Auslöser |
| --- | --- | --- |
| Teilnahme (RSVP) | `attendance.set`, `attendance.changed`, `attendance.going/maybe/not_going` | INSERT/UPDATE auf `attendance` (kennt set vs. geändert) |
| Teilnahme (real) | `attendance.attended`, `attendance.no_show` | Attendance-Review setzt `actual_status` |
| Beitrag | `idea.accepted`, `idea.rejected` | Admin prüft Sportidee (gutgeschrieben dem Vorschlagenden) |
| Community | `invite.used` | Eingeladener löst Code ein (gutgeschrieben dem Einlader) |
| Community | `club.joined` | Neue `club_members`-Zeile |
| Voting-Outcome | `vote.wish_won`, `vote.wish_partial`, `vote.wish_not_met` | Wochenentscheidung `decided`: Vergleich der Picks mit dem öffentlichen Ergebnis-Sport |

Tracking ist **fire-and-forget** (Client) bzw. fehlertolerant (Trigger): Schlägt es fehl, beeinflusst das nie die eigentliche Aktion.

## Abgeleitete Insights (Migration 058) — „Kombinationen"

Grundsatz: **Rohdaten bleiben minimal, der Reichtum entsteht durch Ableitung beim Lesen** – wir speichern keine redundanten Kennzahlen. `get_user_stat_insights(target?)` → `getUserStatInsights` berechnet on-demand allein aus den Analytics-Tabellen (self oder Admin):

- **Rhythmus/Recency:** `firstActiveAt`, `lastActiveAt`, `daysSinceLastActive`, `activeDays`, `activeWeeks`, `currentWeekStreak`, Tageszeit-Profil (früh/mittag/abend/nacht), Wochentag-Profil.
- **Vielfalt:** `distinctVotedSports` (für wie viele verschiedene Sportarten je abgestimmt wurde).
- **Raten (%):** Zuverlässigkeit (`attended/(attended+no_show)`), Teilnahme-Treue (`attended/set`), Wunsch erfüllt/abgedeckt, Vorschlag-Annahmequote, Vote-Revisionsrate.
- **Composite-Scores (vorbereitend, transparente Summen):** Teilnahme, Beitrag, Sozial, Engagement.

Diese Schicht liest nur `user_stat_counters`/`user_activity_events` – keine Joins in Votes/Attendance/Entscheidung, also kein Algorithmus-Leak. Sie ist im Admin-Testmenü als Panel „Insights (abgeleitet)" sichtbar.

Weitere Kennzahlen, die **ohne neue Erfassung** ableitbar sind: Häufigkeit pro Sportart (aus Event-`context.sportId`), wiederkehrende Teilnahme pro Woche, Reaktionsgeschwindigkeit (Vote-/RSVP-Zeitpunkt vs. Event-Öffnung), Einladungsbaum-Tiefe, „aktivste Tageszeit/Wochentag". Sie können später als weitere Felder in `get_user_stat_insights` ergänzt werden, ohne neue Tabellen.

## Privacy-Decke — was wir bewusst NICHT erfassen (auch wenn technisch möglich)

„Jede mögliche Statistik" endet dort, wo Datensparsamkeit/Zweckbindung verletzt würde. Bewusst ausgeschlossen bleiben, obwohl technisch denkbar:

- Genaue Verweildauer pro Element, Scroll-/Tap-Heatmaps, Maus-/Tastatur-Timing.
- Chat-Inhalte, Sentiment-/Tonanalyse von Nachrichten.
- Standort-/Bewegungs-Historie, GPS-Tracking im Hintergrund.
- Geräte-Fingerprinting über das Standalone-Flag hinaus, Cross-Site-/Drittanbieter-Tracking.
- Kontakte, Kalender, sonstige Daten außerhalb der App ohne separate Einwilligung.
- Inhaltliche No-Go-Begründungen, sensible personenbezogene Kategorien.

Diese Grenze ist Teil des Designs, nicht eine fehlende Funktion.

## Warum werden sie erfasst?

Als neutrale Basis für spätere, freiwillige Features: Aktivitätslevel, Streaks, Meilensteine, persönliche Fortschritts- und Club-Insights. Bis dahin sind es reine Zähler/Breadcrumbs ohne Auswertung im normalen UI.

## Welche Daten werden NICHT erfasst?

- **Keine Chat-Inhalte** – beim Senden nur das Metadatum „Nachricht gesendet" (+ Event-/Sport-ID).
- **Keine No-Go-Gründe**, keine sensiblen Freitexte.
- **Keine Standort-/Bewegungsprofile**, kein Hintergrund-Tracking.
- **Keine Algorithmus-Interna** – Voting-/Fairness-Logik bleibt serverseitig (Edge Function) und wird nicht geleakt. Outcomes werden nur als Ergebnisdaten betrachtet, nicht als Algorithmus-Detail.
- Kein `context` mit Namen, Telefonnummern oder Koordinaten.

## Tabellen (Migration 056)

- `user_activity_events` – append-only Breadcrumbs (user_id, event_type, kleines context-jsonb, occurred_at).
- `user_stat_counters` – aggregierte Zähler pro `(user_id, metric_key)` inkl. `last_event_at`.
- `user_stat_snapshots` – vorbereitet für periodische Roll-ups (Trends), noch ungenutzt.
- `user_achievement_progress` – **nur vorbereitend**, keine Achievements definiert/angezeigt.
- `admin_stat_audit_log` – protokolliert jede manuelle Adminänderung.

## RPCs / Service

Service: [`src/services/analytics.ts`](../src/services/analytics.ts).

- `record_user_metric(...)` → `trackAppEvent` / `recordUserMetric` (nur eigene Daten, `auth.uid()`).
- `get_user_stats(target?)` → `getUserStats` (self, oder beliebig für Admins).
- `admin_set_user_metric` → `updateUserStatisticForTesting` (Admin, Test) – auditiert.
- `admin_reset_user_metric` → `resetUserStatistic` (Admin, Test) – auditiert.
- `admin_reset_user_stats` → `resetAllUserStatistics` (Admin, Test) – auditiert.
- `admin_list_stat_audit` → `listUserStatAudit` (Admin).

Kein Service-Role-Key im Frontend – Adminrechte werden serverseitig über `is_admin_user()` geprüft.

## Wie können Statistiken gelöscht/zurückgesetzt werden?

Im Adminbereich → **„Statistiken (Test)"**:

1. Mitglied über Name/Telefon/Stadt/ID suchen und auswählen.
2. Zentrale Counter ansehen (zuletzt aktiv, Gesamt-Events, Werte je Schlüssel).
3. Einzelnen Wert per Stift **manuell setzen** oder per ↺ **auf 0 zurücksetzen**.
4. **„Alle Teststatistiken zurücksetzen"** (mit Bestätigung) löscht Counter, Events, Achievement-Fortschritt und Snapshots des Nutzers.
5. Das **Audit-Log** zeigt, wer wann welchen Wert geändert hat.

Beim Löschen eines Profils werden alle Statistik-Zeilen per `on delete cascade` mitentfernt.

## Welche Daten sind admin-only?

- Fremde Nutzerstatistiken (`get_user_stats` mit Ziel ≠ self).
- Das gesamte Adminmenü „Statistiken (Test)" und das `admin_stat_audit_log`.
- Normale Nutzer haben für `user_stat_counters`/`admin_stat_audit_log` keine Schreib- bzw. Leserechte über die eigenen Zeilen hinaus.
