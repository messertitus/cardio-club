import { describe, expect, it } from "vitest";
import { buildDecisionPresentation } from "../src/lib/decisionPresentation";
import type { FairSportSelectionResult } from "../src/lib/fairSportSelection";

const sportNames = new Map([
  ["football", "Fußball"],
  ["swimming", "Schwimmen"],
  ["boxing", "Boxen"],
  ["running", "Laufen"],
]);

describe("buildDecisionPresentation", () => {
  it("explains a majority-based result without technical score language", () => {
    const presentation = buildDecisionPresentation(
      {
        mode: "single",
        selectedSportId: "football",
        scores: [
          score("football", 4, 0, 0.35, 0, 4.35),
          score("swimming", 2, 0, 0, 0, 2),
        ],
        reason: "raw reason",
      },
      sportNames,
    );

    expect(presentation.resultLabels).toContain("Mehrheit");
    expect(presentation.simpleExplanation).toBe(
      "Fußball hatte die meisten Stimmen. Die Sportart von letzter Woche wurde automatisch ausgeschlossen.",
    );
  });

  it("explains a fairness-adjusted result in simple language", () => {
    const presentation = buildDecisionPresentation(
      {
        mode: "single",
        selectedSportId: "boxing",
        scores: [
          score("boxing", 2, 2, 0, 0, 4),
          score("football", 3, 0, 0, 0, 3),
        ],
        reason: "raw reason",
      },
      sportNames,
    );

    expect(presentation.resultLabels).toContain("Fairness-Ausgleich");
    expect(presentation.resultLabels).not.toContain("Mehrheit");
    expect(presentation.simpleExplanation).toBe(
      "Boxen wurde ausgewählt, weil mehrere Mitglieder mit dieser Präferenz in den letzten Wochen nicht berücksichtigt wurden.",
    );
  });

  it("labels combined decisions", () => {
    const presentation = buildDecisionPresentation(
      {
        mode: "combined",
        selectedSportId: "boxing",
        secondarySportId: "swimming",
        scores: [score("boxing", 3, 0, 0, 0, 3), score("swimming", 2, 0, 0, 0, 2)],
        reason: "raw reason",
      },
      sportNames,
    );

    expect(presentation.secondarySportName).toBe("Schwimmen");
    expect(presentation.resultLabels).toContain("Gemeinsamer Cardiotag");
    expect(presentation.simpleExplanation).toContain("gemeinsamen Cardiotag");
  });

  it("labels subgroup decisions", () => {
    const presentation = buildDecisionPresentation(
      {
        mode: "subgroups",
        selectedSportId: "football",
        secondarySportId: "swimming",
        subgroups: [],
        scores: [score("football", 3, 0, 0, 0, 3), score("swimming", 3, 0, 0, 0, 3)],
        reason: "raw reason",
      },
      sportNames,
    );

    expect(presentation.resultLabels).toContain("Untergruppen");
    expect(presentation.simpleExplanation).toContain("Untergruppen");
  });
});

function score(
  sportId: string,
  baseVoteScore: number,
  fairnessScore: number,
  diversityScore: number,
  repetitionPenalty: number,
  finalScore: number,
) {
  return {
    sportId,
    baseVoteScore,
    fairnessScore,
    diversityScore,
    repetitionPenalty,
    finalScore,
  };
}
