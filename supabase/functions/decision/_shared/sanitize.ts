// SERVER-ONLY. Turns the raw FairConstellationDecision (which contains every
// secret internal: per-candidate scoreBreakdown, finalScore, ranking margins,
// fairnessDebt, weighted vote scores, candidate ids, no-go penalty mechanics)
// into the sanitized DecisionView that is the ONLY decision payload the client
// ever receives.
//
// The DecisionView type below is mirrored verbatim in src/lib/decisionView.ts on
// the frontend. Keep the two shapes in sync — they are the public contract.
import { buildDecisionPresentation, type SportNameMap } from "./decisionPresentation.ts";
import type { ConstellationMode, DecisionCharacter, FairConstellationDecision } from "./algorithm.ts";

export type DecisionViewActivity = {
  sportId: string;
  sportName: string;
  profileId: string;
  profileName: string;
  locationName?: string | null;
  role: "primary" | "secondary";
  participantCount: number;
  activityContactId?: string | null;
  weatherNotes: string[];
  practicalityNotes: string[];
};

// Only a relative percentage vs. the strongest option — never the 14 raw score
// dimensions, the absolute finalScore, or the gap-to-winner.
export type DecisionScoreRow = {
  id: string;
  label: string;
  eventTyp: string;
  relativePercent: number;
};

// Full per-candidate score breakdown — admin-only, for transparency during the
// test phase. These are the computed scores for THIS event (not the algorithm's
// weight constants), delivered only to authenticated admins, never to normal
// users and never in the client bundle.
export type AdminScoreRow = {
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
};

// Product-near admin explainability: summaries plus (for the test phase) the full
// per-candidate scorecard. Admin-gated on the server.
export type DecisionAdminSummary = {
  voteSummaries: Array<{ sportName: string; voters: number }>;
  fairnessCovered: number;
  fairnessTotal: number;
  noGosResolved: number;
  noGosUnresolved: number;
  noGosIgnored: number;
  weatherNotes: string[];
  practicalNotes: string[];
  scoreRows: AdminScoreRow[];
};

// Per-viewer fairness flag — booleans only, never the raw fairnessDebt/ignoredWeeks.
export type ViewerFairness = {
  active: boolean;
  covered: boolean;
};

export type DecisionView = {
  mode: ConstellationMode;
  selectedSportId?: string;
  secondarySportId?: string;
  selectedProfileId?: string;
  secondaryProfileId?: string;
  decisionCharacter: DecisionCharacter;
  decisionCharacterLabel: string;
  selectedSportName: string;
  secondarySportName?: string;
  resultLabels: string[];
  simpleExplanation: string;
  multiSportExplanation?: string;
  noGoSummary?: string;
  losingCandidateSummaries: string[];
  activities: DecisionViewActivity[];
  scoreComparison: DecisionScoreRow[];
  viewerFairness?: ViewerFairness;
  admin?: DecisionAdminSummary;
  reason: string;
};

export function buildDecisionView(
  decision: FairConstellationDecision,
  sportNames: SportNameMap,
  opts: { isAdmin: boolean; userId?: string },
): DecisionView {
  const presentation = buildDecisionPresentation(decision, sportNames);

  const maxTotal = Math.max(0, ...presentation.scoreRows.map((row) => row.gesamt));
  const scoreComparison: DecisionScoreRow[] = presentation.scoreRows.slice(0, 5).map((row, index) => ({
    id: String(index),
    label: row.label,
    eventTyp: row.eventTyp,
    relativePercent: maxTotal > 0 ? Math.round((row.gesamt / maxTotal) * 100) : 0,
  }));

  return {
    mode: decision.mode,
    selectedSportId: decision.selectedSportId,
    secondarySportId: decision.secondarySportId,
    selectedProfileId: decision.selectedProfileId,
    secondaryProfileId: decision.secondaryProfileId,
    decisionCharacter: presentation.decisionCharacter,
    decisionCharacterLabel: presentation.decisionCharacterLabel,
    selectedSportName: presentation.selectedSportName,
    secondarySportName: presentation.secondarySportName,
    resultLabels: presentation.resultLabels,
    simpleExplanation: presentation.simpleExplanation,
    multiSportExplanation: presentation.multiSportExplanation,
    noGoSummary: presentation.noGoSummary,
    losingCandidateSummaries: presentation.losingCandidateSummaries,
    activities: presentation.activityRows.map((activity) => ({
      sportId: activity.sportId,
      sportName: activity.sportName,
      profileId: activity.profileId,
      profileName: activity.profileName,
      locationName: activity.locationName,
      role: activity.role,
      participantCount: activity.participantCount,
      activityContactId: activity.activityContactId,
      weatherNotes: activity.weatherNotes,
      practicalityNotes: activity.practicalityNotes,
    })),
    scoreComparison,
    viewerFairness: buildViewerFairness(decision, opts.userId),
    admin: opts.isAdmin ? buildAdminSummary(decision, sportNames, presentation.scoreRows) : undefined,
    reason: decision.reason,
  };
}

function buildViewerFairness(decision: FairConstellationDecision, userId?: string): ViewerFairness | undefined {
  if (!userId) return undefined;
  const entry = decision.explainability.fairnessByUser.find((row) => row.userId === userId);
  if (!entry) return undefined;
  return {
    active: entry.ignoredWeeks > 0 || entry.fairnessDebt > 0,
    covered: entry.coveredByDecision,
  };
}

function buildAdminSummary(
  decision: FairConstellationDecision,
  sportNames: SportNameMap,
  scoreRows: AdminScoreRow[],
): DecisionAdminSummary {
  const explain = decision.explainability;
  return {
    scoreRows,
    voteSummaries: explain.voteSummaryBySport.slice(0, 4).map((entry) => ({
      sportName: entry.sportName ?? sportNames.get(entry.sportId) ?? entry.sportId,
      voters: entry.uniqueVoters,
    })),
    fairnessCovered: explain.fairnessByUser.filter((entry) => entry.coveredByDecision).length,
    fairnessTotal: explain.fairnessByUser.length,
    noGosResolved: decision.noGoBreakdown.resolvedByAlternative.length,
    noGosUnresolved: decision.noGoBreakdown.unresolved.length,
    noGosIgnored: decision.noGoBreakdown.ignoredBecauseNotGoing.length,
    weatherNotes: explain.weatherReasons
      .filter((entry) => entry.excluded || entry.reasons.length > 0)
      .slice(0, 3)
      .map(
        (entry) =>
          `Wetter ${entry.profileName ?? entry.profileId}: ${entry.excluded ? "ausgeschlossen" : "abgewogen"} · ${entry.reasons.slice(0, 2).join(" ")}`,
      ),
    practicalNotes: [
      ...explain.capacityReasons.map((entry) => entry.reason),
      ...explain.costReasons.map((entry) => entry.reason),
      ...explain.practicalityReasons.flatMap((entry) => entry.reasons),
    ]
      .filter(Boolean)
      .slice(0, 4),
  };
}

export function emptyDecisionView(reason: string): DecisionView {
  return {
    mode: "none",
    decisionCharacter: "no_valid_decision",
    decisionCharacterLabel: "Keine Entscheidung",
    selectedSportName: "Noch offen",
    resultLabels: ["Keine Entscheidung"],
    simpleExplanation: reason,
    losingCandidateSummaries: [],
    activities: [],
    scoreComparison: [],
    reason,
  };
}
