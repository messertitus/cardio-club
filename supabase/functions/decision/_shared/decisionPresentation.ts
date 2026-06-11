import type { CandidateScore, FairConstellationDecision } from "./algorithm.ts";

export type SportNameMap = Map<string, string>;

export type DecisionPresentation = {
  selectedSportName: string;
  secondarySportName?: string;
  decisionCharacter: FairConstellationDecision["decisionCharacter"];
  decisionCharacterLabel: string;
  resultLabels: string[];
  simpleExplanation: string;
  multiSportExplanation?: string;
  noGoSummary?: string;
  losingCandidateSummaries: string[];
  activityRows: Array<{
    sportId: string;
    sportName: string;
    role: "primary" | "secondary";
    profileId: string;
    profileName: string;
    locationName?: string | null;
    participantCount: number;
    activityContactId?: string | null;
    weatherNotes: string[];
    practicalityNotes: string[];
  }>;
  scoreRows: Array<{
    id: string;
    label: string;
    eventTyp: string;
    teilnahme: number;
    stimmen: number;
    fairnessAusgleich: number;
    minderheitenschutz: number;
    togetherness: number;
    wetter: number;
    machbarkeit: number;
    standortKapazitaet: number;
    kosten: number;
    rotation: number;
    verlaesslichkeit: number;
    noGoDruck: number;
    modusBonus: number;
    gesamt: number;
  }>;
};

export function buildDecisionPresentation(
  decision: FairConstellationDecision,
  sportNames: SportNameMap,
): DecisionPresentation {
  const winner = decision.scores[0];

  return {
    selectedSportName: activityLabel(decision.activities[0], sportNames) ?? nameForSport(decision.selectedSportId, sportNames),
    secondarySportName: decision.activities[1]
      ? activityLabel(decision.activities[1], sportNames)
      : decision.secondarySportId
        ? nameForSport(decision.secondarySportId, sportNames)
        : undefined,
    decisionCharacter: decision.decisionCharacter,
    decisionCharacterLabel: characterLabel(decision.decisionCharacter),
    resultLabels: getResultLabels(decision),
    simpleExplanation: getSimpleExplanation(decision, winner, sportNames),
    multiSportExplanation: getMultiSportExplanation(decision, sportNames),
    noGoSummary: summarizeNoGos(decision.noGoBreakdown, sportNames),
    losingCandidateSummaries: decision.losingCandidateReasons.slice(0, 3).map((reason) => summarizeLosingCandidate(reason, sportNames)),
    activityRows: decision.activities.map((activity) => ({
      sportId: activity.sportId,
      sportName: nameForSport(activity.sportId, sportNames),
      role: activity.role,
      profileId: activity.profileId,
      profileName: activity.profileName,
      locationName: activity.locationName,
      participantCount: activity.participantCount,
      activityContactId: activity.activityContactId,
      weatherNotes: activity.weatherNotes ?? [],
      practicalityNotes: activity.practicalityNotes ?? [],
    })),
    scoreRows: decision.scores.map((score) => mapScoreRow(score, sportNames)),
  };
}

function getResultLabels(decision: FairConstellationDecision): string[] {
  if (decision.mode === "none") {
    return ["Keine Entscheidung"];
  }

  const labels: string[] = [modeLabel(decision.mode), characterLabel(decision.decisionCharacter)];
  const breakdown = decision.scoreBreakdown;

  if (breakdown && breakdown.fairness + breakdown.minorityProtection > 0.7) {
    labels.push("Fairness-Ausgleich");
  }

  if (breakdown && breakdown.togetherness > 0.8) {
    labels.push("Gemeinsames Club-Event");
  }

  if (breakdown && breakdown.weather < 0) {
    labels.push("Wetter abgewogen");
  }

  return [...new Set(labels)];
}

function getSimpleExplanation(
  decision: FairConstellationDecision,
  winner: CandidateScore | undefined,
  sportNames: SportNameMap,
): string {
  if (decision.mode === "none") {
    return decision.reason || "Es gibt noch keine Entscheidung, weil aktuell keine machbare Konstellation gefunden wurde.";
  }

  if (!winner) {
    return decision.reason;
  }

  const first = nameForSport(decision.activities[0]?.sportId ?? decision.selectedSportId, sportNames);
  const second = decision.activities[1] ? nameForSport(decision.activities[1].sportId, sportNames) : undefined;
  const fairnessActive = winner.scoreBreakdown.fairness + winner.scoreBreakdown.minorityProtection > 0.7;
  const weatherActive = winner.scoreBreakdown.weather < 0;

  if (decision.decisionCharacter === "majority_protected") {
    return `${first} hatte eine klare aktuelle Mehrheit. Fairness wurde geprüft, aber die Unterstützung war eindeutig genug.`;
  }

  if (decision.decisionCharacter === "fairness_adjusted") {
    return `${first} wurde gewählt, weil es aktuelle Unterstützung und zugleich einen relevanten Fairness-Ausgleich gab.`;
  }

  if (decision.decisionCharacter === "weather_adjusted") {
    return `${first} passt insgesamt am besten. Outdoor-Profile mit Wetterrisiko wurden dabei zurückhaltender bewertet oder ausgeschlossen.`;
  }

  if (decision.decisionCharacter === "fallback") {
    return `${first} ist der beste verfügbare Vorschlag, obwohl die Datenlage noch dünn ist. So bekommen kleine Gruppen trotzdem eine nutzbare Entscheidung.`;
  }

  if (decision.mode === "single") {
    return `${first} wurde als Single Event gewählt, weil Zustimmung, Fairness, Wetter und Machbarkeit insgesamt am besten passen.`;
  }

  if (decision.mode === "multi_sport" && second) {
    return `${first} ist diese Woche die Hauptaktivität. ${second} wird ergänzt, weil es ebenfalls Unterstützung hatte und gut zum gemeinsamen Event passt.`;
  }

  if (decision.mode === "twin" && second) {
    return `${first} und ${second} werden als getrennte Gruppen vorgeschlagen, weil die Unterstützung klar geteilt ist.`;
  }

  if (fairnessActive) {
    return `${first} wurde gewählt, weil der Fairness-Ausgleich zuletzt übergangene Wünsche berücksichtigt.`;
  }

  if (weatherActive) {
    return `${first} wurde gewählt, obwohl Wetterfaktoren abgewogen werden mussten.`;
  }

  return decision.reason;
}

function getMultiSportExplanation(decision: FairConstellationDecision, sportNames: SportNameMap): string | undefined {
  if (decision.mode !== "multi_sport" && decision.mode !== "twin") {
    return undefined;
  }

  const primary = decision.activities.find((activity) => activity.role === "primary") ?? decision.activities[0];
  const secondary = decision.activities.find((activity) => activity.role === "secondary") ?? decision.activities[1];
  if (!primary || !secondary) {
    return undefined;
  }

  const primaryName = nameForSport(primary.sportId, sportNames);
  const secondaryName = nameForSport(secondary.sportId, sportNames);
  const previousWeekSecondary = decision.explainability.rotationReasons.some(
    (reason) => reason.sportId === secondary.sportId && reason.isHardBlockedAsPrimary,
  );

  if (previousWeekSecondary) {
    return `${secondaryName} war letzte Woche bereits Hauptsportart und kann deshalb nicht erneut Hauptaktivität werden. Es bleibt aber als zweite Aktivität möglich.`;
  }

  if (decision.mode === "twin") {
    return `${primaryName} und ${secondaryName} bilden zwei echte Gruppen. So muss keine klare Teilgruppe ignoriert werden.`;
  }

  return `${primaryName} ist die Hauptaktivität. ${secondaryName} wird ergänzt, weil es ebenfalls Unterstützung hatte und das Standortprofil zu einem gemeinsamen Event passt.`;
}

function mapScoreRow(score: CandidateScore, sportNames: SportNameMap) {
  const breakdown = score.scoreBreakdown;
  return {
    id: score.id,
    label: score.activities.map((activity) => activityLabel(activity, sportNames)).join(" + "),
    eventTyp: modeLabel(score.mode),
    teilnahme: breakdown.participation,
    stimmen: breakdown.preference,
    fairnessAusgleich: breakdown.fairness,
    minderheitenschutz: breakdown.minorityProtection,
    togetherness: breakdown.togetherness,
    wetter: breakdown.weather,
    machbarkeit: breakdown.practicality,
    standortKapazitaet: breakdown.locationCapacity,
    kosten: breakdown.cost,
    rotation: breakdown.rotation,
    verlaesslichkeit: breakdown.reliability,
    noGoDruck: breakdown.noGoPressure,
    modusBonus: breakdown.modeBonus,
    gesamt: score.finalScore,
  };
}

function summarizeLosingCandidate(
  reason: FairConstellationDecision["losingCandidateReasons"][number],
  sportNames: SportNameMap,
): string {
  const sports = reason.sportIds.map((sportId) => nameForSport(sportId, sportNames)).join(" + ");
  const readableReasons = [...new Set(reason.keyReasons.map(toReadableLosingReason))].slice(0, 2);
  return `${sports}: ${readableReasons.join(" ") || "Andere Vorschläge passten diese Woche insgesamt besser."}`;
}

function summarizeNoGos(noGoBreakdown: FairConstellationDecision["noGoBreakdown"], sportNames: SportNameMap): string {
  const unresolved = noGoBreakdown.unresolved.length;
  const resolved = noGoBreakdown.resolvedByAlternative.length;

  if (unresolved === 0 && resolved === 0) {
    return "Keine No-Go-Konflikte.";
  }

  const parts: string[] = [];
  if (resolved > 0) {
    parts.push(`${countLabel(resolved, "No-Go wurde", "No-Gos wurden")} durch eine alternative Aktivität berücksichtigt.`);
  }
  if (unresolved > 0) {
    const affectedSports = [
      ...new Set(noGoBreakdown.unresolved.map((entry) => entry.sportName ?? nameForSport(entry.sportId, sportNames))),
    ].slice(0, 2);
    parts.push(
      `${countLabel(unresolved, "No-Go bleibt", "No-Gos bleiben")} offen; betroffene Personen werden nicht passend zu ${affectedSports.join(" oder ")} zugeordnet.`,
    );
  }
  return parts.join(" ");
}

function toReadableLosingReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("vorwoche") || lower.includes("last week") || lower.includes("previous") || lower.includes("hauptsport")) {
    return "Diese Sportart war zuletzt Hauptaktivität und war deshalb als Hauptwahl eingeschränkt.";
  }
  if (lower.includes("weather") || lower.includes("wetter") || lower.includes("wind") || lower.includes("regen")) {
    return "Wetterrisiken sprachen gegen diese Option.";
  }
  if (lower.includes("no-go") || lower.includes("no go")) {
    return "Es gab mehr No-Go-Druck als bei der gewählten Lösung.";
  }
  if (lower.includes("capacity") || lower.includes("kapaz") || lower.includes("minimum") || lower.includes("maximum")) {
    return "Die Standortkapazität passte schlechter zur erwarteten Gruppe.";
  }
  if (lower.includes("cost") || lower.includes("kosten")) {
    return "Kosten oder organisatorische Hürden sprachen eher dagegen.";
  }
  if (lower.includes("fairness")) {
    return "Der Fairness-Ausgleich war geringer als bei der gewählten Lösung.";
  }
  if (lower.includes("support") || lower.includes("unterstuetzung") || lower.includes("unterstützung") || lower.includes("vote") || lower.includes("stimme")) {
    return "Es gab weniger aktuelle Unterstützung.";
  }
  return stripScoreDetails(reason);
}

function stripScoreDetails(reason: string): string {
  return reason.replace(/\b-?\d+([.,]\d+)?\b/g, "").replace(/\s+/g, " ").trim();
}

function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `Ein ${singular}` : `${count} ${plural}`;
}

function characterLabel(character: FairConstellationDecision["decisionCharacter"]): string {
  if (character === "clear_majority") return "Klare Mehrheit";
  if (character === "fairness_adjusted") return "Fairness-Ausgleich";
  if (character === "majority_protected") return "Mehrheitsschutz";
  if (character === "practicality_adjusted") return "Machbarkeit abgewogen";
  if (character === "weather_adjusted") return "Wetter abgewogen";
  if (character === "combined_event") return "Kombiniertes Event";
  if (character === "split_groups") return "Getrennte Gruppen";
  if (character === "fallback") return "Fallback";
  return "Keine Entscheidung";
}

function activityLabel(
  activity: FairConstellationDecision["activities"][number] | undefined,
  sportNames: SportNameMap,
): string | undefined {
  if (!activity) {
    return undefined;
  }

  const sportName = nameForSport(activity.sportId, sportNames);
  // The profile name often already contains the sport (e.g. "Schwimmen: Herosee").
  // Prefer the bare location so the label does not repeat the sport.
  const place = activity.locationName ?? stripSportPrefix(activity.profileName, sportName);
  return `${sportName} · ${place}`;
}

function stripSportPrefix(profileName: string, sportName: string): string {
  const prefix = `${sportName}:`;
  if (profileName.toLowerCase().startsWith(prefix.toLowerCase())) {
    return profileName.slice(prefix.length).trim() || profileName;
  }
  return profileName;
}

function nameForSport(sportId: string | undefined, sportNames: SportNameMap): string {
  if (!sportId) {
    return "Noch offen";
  }

  return sportNames.get(sportId) ?? sportId;
}

function modeLabel(mode: FairConstellationDecision["mode"]): string {
  if (mode === "multi_sport") return "Multi-Sport";
  if (mode === "twin") return "Twin Event";
  if (mode === "single") return "Single Event";
  return "Keine Entscheidung";
}
