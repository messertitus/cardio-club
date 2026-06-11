// Frontend-safe shape of a decision, as returned by the `decision` Edge Function.
//
// SECURITY: This is the ONLY decision payload the client receives. It deliberately
// omits every internal: per-candidate scoreBreakdown, absolute finalScore, ranking
// margins, candidate ids, fairnessDebt, weighted vote scores, no-go penalty
// mechanics and the DEFAULT_OPTIONS weights. Those never leave the server.
//
// This type is mirrored verbatim in supabase/functions/decision/_shared/sanitize.ts
// (the server side that produces it). Keep the two shapes in sync.
import type { ConstellationMode, DecisionCharacter } from "./decisionTypes";

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

// Only a relative percentage vs. the strongest option — no raw score dimensions.
export type DecisionScoreRow = {
  id: string;
  label: string;
  eventTyp: string;
  relativePercent: number;
};

// Full per-candidate score breakdown — admin-only, for transparency during the
// test phase. Computed scores for this event; delivered only to authenticated
// admins, never to normal users and never in the client bundle.
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
