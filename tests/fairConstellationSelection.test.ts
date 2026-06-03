import { describe, expect, it } from "vitest";
import {
  calculateFairnessDebt,
  selectFairConstellation,
  type AbstractSport,
  type FairConstellationInput,
  type PreferenceHistoryEntry,
  type SportProfile,
} from "../src/lib/fairConstellationSelection";

const sports: AbstractSport[] = [
  { id: "football", name: "Football", category: "field" },
  { id: "running", name: "Running", category: "endurance" },
  { id: "boxing", name: "Outdoor boxing", category: "combat" },
  { id: "volleyball", name: "Beachvolleyball", category: "field" },
  { id: "cycling", name: "Cycling", category: "endurance" },
  { id: "badminton", name: "Badminton", category: "court" },
];

const profiles: SportProfile[] = [
  profile("football-field", "football", "Football field", 48, 7.8, "field", "field"),
  profile("running-park", "running", "Park run", 48, 7.801, "park", "outdoor"),
  profile("boxing-park", "boxing", "Park boxing", 48, 7.801, "park", "outdoor"),
  profile("volleyball-park", "volleyball", "Park beach court", 48, 7.8012, "park", "field", 4),
  profile("volleyball-lake", "volleyball", "Lake beach court", 48.02, 7.84, "lake", "field", 4),
  profile("cycling-route", "cycling", "Cycling route", 48.1, 7.9, "route", "outdoor"),
  profile("badminton-hall", "badminton", "Badminton hall", 48, 7.8, "hall", "indoor", 2),
];

describe("selectFairConstellation", () => {
  it("selects a single event when one sport has broad support", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2", "u3"]), ...votesFor("running", ["u4"])],
      }),
    );

    expect(result.mode).toBe("single");
    expect(result.selectedSportId).toBe("football");
    expect(result.selectedProfileId).toBe("football-field");
  });

  it("selects multi-sport and prefers the nearby profile over another profile of the same sport", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("volleyball", ["u1", "u2", "u3", "u4"]), ...votesFor("boxing", ["u5", "u6", "u7"])],
      }),
    );

    expect(result.mode).toBe("multi_sport");
    expect(result.activities.map((activity) => activity.profileId)).toContain("volleyball-park");
    expect(result.activities.map((activity) => activity.profileId)).toContain("boxing-park");
  });

  it("allows a nearby minority group to become a multi-sport activity", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("volleyball", ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"]), ...votesFor("boxing", ["u9", "u10", "u11"])],
      }),
    );

    expect(result.mode).toBe("multi_sport");
    expect(result.activities.map((activity) => activity.sportId)).toEqual(["volleyball", "boxing"]);
  });

  it("selects a twin event when two real groups are split across locations", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2", "u3", "u4"]), ...votesFor("cycling", ["u5", "u6", "u7"])],
      }),
    );

    expect(result.mode).toBe("twin");
    expect(result.secondarySportId).toBe("cycling");
  });

  it("keeps no-go users out of a single event's accepted participant coverage", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2", "u3"]), ...votesFor("running", ["u4", "u5"])],
        noGos: [
          { sportId: "football", userId: "u4" },
          { sportId: "football", userId: "u5" },
        ],
      }),
    );

    const footballCandidate = result.scores.find((score) => score.mode === "single" && score.activities[0]?.sportId === "football");
    expect(footballCandidate?.activities[0]?.assignedUserIds).not.toContain("u4");
    expect(footballCandidate?.activities[0]?.assignedUserIds).not.toContain("u5");
    expect(footballCandidate?.scoreBreakdown.reliability).toBeLessThan(0);
  });

  it("ignores not-going voters but keeps maybe voters with reduced weight", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2"]), ...votesFor("running", ["u3"])],
        attendance: [
          { userId: "u1", status: "not_going" },
          { userId: "u2", status: "not_going" },
          { userId: "u3", status: "maybe" },
        ],
      }),
    );

    expect(result.selectedSportId).toBe("running");
  });

  it("does not count votes without an explicit going or maybe attendance status", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2"]), ...votesFor("running", ["u3"])],
        attendance: [{ userId: "u3", status: "going" }],
      }),
    );

    expect(result.selectedSportId).toBe("running");
  });

  it("reduces maybe vote influence in the preference score", () => {
    const result = selectFairConstellation(
      input({
        votes: votesFor("football", ["u1"]),
        attendance: [{ userId: "u1", status: "maybe" }],
      }),
    );

    const footballCandidate = result.scores.find((score) => score.activities[0]?.sportId === "football");
    expect(footballCandidate?.scoreBreakdown.preference).toBe(0.55);
  });

  it("excludes dangerous outdoor weather and keeps indoor alternatives viable", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2", "u3"]), ...votesFor("badminton", ["u4", "u5"])],
        weatherSnapshot: {
          "football-field": { weatherCode: 96, windSpeedKmh: 20, precipitationMm: 0 },
          "badminton-hall": { weatherCode: 96, windSpeedKmh: 20, precipitationMm: 0 },
        },
      }),
    );

    expect(result.selectedSportId).toBe("badminton");
    expect(result.excludedProfiles.map((entry) => entry.profileId)).toContain("football-field");
  });

  it("uses fairness debt for repeatedly ignored voters", () => {
    const debt = calculateFairnessDebt([
      ...ignoredHistory("u4", "running", 3),
      ...ignoredHistory("u5", "running", 3),
    ]);

    expect(debt.get("u4")).toBeGreaterThan(0);

    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2", "u3"]), ...votesFor("running", ["u4", "u5"])],
        preferenceHistory: [...ignoredHistory("u4", "running", 4), ...ignoredHistory("u5", "running", 4)],
      }),
    );

    expect(result.scoreBreakdown?.fairness).toBeGreaterThan(0);
  });

  it("turns repeated minority neglect into a fair multi-sport constellation when locations fit", () => {
    const result = selectFairConstellation(
      input({
        votes: [
          ...votesFor("volleyball", ["u1", "u2", "u3", "u4", "u5"]),
          ...votesFor("boxing", ["u6", "u7"]),
        ],
        preferenceHistory: [...ignoredHistory("u6", "boxing", 4), ...ignoredHistory("u7", "boxing", 4)],
      }),
    );

    expect(result.mode).toBe("multi_sport");
    expect(result.activities.map((activity) => activity.sportId)).toContain("boxing");
    expect(result.scoreBreakdown?.fairness).toBeGreaterThan(0);
  });

  it("prefers a richer sport profile when equipment, AP and site data make it more practical", () => {
    const documentedProfile: SportProfile = {
      ...profile("volleyball-ready", "volleyball", "Ready beach court", 48, 7.81, "ready", "field", 4),
      requiredEquipment: ["ball", "net"],
      availableEquipment: ["ball", "net"],
      openingNotes: "Open until late",
      transitNotes: "Transit and parking documented",
      amenityNotes: "Water and changing rooms nearby",
      locationRules: "Use court only after booking",
      safetyNotes: "Check sand before play",
      apRequired: true,
      apContactId: "ap1",
    };

    const result = selectFairConstellation(
      input({
        sportProfiles: [
          profile("volleyball-bare", "volleyball", "Bare beach court", 48, 7.8, "bare", "field", 4),
          documentedProfile,
        ],
        votes: votesFor("volleyball", ["u1", "u2", "u3", "u4"]),
      }),
    );

    expect(result.selectedProfileId).toBe("volleyball-ready");
    expect(result.activities[0]?.activityContactId).toBe("ap1");
    expect(result.activities[0]?.practicalityNotes?.join(" ")).toContain("Ausstattung");
  });

  it("penalizes rainy outdoor profiles while keeping indoor profiles stable", () => {
    const result = selectFairConstellation(
      input({
        sportProfiles: [
          {
            ...profile("volleyball-rain-court", "volleyball", "Rainy outdoor court", 48, 7.8, "rain", "field", 4),
            weatherRules: { requiresDry: true, rainSensitive: true, thunderstormUnsafe: true },
          },
          profile("volleyball-indoor", "volleyball", "Indoor court", 48, 7.8, "hall", "indoor", 4),
        ],
        votes: votesFor("volleyball", ["u1", "u2", "u3", "u4"]),
        weatherSnapshot: {
          "volleyball-rain-court": { weatherCode: 61, precipitationMm: 4, precipitationProbability: 90 },
          "volleyball-indoor": { weatherCode: 61, precipitationMm: 4, precipitationProbability: 90 },
        },
      }),
    );

    expect(result.selectedProfileId).toBe("volleyball-indoor");
    expect(result.activities[0]?.weatherNotes?.join(" ")).toContain("Indoor");
  });

  it("reduces repeated no-show influence without removing the vote entirely", () => {
    const result = selectFairConstellation(
      input({
        votes: [...votesFor("football", ["u1", "u2"]), ...votesFor("running", ["u3"])],
        reliabilityHistory: [
          { userId: "u1", weekStartDate: "2026-05-01", plannedStatus: "going", actualStatus: "absent" },
          { userId: "u1", weekStartDate: "2026-05-08", plannedStatus: "going", actualStatus: "absent" },
        ],
      }),
    );

    const footballCandidate = result.scores.find((score) => score.activities[0]?.sportId === "football");
    expect(footballCandidate?.scoreBreakdown.reliability).toBeLessThan(0);
  });
});

function input(overrides: Partial<FairConstellationInput>): FairConstellationInput {
  const sportIds = new Set((overrides.votes ?? []).map((vote) => vote.sportId));
  return {
    sports,
    sportProfiles: profiles,
    proposals: [...sportIds].map((sportId) => ({ sportId })),
    votes: [],
    attendance: uniqueUsers(overrides.votes ?? []).map((userId) => ({ userId, status: "going" })),
    ...overrides,
  };
}

function profile(
  id: string,
  sportId: string,
  name: string,
  latitude: number,
  longitude: number,
  venueGroupKey: string,
  locationType: SportProfile["locationType"],
  minimumGroupSize = 1,
): SportProfile {
  return {
    id,
    sportId,
    name,
    locationName: name,
    latitude,
    longitude,
    venueGroupKey,
    locationType,
    isIndoor: locationType === "indoor",
    minimumGroupSize,
    weatherRules: {
      rainSensitive: locationType !== "indoor",
      thunderstormUnsafe: locationType !== "indoor",
    },
  };
}

function votesFor(sportId: string, userIds: string[]) {
  return userIds.map((userId) => ({ sportId, userId, weight: 1 }));
}

function uniqueUsers(votes: Array<{ userId: string }>): string[] {
  return [...new Set(votes.map((vote) => vote.userId))];
}

function ignoredHistory(userId: string, sportId: string, weeks: number): PreferenceHistoryEntry[] {
  return Array.from({ length: weeks }, (_, index) => ({
    userId,
    sportId,
    weekStartDate: `2026-05-${String(20 - index).padStart(2, "0")}`,
    wasSelected: false,
    votedFor: true,
    coveredByDecision: false,
  }));
}
