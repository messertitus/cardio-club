# Fairness-First Constellation Algorithmus - Technische Übergabe

Stand: 2026-06-19  
Projekt: Messers Cardio Club / Cardioclub  
Zweck: Vollständige Übergabe des aktuellen Algorithmus, seiner Datenabhängigkeiten, Scores, Persistenzwege, UI-Einflüsse, Grenzen und Weiterentwicklungspunkte.

> Wichtige Änderung gegenüber älteren Ständen: Der Algorithmus läuft **nicht mehr im Browser**, sondern ausschließlich server-seitig in der Supabase Edge Function `decision`. Der Client kennt nur noch die sanitisierte `DecisionView`. Siehe Abschnitt 2.

## 1. Kurzfassung

Der produktive Entscheidungsalgorithmus ist `selectFairConstellation` in:

`supabase/functions/decision/_shared/algorithm.ts`

Er wählt nicht eine abstrakte Sportart, sondern eine konkrete Event-Konstellation aus Sportprofilen:

- `single`: eine Aktivität für alle akzeptierten Teilnehmenden.
- `multi_sport`: zwei bis vier Aktivitäten im selben Ort oder Social Radius, weiterhin als gemeinsames Club-Event (inklusive kombinierter Events mit 3+ Sportarten an einem Ort).
- `twin`: zwei getrennte Gruppen, wenn zwei echte Gruppen entstehen und das fairer/praktikabler ist.
- `none`: keine Entscheidung möglich.

Die Nutzer stimmen bewusst einfach auf abstrakte Sportarten ab. Der Algorithmus sucht danach passende konkrete `sport_profiles` und bewertet Konstellationen aus Profilen.

Wichtig: Die alte Funktion `selectFairSport` ist Legacy und nicht der aktuelle Entscheidungsweg.

## 2. Architektur: Algorithmus läuft server-seitig

Das Web/PWA-Bundle ist vollständig einsehbar. Früher lief der Algorithmus im Browser (`src/lib/fairConstellationSelection.ts`), sodass alle Formeln, Ranking-Margins und `DEFAULT_OPTIONS`-Gewichte an jeden Client ausgeliefert wurden. Das ist das zentrale Geschäftsgeheimnis der App.

Heute läuft der Algorithmus **nur** in der Edge Function `decision`. Der Client ruft die Funktion auf und rendert die sanitisierte `DecisionView`, die zurückkommt. Rohe Scores, Ranking-Margins, Kandidaten-IDs, Fairness-Debt, gewichtete Vote-Scores und Option-Gewichte verlassen den Server nie.

### Edge Function: `supabase/functions/decision/`

| Datei | Rolle |
|---|---|
| `index.ts` | HTTP-Handler. Auth, Actions `preview` / `finalize` / `finalize-due`, CORS. |
| `_shared/algorithm.ts` | Der Algorithmus. Selbstständig, **keine Imports**. Wortgleiche Kopie der früheren Client-Datei. |
| `_shared/decisionService.ts` | Datenabruf, Algorithmus ausführen, finale Entscheidung persistieren. |
| `_shared/decisionPresentation.ts` | Übersetzt eine Entscheidung in freundliche Erklärungstexte. |
| `_shared/weather.ts` | Open-Meteo Wetter-Snapshot für Outdoor-Profile. |
| `_shared/sanitize.ts` | Baut die sanitisierte `DecisionView` (das einzige Payload an den Client). |

### Client

- `src/services/decisions.ts`
  - Dünner Client. Ruft die `decision`-Funktion via `supabase.functions.invoke("decision", { body })` auf.
  - Actions: `preview`, `finalize`, `finalize-due`.
  - Darf den Algorithmus **niemals** wieder importieren.

- `src/lib/decisionView.ts`
  - Frontend-sicherer Ergebnistyp `DecisionView` (sanitisiert). Wird in `_shared/sanitize.ts` wortgleich gespiegelt. Beide Shapes müssen synchron bleiben.

- `src/lib/decisionTypes.ts`
  - Reine I/O-Datentypen und Enums (`ConstellationMode`, `DecisionCharacter` usw.), die Client und Server teilen dürfen.

- `src/lib/votingRules.ts`
  - Rang 1/2/3, maximale Stimmenzahl, Rang-Gewichte.

- `src/lib/votingEligibility.ts`
  - Filtert Votes/No-Gos von `not_going` und nicht teilnahmeberechtigten Nutzern für die App-Darstellung.

### Isolations-Guards (dürfen nicht gebrochen werden)

- Niemals etwas aus `supabase/functions/decision/` in Client-Code (`app/**`, `src/**`) importieren.
- `tests/algorithmIsolation.test.ts` schlägt fehl, wenn Client-Quellcode den Algorithmus importiert oder `selectFairConstellation` referenziert.
- `scripts/check-web-bundle.mjs` (verdrahtet in `npm run pwa:build`) schlägt fehl, wenn ein Algorithmus-Sentinel-String in `dist/` landet.

### API

`POST` mit `Authorization: Bearer <jwt>` eines Mitglieds.

```jsonc
// preview — jedes Mitglied, das das Event lesen darf
{ "eventId": "<uuid>", "action": "preview" }
// -> { "view": DecisionView }

// finalize — nur Admins / Verantwortliche; persistiert mit Service Role
{ "eventId": "<uuid>", "action": "finalize" }
// -> { "event": <weekly_events row>, "view": DecisionView }

// finalize-due — System-Sweep ohne eventId; finalisiert alle fälligen Events
{ "action": "finalize-due" }
// -> { "finalized": number, "skipped": number, "considered": number }
```

Reads nutzen einen Client mit dem JWT des Aufrufers (RLS gilt). Finalize-Writes nutzen die Service Role, damit der Client nie Schreibrechte auf die geschützten `weekly_events`-Entscheidungsspalten braucht.

## 3. Datenmodell: Fachliche Konzepte

### Abstrakte Sportart

Tabelle: `sports`

Eine Sportart ist abstrakt (Beachvolleyball, Boxen, Radfahren, Laufen, Badminton).

Relevante Felder: `id`, `name`, `category`, `intensity_level`, `combinable_tags`, `description`, `is_active`.

Die UI zeigt im Voting nur aktive Sportarten, die mindestens ein aktives Profil haben.

### Sportprofil

Tabelle: `sport_profiles`

Ein Profil ist eine konkrete Variante einer Sportart oder eines Standortangebots (Beachvolleyball am Hörnle, Fußball am Stadtpark, Badminton in der Halle).

Relevante Felder unter anderem: `sport_id`, `name`, `location_name`, `map_url`, `postal_code`, `location_city`, `latitude`, `longitude`, `venue_group_key`, `location_type` (`indoor`/`outdoor`/`water`/`field`/`flexible`), `is_indoor`, `minimum_group_size`, `maximum_group_size`, `minimum_participants`, `maximum_participants`, `required_equipment`, `available_equipment`, `cost_note`, `cost_required`, `cost_per_person`, `cost_currency`, `opening_notes`, `lighting_available`, `transit_notes`, `amenity_notes`, `reservation_required`, `safety_notes`, `location_rules`, `ap_required`, `ap_requirement_level`, `ap_contact_id`, `weather_rules`, `is_active`, `created_by`.

### Mehrere Sportarten pro Standortprofil

Tabelle: `sport_profile_sports`

Ein Standortprofil kann mit mehreren Sportarten verknüpft sein (z. B. Strandbad: Beachvolleyball + Schwimmen + Laufen).

Der Kernalgorithmus kennt pro `SportProfile` nur ein `sportId`. Deshalb expandiert `listSportProfilesForSports` in `_shared/decisionService.ts` verlinkte Profile virtuell:

- gleiches physisches Profil,
- gleiche Profil-ID,
- aber für den Algorithmus jeweils mit anderem `sport_id` (Key `profileId:sportId`).

Die M:N-Logik liegt im Service-Layer der Edge Function, nicht im Algorithmus-Kern. Fehlt die Tabelle `sport_profile_sports` (Fehlercode `42P01`), fällt der Service auf die Legacy-`sport_profiles.sport_id`-Auflösung zurück.

### Event-Aktivitäten

Tabelle: `event_activities`

Nach Finalisierung gespeichert: `event_id`, `sport_id`, `sport_profile_id`, `role` (`primary`/`secondary`), `activity_type` (`single`/`multi_sport`/`twin`/`none`), `title`, `location`, `starts_at`, `activity_contact_id`, `assigned_user_ids`.

Das ist die persistierte Wahrheit für finale Aktivitäten und liefert auch die Rotation-Historie (siehe Abschnitt 12).

### No-Gos

Tabelle: `sport_no_gos`

Persönliche harte Unverträglichkeit auf abstrakter Sportart-Ebene: `event_id`, `sport_id`, `user_id`, `reason`.

Fachlich kein normales Downvoting. Ein No-Go bedeutet: Diese Person soll für diese Sportart nicht akzeptiert eingeplant werden. Technisch schließt ein No-Go die Sportart nicht global aus; es verhindert die persönliche Zuordnung und erzeugt eine Strafkomponente, wenn die Person sonst keine Alternative bekommt. Es gibt zusätzlich einen harten Block für Single-Events mit zu vielen `going`-No-Gos (Abschnitt 15.4).

### Attendance

Tabelle: `attendance`

Geplante Teilnahme: `going`, `maybe`, `not_going`.  
Tatsächliche Nachbereitung: `actual_status` (`present`/`absent`/`excused`/`unknown`), `checked_by`, `checked_at`, `subgroup_id` (bei Twin).

Für die Entscheidung zählen nur `going` und `maybe`.

### Preference History

Tabelle: `member_preference_history`

Für Fairness Debt: `club_id`, `user_id`, `sport_id`, `week_start_date`, `voted_for`, `was_selected`, `vote_rank`, `covered_by_decision`, `covered_by_activity_type`.

Nach Finalisierung wird pro relevanter Stimme eine Historienzeile geschrieben (Upsert auf `club_id,user_id,sport_id,week_start_date`).

## 4. Gesamtfluss

### 4.1 Voting

1. Teilnahme wählen: `going` / `maybe` / `not_going`.
2. Bis zu drei abstrakte Sportarten wählen.
3. Optional No-Go je Sportart setzen.

Voting-Regeln:

- Maximal 3 Stimmen pro Event.
- Ränge: Rang 1 = `1.0`, Rang 2 = `0.6`, Rang 3 = `0.3`.
- Votes nur bei Eventstatus `proposing` oder `voting`.
- Votes nur bei Attendance `going` oder `maybe`. `not_going` darf nicht abstimmen.
- Ein Rang kann nur einmal vergeben werden.

Votes liegen in Tabelle `sport_votes` (`sport_id`, `user_id`, `vote_rank`, `weight`).

### 4.2 Decision Preview

`preview`-Action → `getEventDecisionPreview` →

1. `buildDecisionInput`
2. `selectFairConstellation`
3. `buildDecisionView` (sanitisiert, admin-abhängig)

Preview finalisiert nichts. Sie berechnet nur eine aktuelle mögliche Entscheidung. Im aktuellen produktiven Flow gibt es **keine Live-Preview-Auslieferung mehr** im normalen Event-Verlauf; die Entscheidung wird genau einmal beim 48h-Moment finalisiert (siehe 4.3). Die `preview`-Action existiert weiterhin und versorgt u. a. die Admin-Explainability.

### 4.3 Decision Finalize

Es gibt zwei Wege:

**a) `finalize`** für ein einzelnes Event (Admins / Verantwortliche).

**b) `finalize-due`** als System-Sweep: finalisiert jedes Event mit Status `proposing`/`voting`, dessen Start innerhalb der nächsten 48h liegt (`starts_at <= now + 48h`). Der Entscheidungsmoment ist also `starts_at − 48h`. Der Sweep ist idempotent (siehe unten) und wird sowohl von der periodischen Push-Sweep-Routine (Service Key) als auch als Client-Fallback (jedes Mitglied) aufgerufen, ohne doppelt zu entscheiden.

`finalizeEventDecision`:

1. Lädt Event.
2. Bricht ab, wenn Status bereits `decided`, `completed` oder `cancelled` (Idempotenz).
3. Berechnet Preview.
4. Bricht ab, wenn keine Gewinner-Sportart existiert (Event wird dann später von `cancel_underused_events()` archiviert).
5. Wählt APs pro Aktivität (`withActivityContacts`).
6. Ersetzt `event_activities`.
7. Persistiert `member_preference_history`.
8. Erstellt bei `twin` zusätzlich `event_subgroups` und setzt `attendance.subgroup_id`.
9. Aktualisiert `weekly_events` mit `.in("status", ["proposing","voting"])` als Guard.

`weekly_events` bekommt: `selected_sport_id`, `secondary_sport_id`, `decision_type`, `decision_reason`, `decision_character`, `weather_snapshot`, `activity_contact_id`, `status = decided`.

**Sicherheit:** Die rohen Algorithmus-Internas werden **nicht** persistiert. `decision_scorecard`, `decision_explainability`, `losing_candidate_reasons`, `no_go_breakdown` werden bewusst auf `null` gesetzt. Sie waren früher hier gespeichert und über die REST-API von jedem Mitglied lesbar. Die Admin-Zusammenfassung wird stattdessen live aus einer Preview neu berechnet. Nicht wieder einführen (siehe Migration 044).

## 5. Input für `selectFairConstellation`

Typ: `FairConstellationInput`

```ts
{
  sports: AbstractSport[];
  sportProfiles: SportProfile[];
  proposals: SportProposal[];
  votes: RankedSportVote[];
  noGos?: SportNoGo[];
  attendance?: ParticipationEntry[];
  previousWeekSportId?: string;
  previousWeekPrimarySportId?: string;
  preferenceHistory?: PreferenceHistoryEntry[];
  recentSelections?: RecentSelection[];
  recentActivities?: RecentActivitySelection[];
  reliabilityHistory?: ReliabilityHistoryEntry[];
  weatherSnapshot?: ProfileWeatherSnapshot;
  options?: Partial<FairConstellationOptions>;
}
```

`buildDecisionInput` (in `decisionService.ts`) baut diesen Input:

- `sports`: aktive Sportarten der Proposals.
- `sportProfiles`: aktive Profile, **nach Event-Stadt gefiltert** (`event.city`); Profile ohne `location_city` bleiben erhalten.
- `votes`: aus `sport_votes`.
- `previousWeekPrimarySportId` / `recentActivities`: aus `event_activities` der letzten 6 Events (Rolle + `activity_type`), Fallback `weekly_events.selected_sport_id`.
- `preferenceHistory`: bis zu 500 Einträge vor der Eventwoche.
- `reliabilityHistory`: Attendance der letzten 8 Events.
- `weatherSnapshot`: Kontext-Override → `event.weather_snapshot` → Live-Fetch via Open-Meteo.

### `WeatherRules`

```ts
{
  requiresDry?: boolean;
  rainSensitive?: boolean;
  heatSensitive?: boolean;
  coldSensitive?: boolean;
  thunderstormUnsafe?: boolean;
  maxPrecipitationMm?: number;
  minTemperatureC?: number;
  maxTemperatureC?: number;
  windSensitive?: boolean;
  maxWindKmh?: number;
  requiresDaylight?: boolean;
  slipperyWhenWet?: boolean;
}
```

Hinweis: Wind wird wieder bewertet (`windSensitive` + `maxWindKmh`), siehe Abschnitt 13.

## 6. Default-Optionen

Aus `DEFAULT_OPTIONS`:

| Option | Wert | Bedeutung |
|---|---:|---|
| `maxActivities` | `4` | Obergrenze für ein kombiniertes Event an einem Ort. |
| `maybeParticipationWeight` | `0.55` | Teilnahme-Gewicht von `maybe` (Participation/Zuordnung). |
| `maybePreferenceWeight` | `0.8` | `maybe`-Gewicht für Vote-/Preference-/Reliability-Scoring. |
| `noAttendanceWeight` | `0` | Kein Attendance-Eintrag zählt nicht. |
| `preferenceScoreMultiplier` | `1.25` | Multiplikator der Preference im FinalScore. |
| `minimumWinnerVoteScore` | `1` | Mindest-Primary-VoteScore eines Gewinners (außer Low-Vote-Fallback). |
| `minimumSingleVoteShare` | `0.25` | Mindest-VoteShare für Single. |
| `minimumPrimaryVoteShare` | `0.25` | Mindest-VoteShare der Hauptsportart bei Multi/Twin. |
| `lowVoteFallbackEnabled` | `true` | Aktiviert Fallback bei sehr wenigen Stimmen. |
| `lowVoteTotalThreshold` | `2` | Gesamt-VoteScore ≤ Wert ⇒ Fallback. |
| `neglectBoostPerWeek` | `0.35` | Fairness Debt pro direkt ignorierter Vorwoche. |
| `maxFairnessDebt` | `2` | Maximaler Debt pro User (bzw. User×Sport). |
| `noGoPenalty` | `2.5` | Strafwert No-Go bei Multi/Twin. |
| `singleGoingNoGoPenalty` | `3.5` | No-Go-Strafe (`going`) bei Single. |
| `singleMaybeNoGoPenalty` | `2` | No-Go-Strafe (`maybe`) bei Single. |
| `singleGoingNoGoHardBlockThreshold` | `2` | Ab so vielen `going`-No-Gos möglicher Hard-Block. |
| `singleGoingNoGoHardBlockShare` | `0.25` | Zusätzlicher Anteils-Schwellwert für den Hard-Block. |
| `minSecondaryVoteScore` | `1.2` | Mindestscore für eine zweite echte Gruppe. |
| `strongSecondaryVoteRatio` | `0.32` | Zweitgruppe braucht ≥ 32 % der Erstgruppe. |
| `minimumSecondaryUniqueVoters` | `2` | Mindestzahl eindeutiger Voter der Zweitgruppe. |
| `smallGroupThreshold` | `4` | Bis hier gilt „kleine Gruppe". |
| `allowSingleUserSecondaryInSmallGroups` | `true` | In kleinen Gruppen reicht 1 Voter für die Zweitgruppe. |
| `twinScoreMargin` | `0.82` | Absoluter Score-Vorteil, ab dem Twin gegen gemeinsame Varianten gewinnen darf. |
| `fairnessFirstMargin` | `0.55` | Mindest-Fairnessvorteil für Fairness-Override. |
| `fairnessOverrideWindow` | `1.5` | Score-Abstand, innerhalb dessen Fairness gewinnen darf. |
| `minimumFairnessOverrideVoteScore` | `1.2` | Mindest-Primary-VoteScore, damit Fairness überstimmen darf. |
| `majorityProtectionVoteShare` | `0.6` | Ab diesem VoteShare gilt eine Option als Mehrheits-geschützt. |
| `majorityOverrideRequiresFairnessGap` | `1.2` | Fairnessvorteil, der nötig ist, um Mehrheitsschutz zu kippen. |
| `majorityProtectionMaxPracticalityProblem` | `0.6` | Max. Praktikabilitätsproblem, bis Mehrheitsschutz greift. |
| `twinFairnessMargin` | `0.7` | Fairnessvorteil, damit Twin gegen gemeinsame Varianten gewinnen darf. |
| `socialRadiusKm` | `0.75` | Radius für Multi-Sport als gemeinsames Event („Rufnähe"). |
| `sameSpotRadiusKm` | `0.3` | Radius für „gleicher Ort". |
| `previousPrimaryCannotRepeatAsPrimary` | `true` | Vorwochen-Hauptsport darf nicht erneut Primary sein (harter Filter). |
| `previousPrimaryAllowedAsSecondary` | `true` | Darf aber Secondary sein. |
| `previousPrimaryPenalty` | `0.85` | Rotation-Malus für letzte Hauptsportart. |
| `recentCategoryPenalty` | `0.35` | Kategorie-Rotationsmalus. |
| `recentSecondarySportPenalty` | `0.2` | Malus, wenn Sport zuletzt Secondary war. |
| `recentSecondaryCategoryPenalty` | `0.15` | Malus für zuletzt sekundäre Kategorie. |
| `reliabilityPenaltyPerNoShow` | `0.12` | No-Show-Penalty pro Fall. |
| `maxReliabilityPenalty` | `0.45` | Maximaler Reliability-Penalty pro User. |
| `requiredApMissingPenalty` | `0.8` | Malus, wenn ein erforderlicher AP fehlt. |
| `criticalApMissingExcludesProfile` | `true` | Fehlt ein kritischer AP, wird das Profil ausgeschlossen. |
| `apAvailableBonus` | `0.15` | Bonus, wenn ein Profil-AP hinterlegt ist. |

## 7. Vorfilter im Algorithmus

In `selectFairConstellation` / `buildDecisionContext`:

1. `proposedSportIds` aus `proposals`.
2. `attendanceByUser`.
3. No-Gos nach Sport gruppiert.
4. `eligibleVotes`: Sport vorgeschlagen **und** User `going`/`maybe`. (Hinweis: No-Go schließt den Vote hier nicht aus; die No-Go-Wirkung greift später bei Zuordnung und Strafe.)
5. `voteSummaryBySport` und `totalVoteScore`.
6. `votedSportIds`: vorgeschlagene Sportarten mit `weightedVoteScore > 0`.
7. Fairness Debt (pro User und pro User×Sport), Reliability-Penalties, eligible Participants.
8. `lowVoteFallback = lowVoteFallbackEnabled && totalVoteScore <= lowVoteTotalThreshold`.

Wenn keine gültigen Stimmen existieren ⇒ `mode = "none"`.

## 8. Attendance-Gewichtung

Es gibt **zwei** Gewichtungen:

```ts
// participationWeight — Participation-Score, Zuordnung, Minderheitenschutz
going = 1
maybe = 0.55
not_going / kein Eintrag = 0

// preferenceAttendanceWeight — Vote-/Preference-/Reliability-Scoring
going = 1
maybe = 0.8
not_going / kein Eintrag = 0
```

`not_going` wird im Algorithmus komplett ignoriert.

## 9. Vote-Gewichtung

```ts
rank 1 = 1
rank 2 = 0.6
rank 3 = 0.3
explizites vote.weight überschreibt (>= 0)
fallback ohne rank/weight = 1
```

VoteScore pro Stimme (`sumVoteScore`):

```text
normalizeVoteWeight(vote)
* (1 - reliabilityPenaltyByUser[user])
* preferenceAttendanceWeight(userAttendance)
```

## 10. Fairness Debt

Funktion: `calculateFairnessDebt` (pro User) und `calculateFairnessDebtByUserSport` (pro User×Sport).

Pro Gruppierung:

1. Historie nach Woche gruppieren, rückwärts sortieren.
2. Für jede Woche:
   - Wenn User in dieser Woche nichts gewählt hat: stop.
   - Wenn mindestens eine seiner Stimmen abgedeckt wurde: stop.
   - Sonst `ignoredWeeks += 1`.
3. Debt: `min(ignoredWeeks * 0.35, 2.0)`.

Abdeckung: `entry.coveredByDecision ?? entry.wasSelected` (neue Logik mit Fallback auf alte Daten).

Der **User×Sport**-Debt wird im Scoring verwendet (Fairness, Minderheitenschutz, Gruppen-Support); der **User**-Debt nur in der Explainability-Ausgabe.

## 11. Reliability Penalty

Funktion: `calculateReliabilityPenalties`

1. Historie nach User gruppieren, letzte 6 Einträge betrachten.
2. Zählen: `plannedStatus === "going" && actualStatus === "absent"`.
3. Penalty: `min(recentNoShows * 0.12, 0.45)`.
4. Aktuelle Attendance mit `status === "going" && actualStatus === "absent"` addiert nochmals (gleicher Cap).

Wirkung: reduziert VoteScore über `1 - penalty` und erzeugt zusätzlichen negativen `reliability`-Score. User werden nicht ausgeschlossen.

## 12. Rotation-Historie

`fetchRecentActivities` lädt jetzt `event_activities` der letzten 6 Events inklusive `role` und `activity_type` (Fallback auf `selected_sport_id`/`decision_type`). Damit sind auch sekundäre Sportarten früherer Multi/Twin-Events für die Kategorie- und Secondary-Rotation sichtbar (Abschnitt 18.8).

## 13. Wetterbewertung

Funktion: `scoreWeather`.

- **Indoor** (`isIndoor` oder `locationType === "indoor"`): `+0.8`, wetterstabil.
- **Outdoor ohne Koordinaten und ohne PLZ**: `-5`, **ausgeschlossen** („nicht wetterfähig").
- **Outdoor mit Standort, aber ohne Wetterdaten**: `-0.35` („konnte noch nicht sicher bewertet werden").
- **Gewitter** (`(rules.thunderstormUnsafe ?? true) && weatherCode >= 95`): `-5`, **harter Ausschluss**.

Sonst Startwert `+0.4` und:

| Bedingung | Score | Grund |
|---|---:|---|
| `requiresDry`/`rainSensitive` und Niederschlag > `maxPrecipitationMm` (Default 1.5) | `-0.85` | Regen passt schlecht. |
| sonst Niederschlag > 0.5 mm oder Regenwahrscheinlichkeit > 65 % | `-0.35` | ungemütlich, nicht gefährlich. |
| sonst | `+0.35` | Wetter passt. |
| `windSensitive` und Wind > `maxWindKmh` (Default 35) | `-0.45` | Wind eingeschränkt. |
| `heatSensitive` und Temp > `maxTemperatureC` (Default 30) | `-0.35` | Hitze. |
| `coldSensitive` und Temp < `minTemperatureC` (Default 6) | `-0.35` | Kälte. |

`fetchEventWeatherSnapshot` nutzt `starts_at`, holt für jedes Profil mit Koordinaten Forecastdaten und nimmt die stündliche Zeile am nächsten zum Eventstart. Gespeicherter `weekly_events.weather_snapshot` wird bevorzugt; bei Finalisierung wird der Snapshot im Event gespeichert.

## 14. Praktikabilität

Funktion: `scoreBasePracticality`. Startwert `+0.35`.

Harter Ausschluss: `apRequirementLevel === "critical"` und kein `apContactId` und `criticalApMissingExcludesProfile` ⇒ `-5`, ausgeschlossen.

| Bonus | Score |
|---|---:|
| Beleuchtung | `+0.12` |
| Öffnungszeiten dokumentiert | `+0.08` |
| Anreise/ÖPNV/Parken dokumentiert | `+0.08` |
| Infrastruktur dokumentiert | `+0.08` |
| Standortregeln hinterlegt | `+0.05` |
| Sicherheitsinfos hinterlegt | `+0.03` |
| AP hinterlegt (`apContactId`) | `+0.15` (`apAvailableBonus`) |
| alle benötigten Equipment-Items verfügbar | `+0.14` |

| Malus | Score |
|---|---:|
| Reservierung nötig | `-0.12` |
| AP `required`, aber kein AP | `-0.8` (`requiredApMissingPenalty`) |
| fehlendes Equipment | `-0.12` pro Item, max `-0.4` |

`apRequirementLevel` wird normalisiert: explizites `none`/`required`/`critical`, sonst aus `apRequired` abgeleitet. Kosten sind **nicht** mehr Teil der Praktikabilität (eigener Score, Abschnitt 14a).

### 14a. Kostenbewertung

Funktion: `scoreCost`. `costRequired = costRequired ?? Boolean(costNote)`.

| Bedingung | Score | Grund |
|---|---:|---|
| keine Pflichtkosten oder `costPerPerson === 0` | `+0.1` | keine strukturierten Kosten. |
| Kostenhinweis, aber kein numerischer Wert | `-0.04` | Hinweis ohne Struktur. |
| `costPerPerson <= 3` | `-0.05` | niedrig. |
| `costPerPerson <= 8` | `-0.15` | moderat. |
| `costPerPerson <= 15` | `-0.35` | spürbar. |
| sonst | `-0.65` | hoch. |

## 15. Kandidatengenerierung

### 15.1 Single-Kandidaten

Für jede Sportart mit gültigen Stimmen: bestes Profil suchen, `single`-Kandidat bauen. Bestes Einzelprofil: höchste Summe `weatherScore + practicalityScore + costScore`, Tie alphabetisch.

### 15.2 Paar-Kandidaten

Sportarten werden nach Gruppensupport sortiert (`groupSupportScore = voteScore + Σ FairnessDebt(User×Sport) * preferenceAttendanceWeight * 0.35`).

Für jedes Paar: Paar wird so geordnet, dass der Vorwochen-Primary nicht Primary wird. Bestes Profilpaar wählen (Summe der Profilscores + Proximity-Score). Zweitgruppen-Prüfung:

```text
secondScore >= 1.2
secondScore >= firstScore * 0.32
uniqueVoters(second) >= requiredSecondaryVoters
```

`requiredSecondaryVoters` ist `1` in kleinen Gruppen (≤ 4 Teilnehmende, `allowSingleUserSecondaryInSmallGroups`), sonst `2`. Ohne sinnvolle Zweitgruppe und ohne Low-Vote-Fallback wird das Paar übersprungen.

- Bei `same_spot`/`social_radius` ⇒ Multi-Sport-Kandidat.
- Twin-Kandidat, wenn `participation >= minSecondaryVoteScore * 2` oder Low-Vote-Fallback.

### 15.3 Kombinierte Kandidaten (3+ Sportarten)

`generateCombinedCandidates` baut Events mit 3 bis `maxActivities` (4) Sportarten an einem Ort: Anker an jeder gerankten Sportart, dann greedy weitere ko-lokalisierte Sportarten (`same_spot`/`social_radius`) aufnehmen, die jeweils die „meaningful support"-Schwelle erfüllen. Ergebnis sind Multi-Sport-Kandidaten. Die paarweise Schleife deckt Single und 2-Sport ab; dieser Schritt ergänzt nur die größeren Kombinationen.

### 15.4 Harte Kandidatenfilter

`applyHardCandidateFilters`:

- Vorwochen-Primary darf nicht erneut Primary sein ⇒ Kandidat verworfen.
- Außerhalb Low-Vote-Fallback: `primaryVoteScore >= minimumWinnerVoteScore`; Single `primaryVoteShare >= 0.25`; Multi/Twin `primaryVoteShare >= 0.25`.
- Single-Hard-Block bei No-Gos: `goingNoGos >= 2 && goingNoGos / goingParticipants >= 0.25` ⇒ verworfen.

Danach `dedupeCandidates` über die Kandidaten-ID.

## 16. Nähe und Standortlogik

Funktion: `getProfileProximity`. **Distanz ist das maßgebliche Signal:**

1. Gleiches Profil ⇒ `same_spot`.
2. Distanz berechenbar:
   - `<= sameSpotRadiusKm (0.3)` ⇒ `same_spot`
   - `<= socialRadiusKm (0.75)` ⇒ `social_radius`
   - sonst ⇒ `split_location`
3. Nur wenn mindestens ein Profil keine Koordinaten hat: Fallback auf gleichen `venueGroupKey` ⇒ `same_spot`, sonst `unknown`.

ProximityScore: `same_spot +0.75`, `social_radius +0.45`, `split_location -0.2`, `unknown -0.1`.

Multi-Sport entsteht nur bei `same_spot`/`social_radius`. Twin darf auch bei `split_location`/`unknown` entstehen (`unknown` wird als `split_location` behandelt).

## 17. User-Zuordnung zu Aktivitäten

Funktion: `assignUsersToSports`.

- **Single**: alle entscheidungsberechtigten User ohne No-Go gegen die Single-Sportart.
- **Multi/Twin**: jeder User wird genau der gewählten Sportart mit seiner stärksten Stimme zugeordnet; No-Go-Sportarten werden für ihn übersprungen. Bei Gleichstand gewinnt implizit die zuerst verarbeitete Sportart.

## 18. ScoreBreakdown

Jeder Kandidat bekommt 13 gerundete Komponenten:

```ts
{
  participation, preference, fairness, minorityProtection,
  togetherness, weather, practicality, locationCapacity,
  cost, rotation, reliability, noGoPressure, modeBonus
}
```

### 18.1 Participation
Summe `participationWeight` aller zugeordneten User, skaliert: Single `* 0.55`, Multi/Twin `* 0.75`. (Gruppengrößen-Strafen liegen jetzt in `locationCapacity`, nicht hier.)

### 18.2 Preference
Summe der VoteScores aller gewählten Sportarten (`normalizeVoteWeight * (1 - reliabilityPenalty) * preferenceAttendanceWeight`).

### 18.3 Fairness
Summe FairnessDebt (User×Sport) der eindeutigen Voter je gewählter Sportart.

### 18.4 Minority Protection
Nur bei ≥ 2 Sportarten. Kleinste Gruppe bestimmen, deren Debt × Participation summieren, plus VoteScore:

```text
(mode === "single" ? 0 : 0.45) + min(1.4, minorityDebt * 0.45 + voteScore * 0.18)
```

Bei < 2 Sportarten: `0`.

### 18.5 Togetherness
Single `+1.4`, Multi same_spot `+1.25`, Multi social_radius `+0.9`, Twin `-0.55`, sonst `0`.

### 18.6 Weather
Summe der `weatherScore` aller Profile.

### 18.7 Practicality
Summe der `practicalityScore` (Basis-Praktikabilität) aller Profile.

### 18.8 Location Capacity
Funktion: `scoreLocationCapacity`. Aktivitäten werden nach **physischem Ort** gruppiert (Distanz-basiert via `getProfileProximity`). Pro Standortgruppe:

- zugeordnete Personen zwischen Standort-Min und -Max ⇒ `+0.35`,
- unter Minimum ⇒ `-max(1, minimum - assigned)`,
- über Maximum ⇒ `-max(1, assigned - maximum)`.

Min/Max kommen aus `minimumParticipants ?? minimumGroupSize ?? 1` bzw. `maximumParticipants ?? maximumGroupSize`.

### 18.9 Cost
Summe der `costScore` aller Profile (Abschnitt 14a).

### 18.10 Rotation
Funktion: `scoreRotation`. Pro Sport im Kandidaten:

- Sport ist Vorwochen-Primary und Index 0 ⇒ `-0.85` (hart als Primary blockiert).
- Sport war zuletzt Secondary ⇒ `-0.2`.
- Kategorie kam kürzlich vor ⇒ `-0.35` (bzw. `-0.15`, wenn nur als sekundäre Kategorie).

Rotation ist kein harter Ausschluss (der Primary-Block läuft über die harten Filter, Abschnitt 15.4).

### 18.11 Reliability
`-Σ (reliabilityPenalty[user] * voteWeight * preferenceAttendanceWeight)` über alle Stimmen der gewählten Sportarten.

### 18.12 No-Go-Druck
Funktion: `scoreNoGoPressure`. Pro ungelöstem No-Go (Person ohne Alternative):

- Single: `going` ⇒ `3.5`, `maybe` ⇒ `2`.
- Multi/Twin: `noGoPenalty (2.5)` × (`going` 1 / `maybe` `maybeParticipationWeight` 0.55).

Wird im FinalScore **abgezogen**.

### 18.13 Mode Bonus
Single `+0.3`, Multi-Sport `+0.15`, Twin `0`.

## 19. FinalScore

```text
finalScore =
  preference * 1.25 (preferenceScoreMultiplier)
  + participation
  + fairness
  + minorityProtection
  + togetherness
  + weather
  + practicality
  + locationCapacity
  + cost
  + rotation
  + reliability
  - noGoPressure
  + modeBonus
```

Beispiel (Single, aus der Test-Scorecard): `3.6*1.25 + 2.26 + 1.4 + 0.75 + 0.62 + 0.35 + 0.1 + 0.3 = 10.28`.

## 20. Kandidatenranking

Funktion: `compareCandidates`, in dieser Reihenfolge:

### 20.1 Majority Protection
Eine Option ist geschützt, wenn `primaryVoteShare >= 0.6`, kein ungelöster `going`-No-Go, kein harter Wetter-Risiko und `practicalityProblemScore <= 0.6`. Ein geschützter Kandidat gewinnt gegen einen ungeschützten, **außer** der Herausforderer hat `fairnessGap >= 1.2` **und** `primaryVoteScore >= 1.2`.

### 20.2 Fairness-First Override
`fairnessPriorityScore = fairness + minorityProtection`. Wenn `|fairnessGap| >= 0.55` und `|scoreGap| <= 1.5`, gewinnt der fairere Kandidat (sofern dessen `primaryVoteScore >= 1.2` oder Low-Vote-Fallback).

### 20.3 Twin-Restriktion
Bei Twin gegen Nicht-Twin gewinnt Twin nur, wenn `twinFairnessGap >= 0.7` oder `twinScoreGap >= 0.82`. Sonst verliert Twin.

### 20.4 FinalScore
Höherer `finalScore` gewinnt.

### 20.5 Tie-Breaks
`voteScore` → `uniqueVoters` → weniger ungelöste No-Gos → `practicality` → `weather` → Typpriorität (`single > multi_sport > twin > none`) → alphabetische `candidate.id`.

## 21. Decision Output und sanitisierte View

Der Algorithmus liefert intern `FairConstellationDecision` mit `mode`, gewählten Sport-/Profil-IDs, `activities`, `scores`, `scoreBreakdown`, `decisionCharacter`, `explainability`, `noGoBreakdown`, `losingCandidateReasons`, `excludedProfiles`, `weatherSnapshot`, `reason`.

`decisionCharacter` ist eines von: `clear_majority`, `fairness_adjusted`, `majority_protected`, `practicality_adjusted`, `weather_adjusted`, `combined_event`, `split_groups`, `fallback`, `no_valid_decision`.

`buildDecisionView` (`sanitize.ts`) erzeugt daraus die **einzige** Client-Payload `DecisionView`:

- Mitglieder sehen: `mode`, gewählte Sportarten/Profile, `decisionCharacterLabel`, `resultLabels`, `simpleExplanation`, optional `multiSportExplanation`, `noGoSummary`, `losingCandidateSummaries`, `activities` (mit `participantCount`, `weatherNotes`, `practicalityNotes` — **keine** User-IDs/Scores), `scoreComparison` (nur relativer Prozentwert vs. stärkste Option) und `viewerFairness` (nur Booleans `active`/`covered`).
- Admins bekommen zusätzlich `admin`: `voteSummaries` (Sportname + Voterzahl), `fairnessCovered`/`fairnessTotal`, `noGosResolved`/`Unresolved`/`Ignored`, `weatherNotes`, `practicalNotes` und `scoreRows` (vollständige `AdminScoreRow`-Scorecard pro Kandidat).

Die UI im Screenshot bildet genau das ab: „Bewertung der Optionen" = `scoreComparison.relativePercent`, „Admin-Explainability" = `admin`-Zusammenfassung, „Scorecard (Testphase)" = `admin.scoreRows`.

Niemals in der View: rohe Scores einzelner Dimensionen für Mitglieder, absolute FinalScores, Ranking-Margins, Kandidaten-IDs, Fairness-Debt-Rohwerte, gewichtete Vote-Scores, Option-Gewichte.

## 22. Finalisierung und AP-Auswahl

`withActivityContacts` setzt pro Aktivität in dieser Reihenfolge:

1. vorhandener `activity.activityContactId`,
2. Profil-AP aus `sport_profiles.ap_contact_id` (`selectProfileContact`),
3. erster zugewiesener User,
4. `selectActivityContact` (bester Voter der Sportart: niedriger `vote_rank`, Tie früherer `created_at`; Fallback erster `going`).

Der erste Aktivitätskontakt wird zusätzlich in `weekly_events.activity_contact_id` gespiegelt.

## 23. Twin und Subgroups

Bei `mode === "twin"`: alte `event_subgroups` löschen, pro Aktivität eine neue Subgroup anlegen (`event_id`, `sport_id`, `title`, `location`, `activity_contact_id`), danach `attendance.subgroup_id` für zugewiesene User setzen. `event_activities` bleibt die finalere Struktur; `event_subgroups` dient Kompatibilität/Chat/UI.

## 24. Datenbankmigrationen (Auswahl)

- `024_fairness_first_constellation.sql` — Kernschema (`sport_profiles`, `sport_no_gos`, `event_activities`, `weekly_events.decision_*`, `weather_snapshot`, `attendance.actual_status`/`checked_*`, Erweiterung `member_preference_history`).
- `025_sport_profile_site_ap_details.sql` — `location_rules`, `ap_contact_id`.
- `026_idea_profile_flow_admin_tools.sql` — Standort-/Karten-/Wetter-/Draft-/Review-Felder.
- `027_event_results_and_member_stats.sql` — Event-Ergebnisse und Statistik.
- `028_remove_wind_weather_rules.sql` — entfernte damals Wind-Regeln (Wind wird inzwischen wieder über `windSensitive`/`maxWindKmh` bewertet).
- `031_sport_profile_sports_and_sport_active.sql` — `sports.is_active`, M:N-Tabelle `sport_profile_sports`.
- `042_city_bound_events.sql` — `location_city` / Stadt-Scoping der Profile.
- `044` — verlagert die Schreibrechte der `weekly_events`-Entscheidungsspalten auf die Service Role; die rohen Internas werden nicht mehr persistiert.

Strukturierte Felder wie `cost_required`, `cost_per_person`, `cost_currency`, `ap_requirement_level`, `minimum_participants`, `maximum_participants`, `postal_code` werden vom aktuellen Algorithmus genutzt. Migrationsstand insgesamt bis `067_*`.

> Memory-Regel: Migrationen werden nie editiert; jede Änderung ist eine neue Datei (`068`, `069`, …).

## 25. Tests

- `tests/fairConstellationSelection.test.ts` — Single, Multi-Sport, Twin, No-Go, Maybe, Wetter, Fairness Debt, Profilwahl, Reliability, kombinierte Events.
- `tests/algorithmIsolation.test.ts` — verhindert, dass Client-Code den Algorithmus importiert.
- `tests/decisionPresentation.test.ts` — Präsentationslogik.
- `tests/votingRules.test.ts`, `tests/votingEligibility.test.ts`, `tests/locationSelection.test.ts`, `tests/sportCompatibility.test.ts`.

Checks: `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run pwa:build` (enthält `scripts/check-web-bundle.mjs`).

## 26. Wetter-Cache und Snapshot-Verhalten

`buildDecisionInput`: Kontext-`weatherSnapshot` → `event.weather_snapshot` → Live via Open-Meteo. Bei Finalisierung wird `decision.weatherSnapshot` in `weekly_events.weather_snapshot` gespeichert. Previews können live variieren; finalisierte Events bleiben über den gespeicherten Snapshot reproduzierbar.

## 27. Grenzen und Weiterentwicklung

### 27.1 Erledigt gegenüber früheren Ständen
- Mehr als zwei Aktivitäten: kombinierte Events mit 3–4 Sportarten an einem Ort sind implementiert (`generateCombinedCandidates`, `maxActivities = 4`).
- Strukturierte Kosten: `scoreCost` mit Stufen statt nur Textmalus.
- Wind wird wieder bewertet (`windSensitive`/`maxWindKmh`).
- Kritischer AP kann ein Profil hart ausschließen (`criticalApMissingExcludesProfile`).
- Rotation sieht über `event_activities` auch sekundäre Sportarten früherer Events.
- Standortkapazität wird pro physischem Ort über mehrere Aktivitäten zusammengefasst (`scoreLocationCapacity`).

### 27.2 Weiterhin offen
- **Ressourcen-/Flächenkonflikte**: Zwei Sportarten am exakt gleichen kleinen Platz können beide gewählt werden, obwohl sie sich real ausschließen. Felder wie `resource_group_key`, `parallel_capacity`, `exclusive_when_selected`, `surface_type` wären sinnvoll.
- **No-Go-Explainability**: No-Go-Konflikte erscheinen in `noGoBreakdown`/`admin`, aber nicht als eigenständige tiefe Erklärungsstruktur.
- **Reliability hängt an AP-Nachbereitung**: ohne gepflegte `actual_status` bleibt Reliability weitgehend wirkungslos.
- **`twinScoreMargin`**: wird als absoluter Score-Vorteil (kein Ratio) verwendet; Name könnte klarer sein.
- **AP-Logik**: könnte um AP-Rollen, Bereitschaft, Rotation, Zuverlässigkeit und „max. eine AP-Rolle pro Event" erweitert werden.

## 28. Fachliche Regeln (nicht brechen)

- Nutzer stimmen auf abstrakte Sportarten, nicht auf Profile.
- Profile sind konkrete Varianten; M:N wird im Service-Layer auf einzelne `sportId`-Profile expandiert.
- `not_going` zählt nicht. `maybe` zählt mit `0.55` (Teilnahme) bzw. `0.8` (Preference).
- No-Go ist persönliche Nicht-Akzeptanz, kein Downvote.
- Single und Multi-Sport werden gegenüber Twin bevorzugt, solange Fairness nicht klar dagegen spricht.
- Wetter und kritischer AP können Profile hart ausschließen; Rotation ist nur ein Malus.
- Reliability reduziert Einfluss, entfernt User aber nicht.
- Finale Entscheidung wird in `event_activities` und `weekly_events` persistiert; rohe Algorithmus-Internas **nicht**.
- Der Algorithmus bleibt server-seitig. Niemals in den Client importieren.

## 29. Glossar

- **Sportart**: abstrakt, z. B. Beachvolleyball.
- **Sportprofil**: konkrete Ausprägung, z. B. Beachvolleyball am Hörnle.
- **Single / Multi-Sport / Twin**: eine Aktivität / mehrere nah genug für ein gemeinsames Event / zwei getrennte Gruppen.
- **Fairness Debt**: Ausgleich für wiederholt ignorierte Wünsche.
- **Reliability Penalty**: Reduktion des Einflusses bei wiederholten No-Shows.
- **No-Go**: persönliche Nicht-Akzeptanz einer Sportart.
- **Togetherness**: Score-Komponente für gemeinsame Club-Erlebnisse.
- **Practicality**: Machbarkeit durch AP, Ausstattung, Anreise, Öffnungszeiten, Reservierung.
- **DecisionView**: sanitisiertes, frontend-sicheres Ergebnis; einzige Client-Payload.
- **Weather Snapshot**: pro Profil gespeicherte Wetterdaten zur Eventzeit.
</content>
</invoke>
