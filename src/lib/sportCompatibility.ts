export type SportIntensityLevel = "low" | "medium" | "high";
export type SportLocationType = "indoor" | "outdoor" | "water" | "field" | "flexible";

export type SportMetadata = {
  id: string;
  name?: string;
  category: string;
  intensity_level: SportIntensityLevel;
  location_type: SportLocationType;
  combinable_tags: string[];
  estimated_duration_minutes: number;
  required_equipment: string[];
  minimum_group_size: number;
  maximum_group_size?: number;
};

export type SportCompatibilityContext = {
  location?: string;
  locationTags?: string[];
  hasSeparateVenues?: boolean;
  availableEquipment?: string[];
  expectedParticipants?: number;
  maxTotalDurationMinutes?: number;
};

export type SportCompatibilityResult = {
  compatible: boolean;
  confidence: number;
  reason: string;
};

const STRONG_TAG_PAIRS = new Set([
  tagPair("beach", "water"),
  tagPair("lake", "water"),
  tagPair("outdoor", "water"),
  tagPair("outdoor", "bodyweight"),
  tagPair("warmup", "bodyweight"),
  tagPair("running", "bodyweight"),
  tagPair("cardio", "bodyweight"),
  tagPair("field", "ball"),
]);

const AWKWARD_CATEGORY_PAIRS = new Set([
  tagPair("cycling", "team_field"),
  tagPair("cycling", "court"),
  tagPair("water", "court"),
]);

export function canCombineSports(
  sportA: SportMetadata,
  sportB: SportMetadata,
  context: SportCompatibilityContext = {},
): SportCompatibilityResult {
  if (sportA.id === sportB.id) {
    return {
      compatible: true,
      confidence: 1,
      reason: `${sportName(sportA)} is the same sport, so no combination is needed.`,
    };
  }

  const reasons: string[] = [];
  let score = 0.45;

  const locationTags = normalizeSet([
    ...(context.locationTags ?? []),
    ...splitLocationText(context.location),
  ]);
  const combinedTags = normalizeSet([...sportA.combinable_tags, ...sportB.combinable_tags]);
  const sharedTags = intersection(normalizeSet(sportA.combinable_tags), normalizeSet(sportB.combinable_tags));

  const locationResult = scoreLocationFit(sportA, sportB, locationTags, context.hasSeparateVenues);
  score += locationResult.score;
  reasons.push(locationResult.reason);

  if (sharedTags.length > 0) {
    score += 0.18;
    reasons.push(`Both sports share ${formatList(sharedTags)} planning tags.`);
  }

  if (hasStrongTagPair(sportA, sportB, combinedTags, locationTags)) {
    score += 0.24;
    reasons.push("Their activity tags form a natural combined-session pairing.");
  }

  const durationResult = scoreDuration(sportA, sportB, context.maxTotalDurationMinutes);
  score += durationResult.score;
  reasons.push(durationResult.reason);

  const intensityResult = scoreIntensity(sportA, sportB);
  score += intensityResult.score;
  reasons.push(intensityResult.reason);

  const groupResult = scoreGroupSize(sportA, sportB, context.expectedParticipants);
  score += groupResult.score;

  if (groupResult.reason) {
    reasons.push(groupResult.reason);
  }

  const equipmentResult = scoreEquipment(sportA, sportB, context.availableEquipment);
  score += equipmentResult.score;

  if (equipmentResult.reason) {
    reasons.push(equipmentResult.reason);
  }

  if (AWKWARD_CATEGORY_PAIRS.has(tagPair(sportA.category, sportB.category))) {
    score -= 0.22;
    reasons.push("These categories usually work better as separate subgroups than as one shared event.");
  }

  if (groupResult.blocking || equipmentResult.blocking) {
    score = Math.min(score, 0.55);
  }

  const confidence = clamp(round(score), 0, 1);
  const compatible = confidence >= 0.6;

  return {
    compatible,
    confidence,
    reason: `${sportName(sportA)} + ${sportName(sportB)}: ${compatible ? "compatible" : "not compatible"}. ${reasons.join(" ")}`,
  };
}

function scoreLocationFit(
  sportA: SportMetadata,
  sportB: SportMetadata,
  locationTags: Set<string>,
  hasSeparateVenues = false,
): { score: number; reason: string } {
  const types = new Set([sportA.location_type, sportB.location_type]);

  if (types.size === 1) {
    return {
      score: 0.22,
      reason: `Both sports fit a ${sportA.location_type} location.`,
    };
  }

  if (types.has("flexible")) {
    return {
      score: 0.16,
      reason: "One sport is flexible enough to adapt to the other sport's venue.",
    };
  }

  if (types.has("water") && types.has("outdoor") && hasAny(locationTags, ["lake", "beach", "outdoor", "park"])) {
    return {
      score: 0.24,
      reason: "The context includes an outdoor water-friendly location.",
    };
  }

  if (types.has("water") && types.has("field") && hasAny(locationTags, ["beach", "lake"])) {
    return {
      score: 0.2,
      reason: "The context can support both a field/beach activity and water activity.",
    };
  }

  if (hasSeparateVenues) {
    return {
      score: 0.08,
      reason: "Separate venues make the location mismatch workable.",
    };
  }

  return {
    score: -0.3,
    reason: "The sports need different venue types and no separate venue context was provided.",
  };
}

function scoreDuration(
  sportA: SportMetadata,
  sportB: SportMetadata,
  maxTotalDurationMinutes?: number,
): { score: number; reason: string } {
  const totalDuration = sportA.estimated_duration_minutes + sportB.estimated_duration_minutes;

  if (maxTotalDurationMinutes && totalDuration > maxTotalDurationMinutes) {
    return {
      score: -0.18,
      reason: `Together they take about ${totalDuration} minutes, above the planned limit.`,
    };
  }

  if (totalDuration <= 150) {
    return {
      score: 0.12,
      reason: `The combined duration is manageable at about ${totalDuration} minutes.`,
    };
  }

  return {
    score: -0.08,
    reason: `The combined duration is long at about ${totalDuration} minutes.`,
  };
}

function scoreIntensity(sportA: SportMetadata, sportB: SportMetadata): { score: number; reason: string } {
  const gap = Math.abs(intensityValue(sportA.intensity_level) - intensityValue(sportB.intensity_level));

  if (gap === 0) {
    return {
      score: 0.1,
      reason: "The intensity levels match.",
    };
  }

  if (gap === 1) {
    return {
      score: 0.04,
      reason: "The intensity levels are close enough for most groups.",
    };
  }

  return {
    score: -0.08,
    reason: "The intensity gap may make one shared plan awkward.",
  };
}

function scoreGroupSize(
  sportA: SportMetadata,
  sportB: SportMetadata,
  expectedParticipants?: number,
): { score: number; reason?: string; blocking?: boolean } {
  if (!expectedParticipants) {
    return { score: 0 };
  }

  const minimumNeeded = Math.max(sportA.minimum_group_size, sportB.minimum_group_size);
  const maximumAllowed = Math.min(
    sportA.maximum_group_size ?? Number.POSITIVE_INFINITY,
    sportB.maximum_group_size ?? Number.POSITIVE_INFINITY,
  );

  if (expectedParticipants < minimumNeeded) {
    return {
      score: -0.28,
      blocking: true,
      reason: `Expected attendance is below the minimum group size of ${minimumNeeded}.`,
    };
  }

  if (expectedParticipants > maximumAllowed) {
    return {
      score: -0.2,
      blocking: true,
      reason: `Expected attendance is above the shared maximum group size of ${maximumAllowed}.`,
    };
  }

  return {
    score: 0.08,
    reason: "The expected group size fits both sports.",
  };
}

function scoreEquipment(
  sportA: SportMetadata,
  sportB: SportMetadata,
  availableEquipment?: string[],
): { score: number; reason?: string; blocking?: boolean } {
  if (!availableEquipment) {
    return { score: 0 };
  }

  const available = normalizeSet(availableEquipment);
  const missing = [...normalizeSet([...sportA.required_equipment, ...sportB.required_equipment])].filter(
    (item) => !available.has(item),
  );

  if (missing.length > 0) {
    return {
      score: -0.28,
      blocking: true,
      reason: `Missing equipment: ${formatList(missing)}.`,
    };
  }

  return {
    score: 0.08,
    reason: "Required equipment is available.",
  };
}

function hasStrongTagPair(
  sportA: SportMetadata,
  sportB: SportMetadata,
  combinedTags: Set<string>,
  locationTags: Set<string>,
): boolean {
  const allTags = new Set([...combinedTags, ...locationTags, sportA.location_type, sportB.location_type]);

  for (const first of allTags) {
    for (const second of allTags) {
      if (first !== second && STRONG_TAG_PAIRS.has(tagPair(first, second))) {
        return true;
      }
    }
  }

  return false;
}

function splitLocationText(location?: string): string[] {
  return location?.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) ?? [];
}

function intensityValue(level: SportIntensityLevel): number {
  if (level === "low") {
    return 1;
  }

  if (level === "medium") {
    return 2;
  }

  return 3;
}

function normalizeSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function intersection(first: Set<string>, second: Set<string>): string[] {
  return [...first].filter((value) => second.has(value)).sort();
}

function hasAny(values: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}

function tagPair(first: string, second: string): string {
  return [first.trim().toLowerCase(), second.trim().toLowerCase()].sort().join("+");
}

function formatList(values: string[]): string {
  return values.sort().join(", ");
}

function sportName(sport: SportMetadata): string {
  return sport.name ?? sport.id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
