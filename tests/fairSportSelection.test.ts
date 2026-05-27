import { describe, expect, it } from "vitest";
import {
  calculateNeglectScores,
  selectFairSport,
  type PreferenceHistoryEntry,
  type Sport,
  type SportProposal,
  type SportVote,
} from "../src/lib/fairSportSelection";

const sports: Sport[] = [
  { id: "basketball", name: "Basketball", category: "court" },
  { id: "running", name: "Running", category: "endurance" },
  { id: "cycling", name: "Cycling", category: "endurance" },
  { id: "boxing", name: "Outdoor boxing", category: "combat", compatibleSportIds: ["swimming"] },
  { id: "swimming", name: "Swimming", category: "water", compatibleSportIds: ["boxing"] },
  { id: "football", name: "Football", category: "field" },
  { id: "rowing", name: "Rowing", category: "water", incompatibleWeatherTags: ["storm"] },
];

const proposals: SportProposal[] = sports.map((sport) => ({ sportId: sport.id }));

function votesFor(sportId: string, userIds: string[]): SportVote[] {
  return userIds.map((userId) => ({ sportId, userId }));
}

function neglectedHistory(userId: string, sportId: string, weeks: number): PreferenceHistoryEntry[] {
  return Array.from({ length: weeks }, (_, index) => ({
    userId,
    sportId,
    weekStartDate: `2026-04-${String(30 - index).padStart(2, "0")}`,
    wasSelected: false,
    votedFor: true,
  }));
}

describe("selectFairSport", () => {
  it("lets the majority win normally", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [...votesFor("basketball", ["u1", "u2", "u3"]), ...votesFor("running", ["u4"])],
    });

    expect(result.mode).toBe("single");
    expect(result.selectedSportId).toBe("basketball");
    expect(result.reason).toContain("Selected Basketball");
  });

  it("excludes the previous week's sport", () => {
    const result = selectFairSport({
      sports,
      proposals,
      previousWeekSportId: "basketball",
      votes: [...votesFor("basketball", ["u1", "u2", "u3"]), ...votesFor("running", ["u4"])],
    });

    expect(result.selectedSportId).toBe("running");
    expect(result.scores.map((score) => score.sportId)).not.toContain("basketball");
  });

  it("allows a neglected minority to win after multiple ignored weeks", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [...votesFor("basketball", ["u1", "u2", "u3"]), ...votesFor("running", ["u4", "u5"])],
      preferenceHistory: [
        ...neglectedHistory("u4", "running", 6),
        ...neglectedHistory("u5", "running", 6),
      ],
    });

    expect(result.mode).toBe("single");
    expect(result.selectedSportId).toBe("running");
    expect(result.reason).toContain("neglected minority");
  });

  it("caps the fairness boost", () => {
    const scores = calculateNeglectScores(neglectedHistory("u1", "running", 20));

    expect(scores.get("u1")).toBe(2);
  });

  it("can recommend combining compatible sports with strong support", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [...votesFor("boxing", ["u1", "u2", "u3"]), ...votesFor("swimming", ["u4", "u5"])],
    });

    expect(result.mode).toBe("combined");
    expect(result.selectedSportId).toBe("boxing");
    expect(result.secondarySportId).toBe("swimming");
  });

  it("recommends subgroups when preferences are split and incompatible", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [...votesFor("football", ["u1", "u2", "u3"]), ...votesFor("swimming", ["u4", "u5", "u6"])],
    });

    expect(result.mode).toBe("subgroups");
    expect(result.subgroups).toEqual([
      { sportId: "football", userIds: ["u1", "u2", "u3"] },
      { sportId: "swimming", userIds: ["u4", "u5", "u6"] },
    ]);
  });

  it("returns no decision when there are no eligible votes", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [],
    });

    expect(result.mode).toBe("none");
    expect(result.selectedSportId).toBeUndefined();
    expect(result.scores).toEqual([]);
  });

  it("breaks ties deterministically by alphabetical sport name when other tie-breakers match", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [...votesFor("running", ["u1"]), ...votesFor("cycling", ["u2"])],
      options: {
        diversityBoost: 0,
      },
    });

    expect(result.selectedSportId).toBe("cycling");
    expect(result.scores.map((score) => score.sportId).slice(0, 2)).toEqual(["cycling", "running"]);
  });

  it("uses ranked vote weights in the majority baseline", () => {
    const result = selectFairSport({
      sports,
      proposals,
      votes: [
        { sportId: "running", userId: "u1", weight: 1 },
        { sportId: "cycling", userId: "u2", weight: 0.6 },
        { sportId: "cycling", userId: "u3", weight: 0.3 },
      ],
      options: {
        diversityBoost: 0,
      },
    });

    expect(result.selectedSportId).toBe("running");
    expect(result.scores.find((score) => score.sportId === "running")?.baseVoteScore).toBe(1);
    expect(result.scores.find((score) => score.sportId === "cycling")?.baseVoteScore).toBe(0.9);
  });

  it("excludes sports incompatible with provided context", () => {
    const result = selectFairSport({
      sports,
      proposals,
      context: {
        weatherTags: ["storm"],
      },
      votes: [...votesFor("rowing", ["u1", "u2"]), ...votesFor("running", ["u3"])],
    });

    expect(result.selectedSportId).toBe("running");
    expect(result.scores.map((score) => score.sportId)).not.toContain("rowing");
  });
});

describe("selectFairSport fairness mechanism with larger groups", () => {
  const members = Array.from({ length: 12 }, (_, index) => `m${index + 1}`);
  const largeSports: Sport[] = [
    { id: "football", name: "Football", category: "field" },
    { id: "running", name: "Running", category: "endurance" },
    { id: "swimming", name: "Swimming", category: "water", compatibleSportIds: ["boxing"] },
    { id: "boxing", name: "Boxing", category: "combat", compatibleSportIds: ["swimming"] },
    { id: "basketball", name: "Basketball", category: "court" },
    { id: "cycling", name: "Cycling", category: "endurance" },
    { id: "rowing", name: "Rowing", category: "water" },
    { id: "hiking", name: "Hiking", category: "outdoor" },
  ];
  const largeProposals = largeSports.map((sport) => ({ sportId: sport.id }));

  it("lets a 7-person majority usually beat a 2-person minority", () => {
    const result = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("football", members.slice(0, 7)), ...votesFor("running", members.slice(7, 9))],
    });

    expect(result.mode).toBe("single");
    expect(result.selectedSportId).toBe("football");
  });

  it("lets a 2-person minority ignored for 4 weeks beat a weak 4-person majority", () => {
    const neglectedVoters = members.slice(4, 6);
    const result = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("football", members.slice(0, 4)), ...votesFor("running", neglectedVoters)],
      preferenceHistory: neglectedVoters.flatMap((userId) => neglectedHistory(userId, "running", 4)),
    });

    expect(result.selectedSportId).toBe("running");
    expect(result.scores[0].fairnessScore).toBe(2.8);
  });

  it("does not let a neglected minority permanently dominate after winning once", () => {
    const formerlyNeglected = members.slice(4, 6);
    const result = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("football", members.slice(0, 4)), ...votesFor("running", formerlyNeglected)],
      preferenceHistory: [
        ...formerlyNeglected.map((userId) =>
          historyEntry({ userId, sportId: "running", weekStartDate: "2026-05-01", wasSelected: true }),
        ),
        ...formerlyNeglected.flatMap((userId) => neglectedHistory(userId, "running", 4)),
      ],
    });

    expect(result.selectedSportId).toBe("football");
    expect(result.scores.find((score) => score.sportId === "running")?.fairnessScore).toBe(0);
  });

  it("resets neglect score when a previously neglected group gets selected", () => {
    const scores = calculateNeglectScores([
      historyEntry({ userId: "m1", sportId: "running", weekStartDate: "2026-05-01", wasSelected: true }),
      ...neglectedHistory("m1", "running", 4),
    ]);

    expect(scores.get("m1")).toBe(0);
  });

  it("does not increase neglect score when someone does not vote", () => {
    const scores = calculateNeglectScores([
      historyEntry({ userId: "m1", sportId: "running", weekStartDate: "2026-05-01", votedFor: false }),
      ...neglectedHistory("m1", "running", 3),
    ]);

    expect(scores.get("m1")).toBe(0);
  });

  it("never lets the previous week's sport win, even with high fairness score", () => {
    const neglectedVoters = members.slice(0, 8);
    const result = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      previousWeekSportId: "football",
      votes: [...votesFor("football", neglectedVoters), ...votesFor("running", members.slice(8, 10))],
      preferenceHistory: neglectedVoters.flatMap((userId) => neglectedHistory(userId, "football", 8)),
    });

    expect(result.selectedSportId).toBe("running");
    expect(result.scores.map((score) => score.sportId)).not.toContain("football");
  });

  it("returns combined when compatible top sports both have meaningful support", () => {
    const result = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("boxing", members.slice(0, 5)), ...votesFor("swimming", members.slice(5, 9))],
    });

    expect(result.mode).toBe("combined");
    expect(result.selectedSportId).toBe("boxing");
    expect(result.secondarySportId).toBe("swimming");
  });

  it("returns subgroups when incompatible top sports both have strong support", () => {
    const result = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("football", members.slice(0, 5)), ...votesFor("swimming", members.slice(5, 10))],
    });

    expect(result.mode).toBe("subgroups");
    expect(result.subgroups).toEqual([
      { sportId: "football", userIds: members.slice(0, 5) },
      { sportId: "swimming", userIds: [...members.slice(5, 10)].sort() },
    ]);
  });

  it("resolves ties by base votes, then fairness, then older last-selected date, then sport name", () => {
    const baseVotesResult = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [
        ...votesFor("football", members.slice(0, 3)),
        { sportId: "running", userId: "m4", weight: 1 },
        { sportId: "running", userId: "m5", weight: 1 },
        { sportId: "running", userId: "m6", weight: 0.5 },
      ],
      preferenceHistory: [historyEntry({ userId: "m4", sportId: "running", weekStartDate: "2026-05-01" })],
      options: { diversityBoost: 0, neglectBoostPerWeek: 0.5 },
    });

    expect(baseVotesResult.selectedSportId).toBe("football");

    const fairnessResult = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("football", members.slice(0, 3)), ...votesFor("running", members.slice(3, 6))],
      preferenceHistory: [historyEntry({ userId: "m4", sportId: "running", weekStartDate: "2026-05-01" })],
      recentSelections: [{ sportId: "running", category: "endurance", weekStartDate: "2026-05-01" }],
      options: {
        diversityBoost: 0,
        recentCategoryPenalty: 0,
        veryRecentCategoryPenalty: 0.35,
      },
    });

    expect(fairnessResult.selectedSportId).toBe("running");

    const olderSelectionResult = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("football", members.slice(0, 3)), ...votesFor("running", members.slice(3, 6))],
      recentSelections: [
        { sportId: "football", category: "field", weekStartDate: "2026-05-01" },
        { sportId: "running", category: "endurance", weekStartDate: "2026-04-01" },
      ],
      options: {
        diversityBoost: 0,
        recentCategoryPenalty: 0,
        veryRecentCategoryPenalty: 0,
      },
    });

    expect(olderSelectionResult.selectedSportId).toBe("running");

    const alphabeticalResult = selectFairSport({
      sports: largeSports,
      proposals: largeProposals,
      votes: [...votesFor("running", members.slice(0, 3)), ...votesFor("cycling", members.slice(3, 6))],
      options: { diversityBoost: 0 },
    });

    expect(alphabeticalResult.selectedSportId).toBe("cycling");
  });
});

function historyEntry({
  userId,
  sportId,
  weekStartDate,
  wasSelected = false,
  votedFor = true,
}: {
  userId: string;
  sportId: string;
  weekStartDate: string;
  wasSelected?: boolean;
  votedFor?: boolean;
}): PreferenceHistoryEntry {
  return {
    userId,
    sportId,
    weekStartDate,
    wasSelected,
    votedFor,
  };
}
