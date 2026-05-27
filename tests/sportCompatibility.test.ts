import { describe, expect, it } from "vitest";
import { canCombineSports, type SportMetadata } from "../src/lib/sportCompatibility";

const sport = {
  outdoorBoxing: {
    id: "outdoor-boxing",
    name: "Outdoor boxing",
    category: "combat",
    intensity_level: "high",
    location_type: "outdoor",
    combinable_tags: ["outdoor", "bodyweight", "warmup"],
    estimated_duration_minutes: 45,
    required_equipment: ["gloves"],
    minimum_group_size: 2,
    maximum_group_size: 16,
  },
  swimming: {
    id: "swimming",
    name: "Swimming",
    category: "water",
    intensity_level: "medium",
    location_type: "water",
    combinable_tags: ["water", "lake", "recovery"],
    estimated_duration_minutes: 45,
    required_equipment: ["swimwear"],
    minimum_group_size: 2,
  },
  beachVolleyball: {
    id: "beach-volleyball",
    name: "Beach volleyball",
    category: "team_field",
    intensity_level: "medium",
    location_type: "field",
    combinable_tags: ["beach", "ball", "outdoor"],
    estimated_duration_minutes: 60,
    required_equipment: ["ball", "net"],
    minimum_group_size: 4,
    maximum_group_size: 12,
  },
  cycling: {
    id: "cycling",
    name: "Cycling",
    category: "cycling",
    intensity_level: "medium",
    location_type: "outdoor",
    combinable_tags: ["outdoor", "route", "endurance"],
    estimated_duration_minutes: 90,
    required_equipment: ["bike", "helmet"],
    minimum_group_size: 1,
  },
  football: {
    id: "football",
    name: "Football",
    category: "team_field",
    intensity_level: "high",
    location_type: "field",
    combinable_tags: ["field", "ball", "team"],
    estimated_duration_minutes: 75,
    required_equipment: ["ball"],
    minimum_group_size: 6,
    maximum_group_size: 22,
  },
  running: {
    id: "running",
    name: "Running",
    category: "running",
    intensity_level: "medium",
    location_type: "outdoor",
    combinable_tags: ["outdoor", "running", "warmup"],
    estimated_duration_minutes: 40,
    required_equipment: [],
    minimum_group_size: 1,
  },
  calisthenics: {
    id: "calisthenics",
    name: "Calisthenics",
    category: "bodyweight",
    intensity_level: "medium",
    location_type: "flexible",
    combinable_tags: ["bodyweight", "warmup", "outdoor"],
    estimated_duration_minutes: 35,
    required_equipment: [],
    minimum_group_size: 1,
  },
  indoorBasketball: {
    id: "indoor-basketball",
    name: "Indoor basketball",
    category: "court",
    intensity_level: "high",
    location_type: "indoor",
    combinable_tags: ["court", "ball", "team"],
    estimated_duration_minutes: 60,
    required_equipment: ["ball", "court"],
    minimum_group_size: 4,
    maximum_group_size: 10,
  },
  hiking: {
    id: "hiking",
    name: "Hiking",
    category: "endurance",
    intensity_level: "low",
    location_type: "outdoor",
    combinable_tags: ["outdoor", "route", "recovery"],
    estimated_duration_minutes: 150,
    required_equipment: ["boots"],
    minimum_group_size: 1,
  },
  rowing: {
    id: "rowing",
    name: "Rowing",
    category: "water",
    intensity_level: "high",
    location_type: "water",
    combinable_tags: ["water", "lake", "team"],
    estimated_duration_minutes: 60,
    required_equipment: ["boat", "oars"],
    minimum_group_size: 2,
    maximum_group_size: 8,
  },
} satisfies Record<string, SportMetadata>;

describe("canCombineSports", () => {
  it("combines outdoor boxing and swimming at a lake", () => {
    const result = canCombineSports(sport.outdoorBoxing, sport.swimming, {
      location: "Lake park",
      locationTags: ["lake", "outdoor"],
    });

    expect(result.compatible).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.reason).toContain("compatible");
  });

  it("combines beach volleyball and swimming at the beach", () => {
    const result = canCombineSports(sport.beachVolleyball, sport.swimming, {
      locationTags: ["beach", "water"],
    });

    expect(result.compatible).toBe(true);
  });

  it("does not combine cycling and football as one shared event", () => {
    const result = canCombineSports(sport.cycling, sport.football, {
      locationTags: ["outdoor"],
    });

    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("subgroups");
  });

  it("combines running and calisthenics", () => {
    const result = canCombineSports(sport.running, sport.calisthenics, {
      locationTags: ["park", "outdoor"],
    });

    expect(result.compatible).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("does not combine swimming and indoor basketball without separate venues", () => {
    const result = canCombineSports(sport.swimming, sport.indoorBasketball, {
      locationTags: ["pool"],
    });

    expect(result.compatible).toBe(false);
  });

  it("can combine swimming and indoor basketball with separate venues", () => {
    const result = canCombineSports(sport.swimming, sport.indoorBasketball, {
      hasSeparateVenues: true,
      availableEquipment: ["swimwear", "ball", "court"],
    });

    expect(result.compatible).toBe(true);
  });

  it("penalizes missing equipment", () => {
    const result = canCombineSports(sport.beachVolleyball, sport.swimming, {
      locationTags: ["beach"],
      availableEquipment: ["swimwear"],
    });

    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("Missing equipment");
  });

  it("penalizes participant counts below minimum group size", () => {
    const result = canCombineSports(sport.football, sport.indoorBasketball, {
      hasSeparateVenues: true,
      expectedParticipants: 3,
    });

    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("minimum group size");
  });

  it("combines rowing and swimming at a lake", () => {
    const result = canCombineSports(sport.rowing, sport.swimming, {
      locationTags: ["lake", "water"],
      expectedParticipants: 4,
    });

    expect(result.compatible).toBe(true);
  });

  it("does not combine hiking and indoor basketball as a constrained session", () => {
    const result = canCombineSports(sport.hiking, sport.indoorBasketball, {
      maxTotalDurationMinutes: 120,
    });

    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("above the planned limit");
  });
});
