# Fairness-First Constellation Algorithmus - Technische Übergabe

Stand: 2026-06-05  
Projekt: Messers Cardio Club / Cardioclub  
Zweck: Vollständige Übergabe des aktuellen Algorithmus, seiner Datenabhängigkeiten, Scores, Persistenzwege, UI-Einflüsse, Grenzen und Weiterentwicklungspunkte.

## 1. Kurzfassung

Der produktive Entscheidungsalgorithmus ist `selectFairConstellation` in:

`src/lib/fairConstellationSelection.ts`

Er wählt nicht mehr nur eine abstrakte Sportart, sondern eine konkrete Event-Konstellation aus Sportprofilen:

- `single`: eine Aktivität für alle akzeptierten Teilnehmenden.
- `multi_sport`: zwei Aktivitäten im selben Ort oder Social Radius, weiterhin als gemeinsames Club-Event.
- `twin`: zwei getrennte Gruppen, wenn zwei echte Gruppen entstehen und das fairer/praktikabler ist.
- `none`: keine Entscheidung möglich.

Die Nutzer stimmen bewusst einfach auf abstrakte Sportarten ab. Der Algorithmus sucht danach passende konkrete `sport_profiles` und bewertet Konstellationen aus Profilen.

Wichtig: Die alte Funktion `selectFairSport` existiert noch in `src/lib/fairSportSelection.ts`, ist aber Legacy und nicht der aktuelle Entscheidungsweg für die App.

## 2. Relevante Dateien

### Algorithmus-Kern

- `src/lib/fairConstellationSelection.ts`
  - Typen für Sportarten, Profile, Votes, Attendance, Wetter, ScoreBreakdown.
  - `DEFAULT_OPTIONS`.
  - `selectFairConstellation`.
  - Profilbewertung, Kandidatengenerierung, Scoring, Ranking, Gründe.

- `src/lib/decisionPresentation.ts`
  - Übersetzt die algorithmische Entscheidung in UI-taugliche Texte, Labels und Score-Zeilen.

- `src/lib/votingRules.ts`
  - Rank 1/2/3, maximale Stimmenzahl, Rank-Gewichte.

- `src/lib/votingEligibility.ts`
  - Filtert Votes/No-Gos von `not_going` und nicht teilnahmeberechtigten Nutzern für die App-Darstellung.

### Services und Persistenz

- `src/services/decisions.ts`
  - Baut den Input für `selectFairConstellation`.
  - Lädt Event, Proposals, Votes, Attendance, No-Gos, Sports, Profiles, Historie, Reliability, Weather.
  - Finalisiert die Entscheidung.
  - Persistiert `event_activities`, `weekly_events`, `member_preference_history`, bei Twin auch `event_subgroups`.

- `src/services/sportProfiles.ts`
  - Lädt und speichert Sportprofile.
  - Wichtiger M:N-Mapping-Layer zwischen `sport_profiles` und `sport_profile_sports`.

- `src/services/weather.ts`
  - Holt Open-Meteo Forecastdaten.
  - Baut `ProfileWeatherSnapshot`.

- `src/services/eventActivities.ts`
  - Speichert finale Event-Aktivitäten aus der Entscheidung.

- `src/services/votes.ts`
  - Speichert Votes und erzwingt Voting-Regeln.

- `src/services/noGos.ts`
  - Speichert persönliche No-Gos.

- `src/services/attendance.ts`
  - Speichert Teilnahme.

- `src/services/attendanceReview.ts`
  - AP/Admin-Nachbereitung tatsächlicher Anwesenheit.

- `src/services/liveApp.ts`
  - Baut den aktuellen App-State inklusive Preview-Decision und Präsentation.

### Datenbankmigrationen

- `supabase/migrations/024_fairness_first_constellation.sql`
  - Kernschema für Fairness-First:
    - `sport_profiles`
    - `sport_no_gos`
    - `event_activities`
    - `weekly_events.decision_type`
    - `weekly_events.decision_scorecard`
    - `weekly_events.weather_snapshot`
    - `attendance.actual_status`
    - `attendance.checked_by`
    - `attendance.checked_at`
    - Erweiterung `member_preference_history`

- `supabase/migrations/025_sport_profile_site_ap_details.sql`
  - `sport_profiles.location_rules`
  - `sport_profiles.ap_contact_id`

- `supabase/migrations/026_idea_profile_flow_admin_tools.sql`
  - Standort-, Karten-, Wetter-, Draft- und Review-Felder für Sportideen.

- `supabase/migrations/027_event_results_and_member_stats.sql`
  - Event-Ergebnisse und spätere Statistikdaten.

- `supabase/migrations/028_remove_wind_weather_rules.sql`
  - Entfernt Wind-Regeln aus gespeicherten Weather Rules.

- `supabase/migrations/031_sport_profile_sports_and_sport_active.sql`
  - `sports.is_active`
  - M:N-Tabelle `sport_profile_sports`
  - Admin-Upsert für Sportarten.

### Tests

- `tests/fairConstellationSelection.test.ts`
  - Zentrale Tests für Single, Multi-Sport, Twin, No-Go, Maybe, Wetter, Fairness Debt, Profilwahl, Reliability.

- `tests/decisionPresentation.test.ts`
  - Präsentationslogik.

- `tests/votingRules.test.ts`
  - Rank-Gewichte.

- `tests/votingEligibility.test.ts`
  - Sichtbarkeits-/Teilnahmefilter.

- `tests/locationSelection.test.ts`
  - Standort-/Profilnähe.

- `tests/sportCompatibility.test.ts`
  - Sport-/Profilkompatibilität.

## 3. Datenmodell: Fachliche Konzepte

### Abstrakte Sportart

Tabelle: `sports`

Eine Sportart ist abstrakt:

- Beachvolleyball
- Boxen
- Radfahren
- Laufen
- Badminton

Relevante Felder:

- `id`
- `name`
- `category`
- `intensity_level`
- `combinable_tags`
- `description`
- `is_active`

Die UI zeigt im Voting nur aktive Sportarten, die mindestens ein aktives Profil haben. Das passiert in `listSports`.

### Sportprofil

Tabelle: `sport_profiles`

Ein Profil ist eine konkrete Variante einer Sportart oder eines Standortangebots:

- Beachvolleyball am Hörnle
- Fußball am Stadtpark
- Badminton in der Halle
- Boxen im Park

Relevante Felder:

- `sport_id`: primäre/legacy Sportart.
- `name`: Profilname.
- `location_name`: kurzer Standortname.
- `map_url`
- `postal_code`
- `location_city`
- `latitude`, `longitude`
- `venue_group_key`
- `location_type`: `indoor`, `outdoor`, `water`, `field`, `flexible`
- `is_indoor`
- `minimum_group_size`
- `maximum_group_size`
- `required_equipment`
- `available_equipment`
- `cost_note`
- `opening_notes`
- `lighting_available`
- `transit_notes`
- `amenity_notes`
- `reservation_required`
- `safety_notes`
- `location_rules`
- `ap_required`
- `ap_contact_id`
- `weather_rules`
- `is_active`
- `created_by`

### Mehrere Sportarten pro Standortprofil

Tabelle: `sport_profile_sports`

Ein Standortprofil kann mit mehreren Sportarten verknüpft sein. Beispiel:

- Standort "Hörnle"
  - Beachvolleyball
  - Schwimmen
  - Laufen

Wichtige technische Umsetzung:

Der Kernalgorithmus kennt pro `SportProfile` nur ein `sportId`. Deshalb expandiert `listSportProfilesForSports` in `src/services/sportProfiles.ts` verlinkte Profile virtuell:

- gleiches physisches Profil,
- gleiche Profil-ID,
- aber für den Algorithmus jeweils mit anderem `sport_id`.

Das ist zentral. Wer den Algorithmus weiterentwickelt, muss wissen: Die M:N-Logik liegt aktuell im Service-Layer, nicht im Algorithmus-Kern.

### Event-Aktivitäten

Tabelle: `event_activities`

Nach Finalisierung werden die konkreten Aktivitäten gespeichert:

- `event_id`
- `sport_id`
- `sport_profile_id`
- `role`: `primary` oder `secondary`
- `activity_type`: `single`, `multi_sport`, `twin`, `none`
- `title`
- `location`
- `starts_at`
- `activity_contact_id`
- `assigned_user_ids`

Diese Tabelle ist die persistierte Wahrheit für finale Single-, Multi-Sport- oder Twin-Aktivitäten.

### No-Gos

Tabelle: `sport_no_gos`

No-Gos sind persönliche harte Unverträglichkeiten auf abstrakter Sportart-Ebene:

- `event_id`
- `sport_id`
- `user_id`
- `reason`

Fachlich: Kein normales Downvoting. Ein No-Go bedeutet: Diese Person soll für diese Sportart nicht akzeptiert eingeplant werden.

Technisch aktuell: No-Go schließt eine Sportart nicht global aus. Es verhindert die persönliche Zuordnung und erzeugt eine hohe Strafkomponente, wenn die Person sonst keine Alternative bekommt.

### Attendance

Tabelle: `attendance`

Geplante Teilnahme:

- `going`
- `maybe`
- `not_going`

Tatsächliche Nachbereitung:

- `actual_status`: `present`, `absent`, `excused`, `unknown`
- `checked_by`
- `checked_at`

Für die Entscheidung zählen nur `going` und `maybe`.

### Preference History

Tabelle: `member_preference_history`

Wird für Fairness Debt verwendet:

- `club_id`
- `user_id`
- `sport_id`
- `week_start_date`
- `voted_for`
- `was_selected`
- `vote_rank`
- `covered_by_decision`
- `covered_by_activity_type`

Nach Finalisierung wird für jede relevante Stimme eine Historienzeile geschrieben.

## 4. Gesamtfluss

### 4.1 Voting

Nutzerfluss:

1. Teilnahme wählen:
   - `going`
   - `maybe`
   - `not_going`

2. Bis zu drei abstrakte Sportarten wählen.

3. Optional No-Go je Sportart setzen.

Voting-Regeln:

- Maximal 3 Stimmen pro Event.
- Ränge:
  - Rang 1 = Gewicht `1.0`
  - Rang 2 = Gewicht `0.6`
  - Rang 3 = Gewicht `0.3`
- Votes sind nur erlaubt, wenn Eventstatus `proposing` oder `voting` ist.
- Votes sind nur erlaubt, wenn Attendance `going` oder `maybe` ist.
- `not_going` darf nicht abstimmen.
- Ein Rank kann nur einmal vergeben werden; wenn Rang 2 neu vergeben wird, wird der alte Rang-2-Vote entfernt.

### 4.2 Decision Preview

`getEventDecisionPreview` ruft:

1. `buildDecisionInput`
2. `selectFairConstellation`

Preview finalisiert nichts. Sie berechnet nur eine aktuelle mögliche Entscheidung.

### 4.3 Decision Finalize

`finalizeEventDecision`:

1. Lädt Event.
2. Verhindert erneute Finalisierung, wenn Status schon `decided`, `completed` oder `cancelled`.
3. Berechnet Preview.
4. Bricht ab, wenn keine Gewinner-Sportart existiert.
5. Wählt APs pro Aktivität.
6. Ersetzt `event_activities`.
7. Persistiert `member_preference_history`.
8. Erstellt bei `twin` zusätzlich `event_subgroups`.
9. Aktualisiert `weekly_events`.

`weekly_events` bekommt:

- `selected_sport_id`
- `secondary_sport_id`
- `decision_type`
- `decision_reason`
- `decision_scorecard`
- `weather_snapshot`
- `activity_contact_id`
- `status = decided`

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
  preferenceHistory?: PreferenceHistoryEntry[];
  recentSelections?: RecentSelection[];
  reliabilityHistory?: ReliabilityHistoryEntry[];
  weatherSnapshot?: ProfileWeatherSnapshot;
  options?: Partial<FairConstellationOptions>;
}
```

### `AbstractSport`

```ts
{
  id: string;
  name?: string;
  category: string;
  intensityLevel?: "low" | "medium" | "high";
  combinableTags?: string[];
}
```

### `SportProfile`

```ts
{
  id: string;
  sportId: string;
  name: string;
  locationName?: string | null;
  venueGroupKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationType: "indoor" | "outdoor" | "water" | "field" | "flexible";
  isIndoor?: boolean;
  minimumGroupSize?: number;
  maximumGroupSize?: number | null;
  requiredEquipment?: string[];
  availableEquipment?: string[];
  costNote?: string | null;
  openingNotes?: string | null;
  lightingAvailable?: boolean | null;
  transitNotes?: string | null;
  amenityNotes?: string | null;
  reservationRequired?: boolean | null;
  safetyNotes?: string | null;
  locationRules?: string | null;
  apRequired?: boolean | null;
  apContactId?: string | null;
  weatherRules?: WeatherRules | null;
  isActive?: boolean;
}
```

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
}
```

Hinweis: Wind-Regeln wurden entfernt. Open-Meteo lädt Winddaten noch, der Algorithmus bewertet Wind aber aktuell nicht.

## 6. Default-Optionen

Aus `DEFAULT_OPTIONS`:

| Option | Wert | Bedeutung |
|---|---:|---|
| `maxActivities` | `2` | Modelliert maximal zwei Aktivitäten; aktuell nicht für mehr als zwei genutzt. |
| `maybeParticipationWeight` | `0.55` | Gewicht von `maybe`. |
| `noAttendanceWeight` | `0` | Kein Attendance-Eintrag zählt nicht. |
| `neglectBoostPerWeek` | `0.35` | Fairness Debt pro direkt ignorierter Vorwoche. |
| `maxFairnessDebt` | `2` | Maximaler Debt pro User. |
| `noGoPenalty` | `2.5` | Strafwert für nicht abgedeckte No-Go-Konflikte. |
| `minSecondaryVoteScore` | `1.2` | Mindestscore für eine zweite echte Gruppe. |
| `strongSecondaryVoteRatio` | `0.32` | Zweitgruppe braucht mindestens 32 Prozent der Erstgruppe. |
| `twinScoreRatio` | `0.82` | Wird faktisch als absoluter Twin-Score-Vorteil verwendet. |
| `fairnessFirstMargin` | `0.45` | Mindest-Fairnessvorteil für Fairness-Override. |
| `fairnessOverrideWindow` | `2.2` | Score-Abstand, innerhalb dessen Fairness gewinnen darf. |
| `twinFairnessMargin` | `0.7` | Fairnessvorteil, damit Twin gegen gemeinsame Varianten gewinnen darf. |
| `socialRadiusKm` | `0.75` | Radius für Multi-Sport als gemeinsames Event. |
| `sameSpotRadiusKm` | `0.12` | Radius für gleicher Ort. |
| `previousPrimaryPenalty` | `0.85` | Rotation-Malus für letzte Hauptsportart. |
| `recentCategoryPenalty` | `0.35` | Kategorie-Rotationsmalus. |
| `reliabilityPenaltyPerNoShow` | `0.12` | No-Show-Penalty pro Fall. |
| `maxReliabilityPenalty` | `0.45` | Maximaler Reliability-Penalty pro User. |

## 7. Vorfilter im Algorithmus

Am Anfang von `selectFairConstellation`:

1. `sportsById` mappt Sport-ID zu Sport.
2. `proposedSportIds` kommt aus `sport_proposals`.
3. `activeProfiles`:
   - Profil muss aktiv sein: `profile.isActive !== false`
   - Profil muss zu vorgeschlagener Sportart gehören.
4. `attendanceByUser`.
5. No-Gos werden nach Sport gruppiert.
6. `eligibleVotes`:
   - Vote-Sport muss vorgeschlagen sein.
   - User muss `going` oder `maybe` sein.
   - User darf für diese Sportart kein No-Go gesetzt haben.
7. Votes werden nach Sport gruppiert.
8. `votedSportIds` enthält nur vorgeschlagene Sportarten mit mindestens einer gültigen Stimme.

Wenn keine gültigen Stimmen existieren:

```text
mode = "none"
reason = "Keine Entscheidung: Es gibt keine gültigen Stimmen ..."
```

## 8. Attendance-Gewichtung

```ts
going = 1
maybe = 0.55
not_going = 0
kein Attendance-Eintrag = 0
```

`not_going` wird im Algorithmus also nicht nur schwach gewichtet, sondern komplett ignoriert.

## 9. Vote-Gewichtung

```ts
rank 1 = 1
rank 2 = 0.6
rank 3 = 0.3
fallback ohne rank/weight = 1
```

Wenn `vote.weight` gesetzt ist, nutzt der Algorithmus das direkte Gewicht. Sonst wird aus `rank` abgeleitet.

VoteScore:

```text
normalizeVoteWeight(vote)
* (1 - reliabilityPenaltyByUser[user])
* participationWeight(userAttendance)
```

## 10. Fairness Debt

Funktion: `calculateFairnessDebt`

Input: `member_preference_history`

Algorithmus pro User:

1. Historie nach User gruppieren.
2. Wochen gruppieren.
3. Wochen rückwärts sortieren.
4. Für jede Woche:
   - Wenn User in dieser Woche nichts gewählt hat: stop.
   - Wenn mindestens eine seiner Stimmen durch Entscheidung abgedeckt wurde: stop.
   - Sonst `ignoredWeeks += 1`.
5. Debt:

```text
min(ignoredWeeks * 0.35, 2.0)
```

Abdeckung:

```ts
entry.coveredByDecision ?? entry.wasSelected
```

Das bedeutet: Neue Logik nutzt `covered_by_decision`; alte Daten fallen auf `was_selected` zurück.

## 11. Reliability Penalty

Funktion: `calculateReliabilityPenalties`

Input:

- `reliabilityHistory`
- aktuelle `attendance`

Logik:

1. Historie nach User gruppieren.
2. Pro User die letzten 6 Einträge betrachten.
3. Zählen:

```text
plannedStatus === "going" && actualStatus === "absent"
```

4. Penalty:

```text
min(recentNoShows * 0.12, 0.45)
```

5. Aktuelle Attendance kann zusätzlich einen Penalty erzeugen, wenn:

```text
status === "going" && actualStatus === "absent"
```

Wirkung:

- reduziert VoteScore über `1 - penalty`
- erzeugt zusätzlichen negativen `reliability` Score

Wichtig: User werden nicht ausgeschlossen. Ihr Einfluss wird nur reduziert.

## 12. Profilbewertung

Jedes aktive Profil wird vor Kandidatengenerierung bewertet:

```ts
evaluateProfiles(profile, weatherSnapshot)
```

Ergebnis:

- `weatherScore`
- `practicalityScore`
- optional `excluded`
- `weatherReasons`
- `practicalityReasons`

Ausgeschlossene Profile werden nicht für Kandidaten genutzt und erscheinen in `excludedProfiles`.

## 13. Wetterbewertung

Funktion: `scoreWeather`

### Indoor

Wenn:

```ts
profile.isIndoor || profile.locationType === "indoor"
```

dann:

```text
score = +0.8
reason = "Indoor-Profil ist wetterstabil."
```

### Fehlende Wetterdaten oder Koordinaten

Wenn Outdoor und keine Koordinaten oder kein Wetter:

```text
score = -0.35
reason = "Wetter konnte mangels Koordinaten oder Wetterdaten nicht sicher bewertet werden."
```

### Gewitter

Wenn:

```ts
(rules.thunderstormUnsafe ?? true) && weatherCode >= 95
```

dann:

```text
score = -5
excluded = "Gefährliches Gewitterwetter schließt dieses Outdoor-Profil aus."
```

Das ist ein harter Ausschluss.

### Regen

Startwert Outdoor:

```text
score = +0.4
```

Wenn Profil trocken nötig oder regensensibel ist und Niederschlag über Grenzwert liegt:

```text
score -= 0.85
reason = "Regen passt nur schlecht zu diesem Profil."
```

Grenzwert:

```ts
rules.maxPrecipitationMm ?? 1.5
```

Wenn leichter Regen oder hohe Wahrscheinlichkeit:

```ts
precipitation > 0.5 || precipitationProbability > 65
```

dann:

```text
score -= 0.35
reason = "Das Wetter ist etwas ungemütlich, aber nicht gefährlich."
```

Sonst:

```text
score += 0.35
reason = "Das Wetter passt zum Outdoor-Profil."
```

### Temperatur

Hitze:

```ts
rules.heatSensitive && temperature > (rules.maxTemperatureC ?? 30)
```

```text
score -= 0.35
```

Kälte:

```ts
rules.coldSensitive && temperature < (rules.minTemperatureC ?? 6)
```

```text
score -= 0.35
```

### Open-Meteo

`fetchEventWeatherSnapshot`:

- nutzt `startsAt`
- holt für jedes Profil mit Koordinaten Forecastdaten
- nimmt die stündliche Wetterzeile, deren Zeit am nächsten am Eventstart liegt
- gibt `ProfileWeatherSnapshot` zurück

Wenn `weekly_events.weather_snapshot` bereits vorhanden ist, wird dieser bevorzugt. Sonst wird live geholt. Bei Finalisierung wird der Snapshot im Event gespeichert.

## 14. Praktikabilität

Funktion: `scoreBasePracticality`

Startwert:

```text
score = +0.35
```

Bonusse:

| Bedingung | Score |
|---|---:|
| Licht vorhanden | `+0.12` |
| Öffnungszeiten dokumentiert | `+0.08` |
| Anreise/ÖPNV/Parken dokumentiert | `+0.08` |
| Infrastruktur dokumentiert | `+0.08` |
| Standortregeln hinterlegt | `+0.05` |
| Sicherheitsinfos hinterlegt | `+0.03` |
| AP nötig und AP hinterlegt | `+0.12` |
| AP nicht nötig, aber AP hinterlegt | `+0.06` |
| alle benötigten Equipment-Items auch verfügbar | `+0.14` |

Mali:

| Bedingung | Score |
|---|---:|
| Kostenhinweis vorhanden | `-0.04` |
| Reservierung nötig | `-0.12` |
| AP nötig, aber kein AP hinterlegt | `-0.18` |
| fehlendes Equipment | `-0.12` pro Item, max `-0.4` |
| Outdoor ohne Koordinaten | `-0.12` |

Equipment wird normalisiert:

- trim
- lowercase
- leere Werte raus

## 15. Kandidatengenerierung

### Single-Kandidaten

Für jede Sportart mit gültigen Stimmen:

1. Bestes Profil für diese Sportart suchen.
2. Wenn vorhanden: `single`-Kandidat bauen.

Bestes Einzelprofil:

```text
höchster weatherScore + practicalityScore
Tie: Profilname alphabetisch
```

### Paar-Kandidaten

Sportarten werden zuerst nach Gruppensupport sortiert.

Gruppensupport:

```text
sumVoteScore
+ Summe FairnessDebt der Unique Voters * AttendanceWeight * 0.35
```

Für jedes Sportartenpaar:

1. Bestes Profilpaar suchen.
2. Nähe bestimmen.
3. Zweitgruppenstärke prüfen.
4. Falls nahe genug: Multi-Sport-Kandidat bauen.
5. Twin-Kandidat bauen, wenn Participation hoch genug ist.

### Zweitgruppenprüfung

Eine zweite Gruppe ist nur sinnvoll, wenn:

```text
secondScore >= 1.2
secondScore >= firstScore * 0.32
```

Ohne diese Prüfung wird kein Multi/Twin für das Paar gebaut.

### Profilpaar-Auswahl

Für jedes Profil A der ersten Sportart und Profil B der zweiten Sportart:

```text
pairScore =
  weatherA + practicalityA
  + weatherB + practicalityB
  + proximityScore
```

Bestes Paar gewinnt.

## 16. Nähe und Standortlogik

Funktion: `getProfileProximity`

Ergebnis:

- `same_spot`
- `social_radius`
- `split_location`
- `unknown`

Logik:

1. Gleiches Profil:

```text
same_spot
```

2. Gleicher `venueGroupKey`:

```text
same_spot
```

3. Distanz nicht berechenbar:

```text
unknown
```

4. Distanz <= `sameSpotRadiusKm = 0.12`:

```text
same_spot
```

5. Distanz <= `socialRadiusKm = 0.75`:

```text
social_radius
```

6. Sonst:

```text
split_location
```

ProximityScore:

| Nähe | Score |
|---|---:|
| `same_spot` | `+0.75` |
| `social_radius` | `+0.45` |
| `split_location` | `-0.2` |
| `unknown` | `-0.1` |

Multi-Sport wird nur gebaut bei:

- `same_spot`
- `social_radius`

Twin darf auch bei `split_location` oder `unknown` entstehen. `unknown` wird im Twin-Kandidaten als `split_location` behandelt.

## 17. User-Zuordnung zu Aktivitäten

Funktion: `assignUsersToSports`

### Single

Bei Single werden alle entscheidungsberechtigten User gesammelt:

- User mit gültigem Vote
- User mit No-Go, sofern Attendance `going` oder `maybe`

Dann werden alle zugeordnet, die kein No-Go gegen die Single-Sportart haben.

### Multi-Sport und Twin

Jeder User wird genau einer der gewählten Sportarten zugeordnet:

1. Für jede gewählte Sportart werden Votes betrachtet.
2. Hat User für mehrere der gewählten Sportarten gestimmt, gewinnt seine stärkste Stimme.
3. No-Go-Sportarten werden für diesen User übersprungen.
4. Zuordnung geht in `assignedUserIds`.

Wichtig: Bei Gleichstand gewinnt implizit die Sportart, die in der Kandidatenreihenfolge früher verarbeitet wird.

## 18. ScoreBreakdown

Jeder Kandidat bekommt:

```ts
{
  participation,
  preference,
  fairness,
  minorityProtection,
  togetherness,
  weather,
  practicality,
  rotation,
  reliability
}
```

Alle Werte werden auf zwei Nachkommastellen gerundet.

### 18.1 Participation

Funktion: `scoreParticipation`

Für jede Aktivität:

- Summe `participationWeight` aller zugeordneten User.
- Wenn unter Mindestgruppe:

```text
score -= max(1, minGroup - participantCount)
```

- Wenn über Maximalgruppe:

```text
score -= max(1, participantCount - maxGroup)
```

Danach Skalierung:

```text
single: score * 0.55
multi_sport/twin: score * 0.75
```

### 18.2 Preference

Summe der VoteScores aller gewählten Sportarten:

```text
normalizeVoteWeight
* reliabilityMultiplier
* attendanceWeight
```

ReliabilityMultiplier:

```text
1 - reliabilityPenalty
```

### 18.3 Fairness

Summe FairnessDebt der abgedeckten User:

- Single: Unique Voters der Sportart.
- Multi/Twin: zugewiesene User je Sportart.

### 18.4 Minority Protection

Nur bei zwei Sportarten relevant.

1. Kleinere Gruppe bestimmen.
2. Fairness Debt dieser Gruppe summieren.
3. VoteScore der Minderheit berechnen.

Formel:

```text
0.45 + min(1.4, minorityDebt * 0.45 + voteScore * 0.18)
```

Bei Single:

```text
0
```

Im Code steht zwar `mode === "single" ? 0 : 0.45`, aber die Funktion gibt vorher bei weniger als zwei Sportarten `0` zurück.

### 18.5 Togetherness

| Mode / Nähe | Score |
|---|---:|
| Single | `+1.4` |
| Multi-Sport same spot | `+1.25` |
| Multi-Sport social radius | `+0.9` |
| Twin | `-0.55` |
| sonst | `0` |

Das bevorzugt gemeinsame Club-Events, solange Fairness/Praktikabilität nicht klar dagegen sprechen.

### 18.6 Weather

Summe der `weatherScore` aller Profile.

### 18.7 Practicality

Summe:

```text
basePracticality jedes Profils
+ scoreActivityGroupSizes
```

Gruppengrößen:

- Wenn `participantCount` zwischen min und max:

```text
+0.35
```

- sonst:

```text
-1
```

### 18.8 Rotation

Funktion: `scoreRotation`

Inputs:

- `previousWeekSportId`
- `recentSelections`
- Sportkategorien
- Mode

Logik je Sport in Kandidat:

Wenn Sport genau Vorwochensport:

```text
primary: -0.85
secondary: -0.85 * 0.35 = -0.2975
```

Wenn gleiche Kategorie wie Vorwoche und Single:

```text
-0.35
```

Wenn Kategorie in letzten 4 Events:

```text
-0.35 * 0.5 = -0.175
```

Wichtig: Rotation ist kein harter Ausschluss. Eine Vorwochensportart kann wieder gewinnen, wenn die Gesamtlage stark genug ist.

### 18.9 Reliability

Funktion: `scoreReliability`

Für jede Stimme der gewählten Sportarten:

```text
score -= reliabilityPenalty[user]
       * voteWeight
       * participationWeight
```

Danach wird No-Go-Druck abgezogen:

```text
reliability = scoreReliability - scoreNoGoPressure
```

No-Go-Druck:

Für jeden No-Go-User einer Aktivität:

- wenn User nicht teilnahmeberechtigt: ignorieren.
- wenn User eine alternative Aktivität bekommt: kein Penalty.
- wenn keine Alternative:

```text
penalty += noGoPenalty * attendanceWeight
```

Mit Default:

```text
going: 2.5
maybe: 1.375
```

## 19. FinalScore

Ein Kandidatenscore:

```text
finalScore =
  participation
  + preference
  + fairness
  + minorityProtection
  + togetherness
  + weather
  + practicality
  + rotation
  + reliability
  + modeBonus
```

ModeBonus:

```text
single: +0.3
multi_sport: +0.15
twin: +0
```

Das bevorzugt Single und Multi-Sport leicht, wenn alles andere ähnlich ist.

## 20. Kandidatenranking

Funktion: `compareCandidates`

Sortierung in dieser Reihenfolge:

### 20.1 Fairness-First Override

Verglichen wird:

```text
fairnessPriorityScore = fairness + minorityProtection
```

Wenn:

```text
abs(fairnessGap) >= 0.45
abs(finalScoreGap) <= 2.2
```

dann gewinnt der fairere Kandidat.

Das ist der Kern von "Fairness First": Fairness darf gewinnen, wenn der Score-Abstand nicht zu groß ist.

### 20.2 Togetherness/Twin-Präferenz

Wenn einer der Kandidaten Twin ist und der andere nicht:

Twin darf nur gewinnen, wenn:

```text
twinFairnessGap >= 0.7
oder
twinScoreGap >= 0.82
```

Sonst verliert Twin gegen Single/Multi.

Wenn Kandidaten sehr ähnlich sind:

```text
abs(finalScoreGap) <= 0.35
abs(fairnessPriorityGap) <= 0.35
```

dann gewinnt Typpriorität:

```text
single > multi_sport > twin > none
```

### 20.3 FinalScore

Wenn bisher kein Ranking entschieden wurde:

```text
höherer finalScore gewinnt
```

### 20.4 Typpriorität

Bei gleichem FinalScore:

```text
single > multi_sport > twin > none
```

### 20.5 ID

Als letzter Tie-Break:

```text
alphabetische candidate.id
```

## 21. Decision Output

Typ: `FairConstellationDecision`

```ts
{
  mode;
  selectedSportId?;
  secondarySportId?;
  selectedProfileId?;
  secondaryProfileId?;
  activities;
  scores;
  scoreBreakdown?;
  excludedProfiles;
  weatherSnapshot?;
  reason;
}
```

### `CandidateActivity`

```ts
{
  sportId;
  sportName;
  profileId;
  profileName;
  locationName?;
  role; // primary oder secondary
  assignedUserIds;
  participantCount;
  activityContactId?;
  weatherNotes?;
  practicalityNotes?;
}
```

### `excludedProfiles`

Enthält Profile, die hart ausgeschlossen wurden, z. B. Outdoor bei Gewitter.

## 22. Entscheidungsgründe

`buildDecisionReason` erzeugt grobe Standardgründe:

Single:

```text
Sport (Profil) wurde gewählt, weil diese Konstellation Zustimmung, Fairness, Wetter und Machbarkeit am besten verbindet.
```

Multi-Sport:

```text
Sport A und Sport B wurden als Multi-Sport Event gewählt, weil beide Gruppen starken Rückhalt haben und die Profile räumlich nah genug für ein gemeinsames Club-Event sind.
```

Twin:

```text
Sport A und Sport B wurden als Twin Event gewählt, weil zwei echte Gruppen entstanden sind und diese Lösung fairer ist als eine Gruppe zu ignorieren.
```

UI-Präsentation nutzt zusätzlich `decisionPresentation.ts` für:

- `resultLabels`
- `simpleExplanation`
- `activityRows`
- `scoreRows`

## 23. Finalisierung und AP-Auswahl

`withActivityContacts` setzt pro Aktivität:

1. vorhandener `activity.activityContactId`
2. Profil-AP aus `sport_profiles.ap_contact_id`
3. erster zugewiesener User
4. `selectActivityContact`

`selectActivityContact`:

1. lädt Votes und Attendance
2. betrachtet nur `going` oder `maybe`
3. wählt besten Voter der Sportart:
   - niedriger `vote_rank` gewinnt
   - früherer `created_at` als Tie-Break
4. fallback: erster `going`

Der erste Aktivitätskontakt wird zusätzlich in `weekly_events.activity_contact_id` gespiegelt.

## 24. Twin und Subgroups

Bei `decision.mode === "twin"`:

- alte `event_subgroups` werden gelöscht
- pro Aktivität wird eine neue Subgroup angelegt:
  - `event_id`
  - `sport_id`
  - `title`
  - `location`
  - `activity_contact_id`
- Danach wird `attendance.subgroup_id` für zugewiesene User gesetzt.

Wichtig: `event_activities` ist trotzdem die modernere/finalere Struktur. `event_subgroups` bleibt Kompatibilität/Chat-/UI-Hilfe.

## 25. UI-Einflüsse auf den Algorithmus

### Voting UI

Im Home/Voting-Flow:

- Teilnahme Schritt 1.
- Sportarten Schritt 2.
- bis zu 3 Ränge.
- No-Go je Sportart.

Nur Sportarten aus `listSports` erscheinen:

- `sports.is_active = true`
- mindestens ein aktives Profil über `sport_profiles` oder `sport_profile_sports`.

Dadurch kommen Sportarten ohne Standortprofil praktisch nicht in `sport_proposals` und damit nicht in den Algorithmus.

### Aktive Sportarten und Profile

`listSports` nutzt lokalen Cache:

```text
mcc.cache.activeSportsWithProfiles.v2
TTL 60 Sekunden
```

`listSportProfiles` und `listSportProfileSportLinks` haben ebenfalls 60 Sekunden Cache.

Bei Profiländerungen werden Profil-Caches gelöscht.

### App-State

`getMccEventState`:

- bootstrapt die aktuelle MCC-Woche
- lädt Event, Sports, Proposals, Votes, Attendance, No-Gos, DecisionPreview, Activities
- filtert sichtbare Votes/No-Gos von Nicht-Teilnehmenden
- baut `decisionText`

Home-Screen nutzt zusätzlich AsyncStorage für Event-State Cache.

## 26. Wetter-Cache und Snapshot-Verhalten

Aktueller Ablauf:

1. `buildDecisionInput` schaut zuerst:
   - wurde ein `weatherSnapshot` explizit im Kontext übergeben?
   - sonst: steht `event.weather_snapshot` schon in der Datenbank?
   - sonst: live via Open-Meteo holen.

2. Bei Finalisierung wird `decision.weatherSnapshot` in `weekly_events.weather_snapshot` gespeichert.

Konsequenz:

- Previews vor Finalisierung können live variieren.
- Finalisierte Events bleiben über gespeicherten Snapshot erklärbar/reproduzierbarer.

## 27. Testabdeckung

Zentrale Fälle in `tests/fairConstellationSelection.test.ts`:

- Single gewinnt bei breitem Support.
- Multi-Sport gewinnt bei nahen Profilen.
- Innerhalb derselben Sportart gewinnt besser passendes/nahes Profil.
- Twin gewinnt bei echten Gruppen an getrennten Orten.
- No-Go-User werden bei Single nicht als akzeptiert zugeordnet.
- `not_going` wird ignoriert.
- `maybe` zählt reduziert.
- Votes ohne Attendance zählen nicht.
- Outdoor-Gewitter schließt aus, Indoor bleibt möglich.
- Fairness Debt hebt wiederholt ignorierte Nutzer.
- Fairness Debt kann Minderheit in Multi-Sport sichtbar machen.
- Praktikabilität bevorzugt gut dokumentiertes Profil mit AP/Ausstattung.
- Regen malusiert Outdoor, Indoor stabil.
- Reliability reduziert No-Show-Einfluss, entfernt ihn aber nicht.

Aktueller Check zuletzt grün:

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run export:web
```

## 28. Relevante Randinfos und Grenzen

### 28.1 `selectFairSport` ist Legacy

Es gibt noch Tests und Code für `selectFairSport`.

Nicht verwechseln:

- Alt: abstrakte Sportart auswählen.
- Neu: konkrete Fairness-Constellation aus Profilen auswählen.

Der aktuelle Service `decisions.ts` nutzt `selectFairConstellation`.

### 28.2 No-Go ist persönlich, nicht global

Ein No-Go bedeutet:

- diese Person wird nicht dieser Sportart zugeordnet,
- Kandidat bekommt Strafe, wenn die Person ohne Alternative bleibt.

Ein No-Go blockiert nicht automatisch die Sportart für alle.

Wenn künftig "ein No-Go darf Sportart nie gewinnen, wenn betroffene Person teilnimmt" gewünscht ist, muss `scoreNoGoPressure` oder die Kandidatengenerierung angepasst werden.

### 28.3 Mehr als zwei Aktivitäten noch nicht wirklich implementiert

`maxActivities` existiert, aber Kandidatengenerierung baut nur:

- Singles
- Paare

Für drei parallele Aktivitäten braucht es neue Kombinatorik und neue Assignment-Logik.

### 28.4 Winddaten werden geladen, aber nicht bewertet

Open-Meteo liefert:

- `wind_speed_10m`
- `wind_gusts_10m`

Aber `scoreWeather` nutzt Wind aktuell nicht.

Migration `028_remove_wind_weather_rules.sql` entfernt gespeicherte Wind-Regeln.

### 28.5 `twinScoreRatio` ist missverständlich benannt

Option heißt `twinScoreRatio`, wird aber nicht als Ratio, sondern als absoluter Score-Vorteil verwendet:

```ts
twinScoreGap >= options.twinScoreRatio
```

Das sollte bei Weiterentwicklung umbenannt oder geändert werden.

### 28.6 M:N-Profile können gleiche Profil-ID in zwei Aktivitäten erzeugen

Wenn dasselbe Standortprofil mit zwei Sportarten verknüpft ist, kann der Algorithmus zwei virtuelle Profile mit derselben physischen Profil-ID betrachten.

Das ist für "gleicher Standort, mehrere Sportarten" gewollt.

Aber es gibt noch keine harte Ressourcen-/Flächen-Kollisionslogik. Beispiel:

- Basketball und Fußball am exakt gleichen kleinen Platz könnten beide gewählt werden, obwohl sie sich real ausschließen.

Für später wäre ein Feld wie `resource_group_key`, `exclusive_resource`, `parallel_capacity` sinnvoll.

### 28.7 Kapazität ist pro Aktivität, nicht für gemeinsamen Ort

`minimum_group_size` und `maximum_group_size` werden je Aktivität geprüft.

Es gibt keine Gesamtstandortkapazität über mehrere Aktivitäten hinweg.

### 28.8 Kosten sind nur leichter Malus

`costNote` erzeugt aktuell nur `-0.04`.

Es gibt keine echte Kostenskala:

- kostenlos
- 2 EUR
- 30 EUR

wird algorithmisch gleich behandelt, sofern nur Text in `cost_note` steht.

Wenn Kosten wichtig werden, braucht es strukturierte Felder:

- `cost_required boolean`
- `cost_per_person numeric`
- eventuell `cost_currency`
- Kostengewicht in Practicality.

### 28.9 AP-Pflicht ist weich

Wenn `apRequired` true und AP fehlt:

```text
-0.18
```

Das ist kein harter Ausschluss.

Wenn für bestimmte Profile AP zwingend sein soll, muss das in `scoreBasePracticality` oder Profilfilterung geändert werden.

### 28.10 Wetter-Gewitter ist harter Ausschluss nur bei Outdoor/Non-Indoor

Indoor wird vor Gewitterprüfung direkt als wetterstabil bewertet.

Outdoor mit `thunderstormUnsafe !== false` und `weatherCode >= 95` wird ausgeschlossen.

### 28.11 Fehlende Koordinaten

Outdoor ohne Koordinaten:

- Wetterbewertung `-0.35`
- Practicality zusätzlich `-0.12`

Aber kein harter Ausschluss.

### 28.12 Fairness kann innerhalb Score-Fenster überstimmen

Fairness gewinnt nicht immer.

Sie gewinnt nur, wenn:

- Fairnessvorteil groß genug,
- Score-Abstand nicht zu groß.

Damit bleibt der Algorithmus ein Kompromiss aus Mehrheit, Minderheitenschutz und Praktikabilität.

### 28.13 Single hat starken Togetherness-Vorteil

Single bekommt:

- Togetherness `+1.4`
- ModeBonus `+0.3`

Das heißt Single ist klar bevorzugt, solange keine faire/praktische Zweigruppenlösung deutlich besser ist.

### 28.14 Multi-Sport ist bevorzugt gegenüber Twin

Multi-Sport bekommt:

- Togetherness bis `+1.25`
- ModeBonus `+0.15`

Twin bekommt:

- Togetherness `-0.55`
- kein ModeBonus

Twin gewinnt nur bei echter Fairness- oder Score-Notwendigkeit.

### 28.15 Recent Selection nutzt primär `weekly_events.selected_sport_id`

Rotation schaut auf vergangene Events mit `selected_sport_id`.

Bei Multi/Twin wird zwar `secondary_sport_id` gespeichert, aber `fetchRecentSelections` lädt aktuell nur `selected_sport_id` plus Kategorie.

Das bedeutet:

- Rotation berücksichtigt zuverlässig die Hauptsportart.
- Sekundäre Sportarten früherer Multi/Twin-Events sind für Kategorie-Rotation weniger sichtbar.

Mögliche Weiterentwicklung:

- `event_activities` der letzten Events für Rotation laden.
- `role` in `RecentSelection` wirklich nutzen.

### 28.16 Preference History betrachtet alle Votes, nicht nur Gewinner

Nach Finalisierung werden alle relevanten Votes geschrieben.

Covered ist true, wenn die Sportart in irgendeiner Aktivität vorkommt.

Bei Multi/Twin wird also auch eine Nebenaktivität als abgedeckt gezählt.

### 28.17 Reliability hängt von AP-Nachbereitung ab

Ohne gepflegte `actual_status` bleibt Reliability weitgehend wirkungslos.

Die AP-Nachbereitung ist daher fachlich wichtig, wenn No-Shows langfristig Einfluss haben sollen.

## 29. Wichtige Stellen für Weiterentwicklung

### 29.1 Mehr als zwei Aktivitäten

Betroffene Funktionen:

- `selectFairConstellation`
- `rankSportIds`
- `chooseBestProfilePair`
- `assignUsersToSports`
- `scoreMinorityProtection`
- `compareTogethernessPreference`
- `replaceEventActivitiesFromDecision`
- UI für Chat/Subchats/Decision

### 29.2 Ressourcen-/Standortkonflikte

Neue Profilfelder denkbar:

- `resource_group_key`
- `parallel_capacity`
- `exclusive_when_selected`
- `surface_type`
- `requires_reservation_slot`

Dann Kandidaten filtern oder Praktikabilität bestrafen.

### 29.3 Strukturierte Kosten

Neue Felder:

- `cost_required`
- `cost_per_person`
- `cost_currency`
- `cost_note`

Dann Practicality differenzieren.

### 29.4 Bessere AP-Logik

Aktuell:

- Profil-AP bevorzugt.
- Sonst zugewiesener User.
- Sonst bester Voter.
- Sonst erster `going`.

Mögliche Erweiterung:

- AP-Rollen
- Bereitschaft als AP
- AP-Rotation
- AP-Zuverlässigkeit
- maximal eine AP-Rolle pro Event

### 29.5 Wetter verbessern

Mögliche Felder:

- `prefersWarm`
- `prefersCold`
- `maxWindKmh`
- `windSensitive`
- `requiresSunlight`
- `heatIndexSensitive`

Aktuell sind `prefersWarm`/`prefersCold` in UI-Ideen teils als Rules angedeutet, werden aber im Algorithmus nicht direkt genutzt. Algorithmus nutzt nur `heatSensitive` und `coldSensitive`.

### 29.6 Fairness transparenter machen

Aktuell ScoreBreakdown enthält nur Summen.

Für bessere Erklärung könnten ergänzt werden:

- Fairness Debt pro User
- welche User dadurch abgedeckt wurden
- welche Wochen ignoriert waren
- warum Twin/Multi Single geschlagen hat

### 29.7 No-Go-Erklärung

Aktuell `excludedProfiles` enthält nur Profil-/Wetter-Ausschlüsse.

No-Go-Konflikte erscheinen nicht als eigene Explainability-Struktur.

Mögliche Erweiterung:

- `noGoConflicts`
- `usersProtectedByAlternative`
- `noGoPenaltyBreakdown`

### 29.8 Deterministische Wettertests/Preview

Tests mocken Weather Snapshot direkt im Input.

Für Service-Tests kann `fetchEventWeatherSnapshot` mit Fetch-Mock getestet werden.

Produktiv sollte finalisierter Snapshot immer gespeichert werden, damit Entscheidungen später erklärbar bleiben.

## 30. Minimaler Pseudocode

```text
function selectFairConstellation(input):
  options = defaults + overrides
  proposedSportIds = proposals.sportId
  activeProfiles = profiles where active and sportId proposed
  attendanceByUser = map attendance
  noGoUsersBySport = group noGos

  eligibleVotes = votes where:
    sport proposed
    user going/maybe
    user has no No-Go for sport

  if no eligible votes:
    return none

  fairnessDebtByUser = calculateFairnessDebt(history)
  reliabilityPenaltyByUser = calculateReliabilityPenalties(history, attendance)
  profileEvaluations = evaluateProfiles(activeProfiles, weather)
  profilesBySport = nonExcluded profileEvaluations grouped by sportId

  candidates = []

  for sport in votedSports:
    profile = best profile for sport
    if profile:
      candidates.add(single candidate)

  rankedSports = rank by supportScore

  for each pair of rankedSports:
    profilePair = best profile pair
    if no profilePair: continue

    proximity = same_spot/social_radius/split_location/unknown
    if second group not meaningful: continue

    if proximity same_spot or social_radius:
      candidates.add(multi_sport candidate)

    twin = build twin candidate
    if twin participation high enough:
      candidates.add(twin)

  sort candidates by:
    fairness override
    twin/togetherness preference
    finalScore
    type priority
    id

  return first candidate as decision
```

## 31. Copy-Paste-Kern für Weiterentwicklung

Wenn ein anderer Chat den Algorithmus weiterentwickeln soll, sollte er mindestens diese Dateien lesen:

1. `src/lib/fairConstellationSelection.ts`
2. `src/services/decisions.ts`
3. `src/services/sportProfiles.ts`
4. `src/services/weather.ts`
5. `src/services/eventActivities.ts`
6. `src/lib/decisionPresentation.ts`
7. `tests/fairConstellationSelection.test.ts`
8. `supabase/migrations/024_fairness_first_constellation.sql`
9. `supabase/migrations/031_sport_profile_sports_and_sport_active.sql`

Und diese fachlichen Regeln nicht brechen:

- Nutzer stimmen auf abstrakte Sportarten, nicht Profile.
- Profile sind konkrete Varianten.
- Sportprofil-M:N wird im Service-Layer auf einzelne `sportId`-Profile expandiert.
- `not_going` zählt nicht.
- `maybe` zählt mit `0.55`.
- No-Go ist persönliche Akzeptanz, kein normales Downvote.
- Single und Multi-Sport werden gegenüber Twin bevorzugt, solange Fairness nicht klar dagegen spricht.
- Wetter kann Outdoor-Profile hart ausschließen.
- Rotation ist ein Malus, kein Ausschluss.
- Reliability reduziert Einfluss, entfernt User aber nicht.
- Finale Entscheidung muss in `event_activities` und `weekly_events` persistiert werden.

## 32. Glossar

- **Sportart**: abstrakte Sportart, z. B. Beachvolleyball.
- **Sportprofil**: konkrete Ausprägung, z. B. Beachvolleyball am Hörnle.
- **Single**: eine Aktivität.
- **Multi-Sport**: zwei Aktivitäten nah genug für ein gemeinsames Event.
- **Twin**: zwei getrennte Aktivitäten/Gruppen.
- **Fairness Debt**: Ausgleich für wiederholt ignorierte Wünsche.
- **Reliability Penalty**: leichte Reduktion des Einflusses bei wiederholten No-Shows.
- **No-Go**: persönliche Nicht-Akzeptanz einer Sportart.
- **Togetherness**: Score-Komponente, die gemeinsame Club-Erlebnisse bevorzugt.
- **Practicality**: Machbarkeit durch AP, Ausstattung, Anreise, Öffnungszeiten, Kosten, Reservierung.
- **Weather Snapshot**: pro Profil gespeicherte Wetterdaten zur Eventzeit.

