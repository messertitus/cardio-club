# Copy-Paste-Prompt für Algorithmus-Weiterentwicklung

Du entwickelst den Fairness-First Constellation Algorithmus in einem React Native / Expo / Supabase Projekt weiter.

Bitte lies zuerst diese Dateien:

- `src/lib/fairConstellationSelection.ts`
- `src/services/decisions.ts`
- `src/services/sportProfiles.ts`
- `src/services/weather.ts`
- `src/services/eventActivities.ts`
- `src/lib/decisionPresentation.ts`
- `tests/fairConstellationSelection.test.ts`
- `supabase/migrations/024_fairness_first_constellation.sql`
- `supabase/migrations/031_sport_profile_sports_and_sport_active.sql`
- zusätzlich `docs/fairness-first-algorithmus-handoff.md`

Der produktive Algorithmus ist `selectFairConstellation`, nicht das Legacy-`selectFairSport`.

Fachmodell:

- Nutzer stimmen auf abstrakte Sportarten ab.
- Der Algorithmus wählt konkrete `sport_profiles`.
- Ergebnis ist `single`, `multi_sport`, `twin` oder `none`.
- Sportprofile können mit mehreren Sportarten verknüpft sein; `listSportProfilesForSports` expandiert diese M:N-Beziehung für den Algorithmus auf einzelne virtuelle Profile mit jeweiligem `sportId`.
- `not_going` zählt nicht.
- `maybe` zählt mit Faktor `0.55`.
- No-Go ist persönliche Nicht-Akzeptanz, kein normales Downvote.
- No-Go verhindert persönliche Zuordnung und erzeugt einen starken Penalty, wenn keine Alternative entsteht.
- Fairness Debt hebt wiederholt ignorierte Stimmen.
- Reliability Penalty reduziert wiederholte No-Show-Einflüsse.
- Wetter kann Outdoor-Profile hart ausschließen, Indoor bleibt wetterstabil.
- Rotation ist ein Malus, kein Ausschluss.
- Single und Multi-Sport werden gegenüber Twin bevorzugt, solange Twin nicht klar fairer oder besser ist.

Wichtige Defaults:

```ts
maybeParticipationWeight: 0.55
neglectBoostPerWeek: 0.35
maxFairnessDebt: 2
noGoPenalty: 2.5
minSecondaryVoteScore: 1.2
strongSecondaryVoteRatio: 0.32
fairnessFirstMargin: 0.45
fairnessOverrideWindow: 2.2
twinFairnessMargin: 0.7
socialRadiusKm: 0.75
sameSpotRadiusKm: 0.12
previousPrimaryPenalty: 0.85
recentCategoryPenalty: 0.35
reliabilityPenaltyPerNoShow: 0.12
maxReliabilityPenalty: 0.45
```

Bekannte Grenzen:

- Maximal zwei Aktivitäten sind algorithmisch implementiert.
- Winddaten werden geladen, aber nicht bewertet.
- `twinScoreRatio` ist missverständlich benannt und wird als absoluter Score-Gap genutzt.
- Es gibt noch keine Ressourcen-/Flächenkonfliktlogik für zwei Sportarten am selben physischen Standort.
- Kosten sind aktuell nur ein Textfeld und nur ein sehr leichter Practicality-Malus.
- AP-Pflicht ist weich, kein harter Ausschluss.
- Rotation betrachtet primär `selected_sport_id`; sekundäre Aktivitäten vergangener Multi/Twin-Events sind noch nicht vollständig in Rotation abgebildet.

Bitte ändere den Algorithmus nur mit passenden Tests in `tests/fairConstellationSelection.test.ts` und prüfe danach:

```bash
npm.cmd run typecheck
npm.cmd test
npm.cmd run export:web
```

