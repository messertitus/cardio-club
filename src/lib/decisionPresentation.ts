import type { CandidateScore, FairConstellationDecision, ScoreBreakdown } from "./fairConstellationSelection";

export type SportNameMap = Map<string, string>;

export type DecisionPresentation = {
  selectedSportName: string;
  secondarySportName?: string;
  resultLabels: string[];
  simpleExplanation: string;
  activityRows: Array<{
    sportId: string;
    sportName: string;
    profileId: string;
    profileName: string;
    locationName?: string | null;
    participantCount: number;
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
    rotation: number;
    verlaesslichkeit: number;
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
    resultLabels: getResultLabels(decision),
    simpleExplanation: getSimpleExplanation(decision, winner, sportNames),
    activityRows: decision.activities.map((activity) => ({
      sportId: activity.sportId,
      sportName: nameForSport(activity.sportId, sportNames),
      profileId: activity.profileId,
      profileName: activity.profileName,
      locationName: activity.locationName,
      participantCount: activity.participantCount,
    })),
    scoreRows: decision.scores.map((score) => mapScoreRow(score, sportNames)),
  };
}

function getResultLabels(decision: FairConstellationDecision): string[] {
  if (decision.mode === "none") {
    return ["Keine Entscheidung"];
  }

  const labels: string[] = [modeLabel(decision.mode)];
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

  return labels;
}

function getSimpleExplanation(
  decision: FairConstellationDecision,
  winner: CandidateScore | undefined,
  sportNames: SportNameMap,
): string {
  if (decision.mode === "none") {
    return decision.reason || "Es gibt noch keine Entscheidung, weil keine machbare Konstellation gefunden wurde.";
  }

  if (!winner) {
    return decision.reason;
  }

  const first = activityLabel(decision.activities[0], sportNames) ?? "Die erste Aktivität";
  const second = activityLabel(decision.activities[1], sportNames);
  const fairnessActive = winner.scoreBreakdown.fairness + winner.scoreBreakdown.minorityProtection > 0.7;
  const weatherActive = winner.scoreBreakdown.weather < 0;

  if (decision.mode === "single") {
    return `${first} wurde als Single Event gewählt, weil Zustimmung, Fairness, Wetter und Machbarkeit insgesamt am besten passen.`;
  }

  if (decision.mode === "multi_sport" && second) {
    return `${first} und ${second} wurden als Multi-Sport Event gewählt, weil beide Wünsche sinnvoll sichtbar werden und die Profile nah genug für ein gemeinsames Event liegen.`;
  }

  if (decision.mode === "twin" && second) {
    return `${first} und ${second} wurden als Twin Event gewählt, weil zwei echte Gruppen entstanden sind und diese Lösung fairer ist als eine Gruppe zu ignorieren.`;
  }

  if (fairnessActive) {
    return `${first} wurde gewählt, weil der Fairness-Ausgleich mehrere zuletzt übergangene Wünsche berücksichtigt.`;
  }

  if (weatherActive) {
    return `${first} wurde gewählt, obwohl Wetterfaktoren abgewogen werden mussten.`;
  }

  return decision.reason;
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
    rotation: breakdown.rotation,
    verlaesslichkeit: breakdown.reliability,
    gesamt: score.finalScore,
  };
}

function activityLabel(
  activity: FairConstellationDecision["activities"][number] | undefined,
  sportNames: SportNameMap,
): string | undefined {
  if (!activity) {
    return undefined;
  }

  const sportName = nameForSport(activity.sportId, sportNames);
  return `${sportName} · ${activity.profileName}`;
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
