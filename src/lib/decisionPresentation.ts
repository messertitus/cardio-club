import type { FairSportSelectionResult, SportScore } from "./fairSportSelection";

export type SportNameMap = Map<string, string>;

export type DecisionPresentation = {
  selectedSportName: string;
  secondarySportName?: string;
  resultLabels: string[];
  simpleExplanation: string;
  scoreRows: Array<{
    sportId: string;
    sportName: string;
    stimmen: number;
    fairnessAusgleich: number;
    abwechslung: number;
    wiederholungsabzug: number;
  }>;
};

export function buildDecisionPresentation(
  decision: FairSportSelectionResult,
  sportNames: SportNameMap,
): DecisionPresentation {
  const winningScore = decision.selectedSportId
    ? decision.scores.find((score) => score.sportId === decision.selectedSportId)
    : undefined;
  const runnerUp = decision.secondarySportId
    ? decision.scores.find((score) => score.sportId === decision.secondarySportId)
    : decision.scores[1];

  return {
    selectedSportName: nameForSport(decision.selectedSportId, sportNames),
    secondarySportName: decision.secondarySportId ? nameForSport(decision.secondarySportId, sportNames) : undefined,
    resultLabels: getResultLabels(decision, winningScore),
    simpleExplanation: getSimpleExplanation(decision, sportNames, winningScore, runnerUp),
    scoreRows: decision.scores.map((score) => mapScoreRow(score, sportNames)),
  };
}

function getResultLabels(decision: FairSportSelectionResult, winningScore?: SportScore): string[] {
  if (decision.mode === "none") {
    return ["Keine Entscheidung"];
  }

  const labels: string[] = [];

  if (decision.mode === "combined") {
    labels.push("Gemeinsamer Cardiotag");
  }

  if (decision.mode === "subgroups") {
    labels.push("Untergruppen");
  }

  if (isFairnessAdjusted(decision, winningScore)) {
    labels.push("Fairness-Ausgleich");
  }

  if (isMajorityBased(decision, winningScore)) {
    labels.push("Mehrheit");
  }

  if (labels.length === 0) {
    labels.push("Ausgewogen entschieden");
  }

  return labels;
}

function getSimpleExplanation(
  decision: FairSportSelectionResult,
  sportNames: SportNameMap,
  winningScore?: SportScore,
  runnerUp?: SportScore,
): string {
  if (decision.mode === "none") {
    return "Es gibt noch keine Entscheidung, weil keine vorgeschlagene Sportart eine Stimme hat.";
  }

  const selected = nameForSport(decision.selectedSportId, sportNames);
  const second = nameForSport(decision.secondarySportId, sportNames);

  if (decision.mode === "combined" && decision.secondarySportId) {
    return `${selected} wurde ausgewählt. ${second} passt gut dazu und hatte ebenfalls starken Rückhalt, deshalb empfiehlt die App einen gemeinsamen Cardiotag.`;
  }

  if (decision.mode === "subgroups" && decision.secondarySportId) {
    return `${selected} liegt vorne. ${second} hat ebenfalls starken Rückhalt, passt aber nicht gut als ein gemeinsames Event dazu. Deshalb empfiehlt die App Untergruppen.`;
  }

  if (isFairnessAdjusted(decision, winningScore)) {
    return `${selected} wurde ausgewählt, weil mehrere Mitglieder mit dieser Präferenz in den letzten Wochen nicht berücksichtigt wurden.`;
  }

  if (isMajorityBased(decision, winningScore)) {
    return `${selected} hatte die meisten Stimmen. Die Sportart von letzter Woche wurde automatisch ausgeschlossen.`;
  }

  if (runnerUp) {
    return `${selected} wurde ausgewählt, weil es insgesamt am besten zu den Stimmen und zur Abwechslung der letzten Wochen passt.`;
  }

  return `${selected} wurde ausgewählt.`;
}

function isMajorityBased(decision: FairSportSelectionResult, winningScore?: SportScore): boolean {
  if (!winningScore || decision.mode === "none") {
    return false;
  }

  return decision.scores.every((score) => winningScore.baseVoteScore >= score.baseVoteScore);
}

function isFairnessAdjusted(decision: FairSportSelectionResult, winningScore?: SportScore): boolean {
  if (!winningScore || decision.mode === "none" || winningScore.fairnessScore <= 0) {
    return false;
  }

  return decision.scores.some((score) => score.baseVoteScore > winningScore.baseVoteScore);
}

function mapScoreRow(score: SportScore, sportNames: SportNameMap) {
  return {
    sportId: score.sportId,
    sportName: nameForSport(score.sportId, sportNames),
    stimmen: score.baseVoteScore,
    fairnessAusgleich: score.fairnessScore,
    abwechslung: score.diversityScore,
    wiederholungsabzug: score.repetitionPenalty,
  };
}

function nameForSport(sportId: string | undefined, sportNames: SportNameMap): string {
  if (!sportId) {
    return "Noch offen";
  }

  return sportNames.get(sportId) ?? sportId;
}
