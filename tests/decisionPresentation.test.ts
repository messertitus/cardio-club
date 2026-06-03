import { describe, expect, it } from "vitest";
import { buildDecisionPresentation } from "../src/lib/decisionPresentation";
import type { CandidateActivity, CandidateScore, FairConstellationDecision, ScoreBreakdown } from "../src/lib/fairConstellationSelection";

const sportNames = new Map([
  ["football", "Fußball"],
  ["swimming", "Schwimmen"],
  ["boxing", "Boxen"],
  ["running", "Laufen"],
]);

describe("buildDecisionPresentation", () => {
  it("explains a single profile decision", () => {
    const presentation = buildDecisionPresentation(
      decision("single", [activity("football", "football-park", "Stadtpark")], breakdown({ preference: 4, togetherness: 1.4 })),
      sportNames,
    );

    expect(presentation.resultLabels).toContain("Single Event");
    expect(presentation.selectedSportName).toBe("Fußball · Stadtpark");
    expect(presentation.simpleExplanation).toContain("Single Event");
  });

  it("explains a multi-sport decision with two profiles", () => {
    const presentation = buildDecisionPresentation(
      decision(
        "multi_sport",
        [activity("boxing", "boxing-park", "Boxen im Park"), activity("running", "running-park", "Laufgruppe im Park", "secondary")],
        breakdown({ preference: 5, fairness: 1, minorityProtection: 0.8, togetherness: 1.2 }),
      ),
      sportNames,
    );

    expect(presentation.resultLabels).toContain("Multi-Sport");
    expect(presentation.resultLabels).toContain("Fairness-Ausgleich");
    expect(presentation.secondarySportName).toBe("Laufen · Laufgruppe im Park");
    expect(presentation.simpleExplanation).toContain("Multi-Sport Event");
  });

  it("labels twin events and exposes the score breakdown", () => {
    const presentation = buildDecisionPresentation(
      decision(
        "twin",
        [activity("football", "football-field", "Kunstrasen"), activity("swimming", "swimming-lake", "See", "secondary")],
        breakdown({ preference: 6, minorityProtection: 1, togetherness: -0.55, weather: -0.2 }),
      ),
      sportNames,
    );

    expect(presentation.resultLabels).toContain("Twin Event");
    expect(presentation.resultLabels).toContain("Wetter abgewogen");
    expect(presentation.activityRows).toHaveLength(2);
    expect(presentation.scoreRows[0].eventTyp).toBe("Twin Event");
    expect(presentation.scoreRows[0].minderheitenschutz).toBe(1);
  });
});

function decision(
  mode: FairConstellationDecision["mode"],
  activities: CandidateActivity[],
  scoreBreakdown: ScoreBreakdown,
): FairConstellationDecision {
  const score = candidate(mode, activities, scoreBreakdown);
  return {
    mode,
    selectedSportId: activities[0]?.sportId,
    secondarySportId: activities[1]?.sportId,
    selectedProfileId: activities[0]?.profileId,
    secondaryProfileId: activities[1]?.profileId,
    activities,
    scores: [score],
    scoreBreakdown,
    excludedProfiles: [],
    reason: "raw reason",
  };
}

function candidate(
  mode: FairConstellationDecision["mode"],
  activities: CandidateActivity[],
  scoreBreakdown: ScoreBreakdown,
): CandidateScore {
  return {
    id: `${mode}:${activities.map((item) => item.profileId).join("+")}`,
    mode,
    activities,
    proximity: mode === "twin" ? "split_location" : "same_spot",
    scoreBreakdown,
    finalScore: Object.values(scoreBreakdown).reduce((total, value) => total + value, 0),
    reasonParts: [],
  };
}

function activity(
  sportId: string,
  profileId: string,
  profileName: string,
  role: CandidateActivity["role"] = "primary",
): CandidateActivity {
  return {
    sportId,
    sportName: sportId,
    profileId,
    profileName,
    locationName: profileName,
    role,
    assignedUserIds: role === "primary" ? ["u1", "u2"] : ["u3"],
    participantCount: role === "primary" ? 2 : 1,
  };
}

function breakdown(values: Partial<ScoreBreakdown>): ScoreBreakdown {
  return {
    participation: 0,
    preference: 0,
    fairness: 0,
    minorityProtection: 0,
    togetherness: 0,
    weather: 0,
    practicality: 0,
    rotation: 0,
    reliability: 0,
    ...values,
  };
}
