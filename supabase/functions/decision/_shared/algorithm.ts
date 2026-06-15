export type ConstellationMode = "single" | "multi_sport" | "twin" | "none";
export type ActivityRole = "primary" | "secondary";
export type ParticipationStatus = "going" | "maybe" | "not_going";
export type ActualAttendanceStatus = "present" | "absent" | "excused" | "unknown";
export type ProfileLocationType = "indoor" | "outdoor" | "water" | "field" | "flexible";
export type ProximityLevel = "same_spot" | "social_radius" | "split_location" | "unknown";
export type ApRequirementLevel = "none" | "required" | "critical";
export type DecisionCharacter =
  | "clear_majority"
  | "fairness_adjusted"
  | "majority_protected"
  | "practicality_adjusted"
  | "weather_adjusted"
  | "combined_event"
  | "split_groups"
  | "fallback"
  | "no_valid_decision";

export type AbstractSport = {
  id: string;
  name?: string;
  category: string;
  intensityLevel?: "low" | "medium" | "high";
  combinableTags?: string[];
};

export type WeatherRules = {
  requiresDry?: boolean;
  rainSensitive?: boolean;
  heatSensitive?: boolean;
  coldSensitive?: boolean;
  thunderstormUnsafe?: boolean;
  maxPrecipitationMm?: number;
  minTemperatureC?: number;
  maxTemperatureC?: number;
  windSensitive?: boolean;
  maxWindKmh?: number;
  requiresDaylight?: boolean;
  slipperyWhenWet?: boolean;
};

export type SportProfile = {
  id: string;
  sportId: string;
  name: string;
  locationName?: string | null;
  postalCode?: string | null;
  venueGroupKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationType: ProfileLocationType;
  isIndoor?: boolean;
  minimumGroupSize?: number;
  maximumGroupSize?: number | null;
  minimumParticipants?: number | null;
  maximumParticipants?: number | null;
  requiredEquipment?: string[];
  availableEquipment?: string[];
  costNote?: string | null;
  costRequired?: boolean | null;
  costPerPerson?: number | null;
  costCurrency?: string | null;
  openingNotes?: string | null;
  lightingAvailable?: boolean | null;
  transitNotes?: string | null;
  amenityNotes?: string | null;
  reservationRequired?: boolean | null;
  safetyNotes?: string | null;
  locationRules?: string | null;
  apRequired?: boolean | null;
  apRequirementLevel?: ApRequirementLevel | null;
  apContactId?: string | null;
  weatherRules?: WeatherRules | null;
  isActive?: boolean;
};

export type SportProposal = {
  sportId: string;
};

export type RankedSportVote = {
  sportId: string;
  userId: string;
  rank?: number | null;
  weight?: number | null;
};

export type SportNoGo = {
  sportId: string;
  userId: string;
  reason?: string | null;
};

export type ParticipationEntry = {
  userId: string;
  status: ParticipationStatus;
  actualStatus?: ActualAttendanceStatus | null;
};

export type PreferenceHistoryEntry = {
  userId: string;
  sportId: string;
  weekStartDate: string;
  wasSelected: boolean;
  votedFor: boolean;
  voteRank?: number | null;
  coveredByDecision?: boolean | null;
  coveredByActivityType?: ConstellationMode | null;
};

export type RecentSelection = {
  sportId: string;
  category: string;
  weekStartDate: string;
  role?: ActivityRole;
};

export type RecentActivitySelection = {
  eventId: string;
  sportId: string;
  sportName?: string;
  category?: string;
  weekStartDate: string;
  role: ActivityRole;
  activityType: ConstellationMode;
};

export type ReliabilityHistoryEntry = {
  userId: string;
  weekStartDate: string;
  plannedStatus: ParticipationStatus;
  actualStatus: ActualAttendanceStatus;
};

export type WeatherCondition = {
  weatherCode?: number | null;
  temperatureC?: number | null;
  precipitationMm?: number | null;
  precipitationProbability?: number | null;
  windSpeedKmh?: number | null;
  windGustsKmh?: number | null;
};

export type ProfileWeatherSnapshot = Record<string, WeatherCondition | undefined>;

export type FairConstellationOptions = {
  maxActivities: number;
  maybeParticipationWeight: number;
  maybePreferenceWeight: number;
  noAttendanceWeight: number;
  preferenceScoreMultiplier: number;
  minimumWinnerVoteScore: number;
  minimumSingleVoteShare: number;
  minimumPrimaryVoteShare: number;
  lowVoteFallbackEnabled: boolean;
  lowVoteTotalThreshold: number;
  neglectBoostPerWeek: number;
  maxFairnessDebt: number;
  noGoPenalty: number;
  singleGoingNoGoPenalty: number;
  singleMaybeNoGoPenalty: number;
  singleGoingNoGoHardBlockThreshold: number;
  singleGoingNoGoHardBlockShare: number;
  minSecondaryVoteScore: number;
  strongSecondaryVoteRatio: number;
  minimumSecondaryUniqueVoters: number;
  smallGroupThreshold: number;
  allowSingleUserSecondaryInSmallGroups: boolean;
  twinScoreMargin: number;
  twinScoreRatio?: number;
  fairnessFirstMargin: number;
  fairnessOverrideWindow: number;
  minimumFairnessOverrideVoteScore: number;
  majorityProtectionVoteShare: number;
  majorityOverrideRequiresFairnessGap: number;
  majorityProtectionMaxPracticalityProblem: number;
  twinFairnessMargin: number;
  socialRadiusKm: number;
  sameSpotRadiusKm: number;
  previousPrimaryCannotRepeatAsPrimary: boolean;
  previousPrimaryAllowedAsSecondary: boolean;
  previousPrimaryPenalty: number;
  recentCategoryPenalty: number;
  recentSecondarySportPenalty: number;
  recentSecondaryCategoryPenalty: number;
  reliabilityPenaltyPerNoShow: number;
  maxReliabilityPenalty: number;
  requiredApMissingPenalty: number;
  criticalApMissingExcludesProfile: boolean;
  apAvailableBonus: number;
};

export type ScoreBreakdown = {
  participation: number;
  preference: number;
  fairness: number;
  minorityProtection: number;
  togetherness: number;
  weather: number;
  practicality: number;
  locationCapacity: number;
  cost: number;
  rotation: number;
  reliability: number;
  noGoPressure: number;
  modeBonus: number;
};

export type CandidateActivity = {
  sportId: string;
  sportName: string;
  profileId: string;
  profileName: string;
  locationName?: string | null;
  role: ActivityRole;
  assignedUserIds: string[];
  participantCount: number;
  activityContactId?: string | null;
  weatherNotes?: string[];
  practicalityNotes?: string[];
};

export type NoGoBreakdown = {
  unresolved: Array<{
    userId: string;
    sportId: string;
    sportName?: string;
    attendanceStatus: "going" | "maybe";
    reason?: string | null;
  }>;
  resolvedByAlternative: Array<{
    userId: string;
    noGoSportId: string;
    noGoSportName?: string;
    assignedSportId: string;
    assignedSportName?: string;
  }>;
  ignoredBecauseNotGoing: Array<{
    userId: string;
    sportId: string;
  }>;
  summary: string;
};

export type DecisionExplainability = {
  voteSummaryBySport: Array<{
    sportId: string;
    sportName?: string;
    weightedVoteScore: number;
    uniqueVoters: number;
    firstChoiceCount: number;
    secondChoiceCount: number;
    thirdChoiceCount: number;
    voteShare: number;
  }>;
  fairnessByUser: Array<{
    userId: string;
    ignoredWeeks: number;
    fairnessDebt: number;
    currentVotedSportIds: string[];
    coveredByDecision: boolean;
    coveredBySportId?: string;
  }>;
  noGoBreakdown: NoGoBreakdown;
  rotationReasons: Array<{
    sportId: string;
    sportName?: string;
    reason: string;
    penalty: number;
    isHardBlockedAsPrimary: boolean;
  }>;
  weatherReasons: Array<{
    profileId: string;
    profileName?: string;
    score: number;
    excluded: boolean;
    reasons: string[];
  }>;
  practicalityReasons: Array<{
    profileId: string;
    profileName?: string;
    score: number;
    reasons: string[];
  }>;
  capacityReasons: Array<{
    profileId: string;
    locationName?: string;
    assignedCount: number;
    minimum?: number;
    maximum?: number | null;
    score: number;
    reason: string;
  }>;
  costReasons: Array<{
    profileId: string;
    costRequired: boolean;
    costPerPerson?: number | null;
    score: number;
    reason: string;
  }>;
};

export type CandidateScore = {
  id: string;
  mode: ConstellationMode;
  activities: CandidateActivity[];
  proximity: ProximityLevel;
  scoreBreakdown: ScoreBreakdown;
  finalScore: number;
  reasonParts: string[];
  primaryVoteScore: number;
  primaryVoteShare: number;
  voteScore: number;
  voteShare: number;
  uniqueVoters: number;
  noGoBreakdown: NoGoBreakdown;
  rotationReasons: DecisionExplainability["rotationReasons"];
  capacityReasons: DecisionExplainability["capacityReasons"];
  hasUnresolvedGoingNoGo: boolean;
  hasHardWeatherRisk: boolean;
  practicalityProblemScore: number;
};

export type ExcludedProfile = {
  profileId: string;
  sportId: string;
  reason: string;
};

export type LosingCandidateReason = {
  candidateId: string;
  mode: ConstellationMode;
  sportIds: string[];
  sportNames?: string[];
  finalScore: number;
  scoreGapToWinner: number;
  keyReasons: string[];
};

export type FairConstellationDecision = {
  mode: ConstellationMode;
  selectedSportId?: string;
  secondarySportId?: string;
  selectedProfileId?: string;
  secondaryProfileId?: string;
  activities: CandidateActivity[];
  scores: CandidateScore[];
  scoreBreakdown?: ScoreBreakdown;
  decisionCharacter: DecisionCharacter;
  explainability: DecisionExplainability;
  noGoBreakdown: NoGoBreakdown;
  losingCandidateReasons: LosingCandidateReason[];
  excludedProfiles: ExcludedProfile[];
  weatherSnapshot?: ProfileWeatherSnapshot;
  reason: string;
};

export type FairConstellationInput = {
  sports: AbstractSport[];
  sportProfiles: SportProfile[];
  proposals: SportProposal[];
  votes: RankedSportVote[];
  noGos?: SportNoGo[];
  attendance?: ParticipationEntry[];
  previousWeekSportId?: string;
  previousWeekPrimarySportId?: string;
  preferenceHistory?: PreferenceHistoryEntry[];
  recentSelections?: RecentSelection[];
  recentActivities?: RecentActivitySelection[];
  reliabilityHistory?: ReliabilityHistoryEntry[];
  weatherSnapshot?: ProfileWeatherSnapshot;
  options?: Partial<FairConstellationOptions>;
};

type ProfileEvaluation = {
  profile: SportProfile;
  weatherScore: number;
  practicalityScore: number;
  costScore: number;
  excluded?: string;
  weatherReasons: string[];
  practicalityReasons: string[];
  costReason: string;
};

type NormalizedInput = FairConstellationInput & {
  options: FairConstellationOptions;
  sportsById: Map<string, AbstractSport>;
  proposedSportIds: Set<string>;
  attendanceByUser: Map<string, ParticipationEntry>;
  noGos: SportNoGo[];
  recentActivities: RecentActivitySelection[];
  previousWeekPrimarySportId?: string;
};

type DecisionContext = {
  input: NormalizedInput;
  eligibleVotes: RankedSportVote[];
  votesBySport: Map<string, RankedSportVote[]>;
  votedSportIds: string[];
  voteSummaryBySport: DecisionExplainability["voteSummaryBySport"];
  totalVoteScore: number;
  eligibleParticipantUserIds: string[];
  fairnessDebtByUser: Map<string, number>;
  fairnessDebtByUserSport: Map<string, number>;
  fairnessWeeksByUser: Map<string, number>;
  reliabilityPenaltyByUser: Map<string, number>;
  lowVoteFallback: boolean;
};

export const DEFAULT_OPTIONS: FairConstellationOptions = {
  // Upper bound for a combined event: a single venue may host several sports at
  // once (e.g. a Strandbad with volleyball + boxing + swimming), each only added
  // when it is co-located and has its own meaningful support.
  maxActivities: 4,
  maybeParticipationWeight: 0.55,
  maybePreferenceWeight: 0.8,
  noAttendanceWeight: 0,
  preferenceScoreMultiplier: 1.25,
  minimumWinnerVoteScore: 1,
  minimumSingleVoteShare: 0.25,
  minimumPrimaryVoteShare: 0.25,
  lowVoteFallbackEnabled: true,
  lowVoteTotalThreshold: 2,
  neglectBoostPerWeek: 0.35,
  maxFairnessDebt: 2,
  noGoPenalty: 2.5,
  singleGoingNoGoPenalty: 3.5,
  singleMaybeNoGoPenalty: 2,
  singleGoingNoGoHardBlockThreshold: 2,
  singleGoingNoGoHardBlockShare: 0.25,
  minSecondaryVoteScore: 1.2,
  strongSecondaryVoteRatio: 0.32,
  minimumSecondaryUniqueVoters: 2,
  smallGroupThreshold: 4,
  allowSingleUserSecondaryInSmallGroups: true,
  twinScoreMargin: 0.82,
  fairnessFirstMargin: 0.55,
  fairnessOverrideWindow: 1.5,
  minimumFairnessOverrideVoteScore: 1.2,
  majorityProtectionVoteShare: 0.6,
  majorityOverrideRequiresFairnessGap: 1.2,
  majorityProtectionMaxPracticalityProblem: 0.6,
  twinFairnessMargin: 0.7,
  socialRadiusKm: 0.75,
  // "Same spot" (one physical venue): 300 m air-line, generous enough that a
  // large facility (e.g. a Strandbad/lido spanning several areas) still counts
  // as one place; stays well below the 750 m social ("Rufnähe") radius.
  sameSpotRadiusKm: 0.3,
  previousPrimaryCannotRepeatAsPrimary: true,
  previousPrimaryAllowedAsSecondary: true,
  previousPrimaryPenalty: 0.85,
  recentCategoryPenalty: 0.35,
  recentSecondarySportPenalty: 0.2,
  recentSecondaryCategoryPenalty: 0.15,
  reliabilityPenaltyPerNoShow: 0.12,
  maxReliabilityPenalty: 0.45,
  requiredApMissingPenalty: 0.8,
  criticalApMissingExcludesProfile: true,
  apAvailableBonus: 0.15,
};

const EMPTY_NO_GO_BREAKDOWN: NoGoBreakdown = {
  unresolved: [],
  resolvedByAlternative: [],
  ignoredBecauseNotGoing: [],
  summary: "Keine No-Go-Konflikte.",
};

export function selectFairConstellation(input: FairConstellationInput): FairConstellationDecision {
  const normalized = normalizeInput(input);
  const context = buildDecisionContext(normalized);

  if (context.votedSportIds.length === 0) {
    return buildNoDecision(
      normalized,
      context,
      [],
      "Keine Entscheidung: Es gibt keine gültigen Stimmen von teilnehmenden oder vielleicht teilnehmenden Mitgliedern.",
    );
  }

  const profileEvaluations = evaluateProfiles(context);
  const excludedProfiles = profileEvaluations
    .filter((evaluation) => evaluation.excluded)
    .map((evaluation) => ({
      profileId: evaluation.profile.id,
      sportId: evaluation.profile.sportId,
      reason: evaluation.excluded ?? "Profil ausgeschlossen.",
    }));
  const candidateDrafts = generateCandidates(context, profileEvaluations.filter((evaluation) => !evaluation.excluded));
  const hardFilteredCandidates = applyHardCandidateFilters(candidateDrafts, context);
  const rankedCandidates = rankCandidates(hardFilteredCandidates, context);
  const winner = rankedCandidates[0];

  if (!winner) {
    return buildNoDecision(
      normalized,
      context,
      excludedProfiles,
      "Keine Entscheidung: Für die vorgeschlagenen Sportarten gibt es kein machbares Sportprofil.",
    );
  }

  return buildDecisionOutput(winner, rankedCandidates, context, profileEvaluations, excludedProfiles);
}

export function calculateFairnessDebt(
  preferenceHistory: PreferenceHistoryEntry[],
  options: Partial<Pick<FairConstellationOptions, "neglectBoostPerWeek" | "maxFairnessDebt">> = {},
): Map<string, number> {
  const boostPerWeek = options.neglectBoostPerWeek ?? DEFAULT_OPTIONS.neglectBoostPerWeek;
  const maxDebt = options.maxFairnessDebt ?? DEFAULT_OPTIONS.maxFairnessDebt;
  const entriesByUser = groupBy(preferenceHistory, (entry) => entry.userId);
  const debtByUser = new Map<string, number>();

  for (const [userId, entries] of entriesByUser) {
    const ignoredWeeks = countIgnoredWeeks(entries);
    debtByUser.set(userId, round(Math.min(ignoredWeeks * boostPerWeek, maxDebt)));
  }

  return debtByUser;
}

function normalizeInput(input: FairConstellationInput): NormalizedInput {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...input.options };
  const options = {
    ...mergedOptions,
    twinScoreMargin: mergedOptions.twinScoreMargin ?? mergedOptions.twinScoreRatio ?? DEFAULT_OPTIONS.twinScoreMargin,
  };
  const sportsById = new Map(input.sports.map((sport) => [sport.id, sport]));
  const proposedSportIds = new Set(input.proposals.map((proposal) => proposal.sportId));
  const attendanceByUser = new Map((input.attendance ?? []).map((entry) => [entry.userId, entry]));
  const recentActivities = normalizeRecentActivities(input);
  const previousWeekPrimarySportId =
    input.previousWeekPrimarySportId ??
    recentActivities.find((activity) => activity.role === "primary")?.sportId ??
    input.previousWeekSportId;

  return {
    ...input,
    options,
    sportsById,
    proposedSportIds,
    attendanceByUser,
    noGos: input.noGos ?? [],
    recentActivities,
    previousWeekPrimarySportId,
  };
}

function normalizeRecentActivities(input: FairConstellationInput): RecentActivitySelection[] {
  if (input.recentActivities?.length) {
    return [...input.recentActivities].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  }

  return (input.recentSelections ?? [])
    .filter((selection) => selection.sportId)
    .map((selection, index): RecentActivitySelection => ({
      eventId: `legacy:${selection.weekStartDate}:${index}`,
      sportId: selection.sportId,
      category: selection.category,
      weekStartDate: selection.weekStartDate,
      role: selection.role ?? "primary",
      activityType: "single",
    }))
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
}

function buildDecisionContext(input: NormalizedInput): DecisionContext {
  const eligibleVotes = input.votes.filter((vote) => {
    const attendance = input.attendanceByUser.get(vote.userId);
    return input.proposedSportIds.has(vote.sportId) && isDecisionParticipant(attendance);
  });
  const votesBySport = groupVotesBySport(eligibleVotes);
  const reliabilityPenaltyByUser = calculateReliabilityPenalties(input.reliabilityHistory ?? [], input.attendance ?? [], input.options);
  const voteSummaryBySport = buildVoteSummary(input, votesBySport, reliabilityPenaltyByUser);
  const totalVoteScore = round(voteSummaryBySport.reduce((total, row) => total + row.weightedVoteScore, 0));
  const votedSportIds = voteSummaryBySport.filter((row) => row.weightedVoteScore > 0).map((row) => row.sportId);
  const fairnessDebtByUser = calculateFairnessDebt(input.preferenceHistory ?? [], input.options);
  const fairnessDebtByUserSport = calculateFairnessDebtByUserSport(input.preferenceHistory ?? [], input.options);
  const fairnessWeeksByUser = calculateFairnessWeeksByUser(input.preferenceHistory ?? []);
  const eligibleParticipantUserIds = collectDecisionParticipantUserIds(input.attendanceByUser, eligibleVotes);

  return {
    input,
    eligibleVotes,
    votesBySport,
    votedSportIds,
    voteSummaryBySport,
    totalVoteScore,
    eligibleParticipantUserIds,
    fairnessDebtByUser,
    fairnessDebtByUserSport,
    fairnessWeeksByUser,
    reliabilityPenaltyByUser,
    lowVoteFallback: input.options.lowVoteFallbackEnabled && totalVoteScore <= input.options.lowVoteTotalThreshold,
  };
}

function evaluateProfiles(context: DecisionContext): ProfileEvaluation[] {
  const activeProfiles = context.input.sportProfiles.filter(
    (profile) => profile.isActive !== false && context.input.proposedSportIds.has(profile.sportId),
  );

  return activeProfiles.map((profile) => {
    const weather = scoreWeather(profile, context.input.weatherSnapshot?.[profile.id]);
    const practicality = scoreBasePracticality(profile, context.input.options);
    const cost = scoreCost(profile);
    const excluded = weather.excluded ?? practicality.excluded;

    return {
      profile,
      weatherScore: weather.score,
      practicalityScore: practicality.score,
      costScore: cost.score,
      excluded,
      weatherReasons: weather.reasons,
      practicalityReasons: practicality.reasons,
      costReason: cost.reason,
    };
  });
}

function generateCandidates(context: DecisionContext, profileEvaluations: ProfileEvaluation[]): CandidateScore[] {
  const profilesBySport = groupProfilesBySport(profileEvaluations);
  const candidates: CandidateScore[] = [];

  for (const sportId of context.votedSportIds) {
    const bestProfile = chooseBestProfileForSport(profilesBySport.get(sportId) ?? [], undefined, context.input.options);
    if (!bestProfile) continue;
    candidates.push(buildCandidate("single", [sportId], [bestProfile], "same_spot", context));
  }

  const rankedSportIds = rankSportIds(context);
  for (let i = 0; i < rankedSportIds.length; i += 1) {
    for (let j = i + 1; j < rankedSportIds.length; j += 1) {
      const pair = orderedSportPair(rankedSportIds[i], rankedSportIds[j], context);
      const [primarySportId, secondarySportId] = pair;
      const profilePair = chooseBestProfilePair(
        profilesBySport.get(primarySportId) ?? [],
        profilesBySport.get(secondarySportId) ?? [],
        context.input.options,
      );
      if (!profilePair) continue;
      const [primaryProfile, secondaryProfile] = profilePair;

      const secondarySupport = sportSupport(secondarySportId, context);
      const primarySupport = sportSupport(primarySportId, context);
      const requiredSecondaryVoters =
        context.eligibleParticipantUserIds.length <= context.input.options.smallGroupThreshold &&
        context.input.options.allowSingleUserSecondaryInSmallGroups
          ? 1
          : context.input.options.minimumSecondaryUniqueVoters;
      const hasMeaningfulSecondGroup =
        secondarySupport.voteScore >= context.input.options.minSecondaryVoteScore &&
        secondarySupport.voteScore >= primarySupport.voteScore * context.input.options.strongSecondaryVoteRatio &&
        secondarySupport.uniqueVoters >= requiredSecondaryVoters;

      if (!hasMeaningfulSecondGroup && !context.lowVoteFallback) {
        continue;
      }

      const proximity = getProfileProximity(primaryProfile.profile, secondaryProfile.profile, context.input.options);
      if (proximity === "same_spot" || proximity === "social_radius") {
        candidates.push(buildCandidate("multi_sport", [primarySportId, secondarySportId], [primaryProfile, secondaryProfile], proximity, context));
      }

      const twinCandidate = buildCandidate(
        "twin",
        [primarySportId, secondarySportId],
        [primaryProfile, secondaryProfile],
        proximity === "unknown" ? "split_location" : proximity,
        context,
      );
      if (twinCandidate.scoreBreakdown.participation >= context.input.options.minSecondaryVoteScore * 2 || context.lowVoteFallback) {
        candidates.push(twinCandidate);
      }
    }
  }

  candidates.push(...generateCombinedCandidates(context, profilesBySport));

  return dedupeCandidates(candidates);
}

// Combined-event candidates with 3+ sports at one place. Anchored at each ranked
// sport, we greedily add further co-located sports (same spot / within calling
// radius) that each clear the "meaningful support" bar, up to maxActivities. The
// pairwise loop already covers single and 2-sport constellations; this only adds
// the larger combinations (e.g. three sports together at a Strandbad).
function generateCombinedCandidates(
  context: DecisionContext,
  profilesBySport: Map<string, ProfileEvaluation[]>,
): CandidateScore[] {
  const options = context.input.options;
  const maxSports = Math.max(2, options.maxActivities);
  if (maxSports < 3) return [];

  const ranked = rankSportIds(context);
  if (ranked.length < 3) return [];

  const requiredSecondaryVoters =
    context.eligibleParticipantUserIds.length <= options.smallGroupThreshold && options.allowSingleUserSecondaryInSmallGroups
      ? 1
      : options.minimumSecondaryUniqueVoters;

  const combined: CandidateScore[] = [];

  for (const anchorSportId of ranked) {
    const anchorProfile = chooseBestProfileForSport(profilesBySport.get(anchorSportId) ?? [], undefined, options);
    if (!anchorProfile) continue;
    const anchorSupport = sportSupport(anchorSportId, context);
    if (anchorSupport.uniqueVoters < 1 && !context.lowVoteFallback) continue;

    const groupSportIds = [anchorSportId];
    const groupProfiles = [anchorProfile];
    let worstProximity: ProximityLevel = "same_spot";

    for (const sportId of ranked) {
      if (groupSportIds.length >= maxSports) break;
      if (groupSportIds.includes(sportId)) continue;

      const profile = chooseBestProfileForSport(profilesBySport.get(sportId) ?? [], anchorProfile.profile, options);
      if (!profile) continue;

      const proximity = getProfileProximity(anchorProfile.profile, profile.profile, options);
      if (proximity !== "same_spot" && proximity !== "social_radius") continue;

      const support = sportSupport(sportId, context);
      const meaningful =
        support.voteScore >= options.minSecondaryVoteScore &&
        support.voteScore >= anchorSupport.voteScore * options.strongSecondaryVoteRatio &&
        support.uniqueVoters >= requiredSecondaryVoters;
      if (!meaningful && !context.lowVoteFallback) continue;

      groupSportIds.push(sportId);
      groupProfiles.push(profile);
      if (proximity === "social_radius") worstProximity = "social_radius";
    }

    if (groupSportIds.length >= 3) {
      combined.push(buildCandidate("multi_sport", groupSportIds, groupProfiles, worstProximity, context));
    }
  }

  return combined;
}

function orderedSportPair(firstSportId: string, secondSportId: string, context: DecisionContext): [string, string] {
  if (firstSportId === context.input.previousWeekPrimarySportId && secondSportId !== context.input.previousWeekPrimarySportId) {
    return [secondSportId, firstSportId];
  }
  return [firstSportId, secondSportId];
}

function applyHardCandidateFilters(candidates: CandidateScore[], context: DecisionContext): CandidateScore[] {
  return candidates.filter((candidate) => {
    const primarySportId = candidate.activities[0]?.sportId;
    if (!primarySportId) return false;

    if (
      context.input.options.previousPrimaryCannotRepeatAsPrimary &&
      context.input.previousWeekPrimarySportId &&
      primarySportId === context.input.previousWeekPrimarySportId
    ) {
      return false;
    }

    if (!context.lowVoteFallback) {
      if (candidate.primaryVoteScore < context.input.options.minimumWinnerVoteScore) return false;
      if (candidate.mode === "single" && candidate.primaryVoteShare < context.input.options.minimumSingleVoteShare) return false;
      if (candidate.mode !== "single" && candidate.primaryVoteShare < context.input.options.minimumPrimaryVoteShare) return false;
    }

    if (candidate.mode === "single") {
      const goingNoGos = candidate.noGoBreakdown.unresolved.filter((entry) => entry.attendanceStatus === "going").length;
      const goingParticipants = Math.max(
        1,
        [...context.input.attendanceByUser.values()].filter((entry) => entry.status === "going").length,
      );
      if (
        goingNoGos >= context.input.options.singleGoingNoGoHardBlockThreshold &&
        goingNoGos / goingParticipants >= context.input.options.singleGoingNoGoHardBlockShare
      ) {
        return false;
      }
    }

    return true;
  });
}

function rankCandidates(candidates: CandidateScore[], context: DecisionContext): CandidateScore[] {
  return [...candidates].sort((a, b) => compareCandidates(a, b, context));
}

function buildDecisionOutput(
  winner: CandidateScore,
  scores: CandidateScore[],
  context: DecisionContext,
  profileEvaluations: ProfileEvaluation[],
  excludedProfiles: ExcludedProfile[],
): FairConstellationDecision {
  const explainability = buildExplainability(winner, context, profileEvaluations);
  const decisionCharacter = classifyDecision(winner, scores, context);

  return {
    mode: winner.mode,
    selectedSportId: winner.activities[0]?.sportId,
    secondarySportId: winner.activities[1]?.sportId,
    selectedProfileId: winner.activities[0]?.profileId,
    secondaryProfileId: winner.activities[1]?.profileId,
    activities: winner.activities,
    scores,
    scoreBreakdown: winner.scoreBreakdown,
    decisionCharacter,
    explainability,
    noGoBreakdown: winner.noGoBreakdown,
    losingCandidateReasons: buildLosingCandidateReasons(winner, scores),
    excludedProfiles,
    weatherSnapshot: context.input.weatherSnapshot,
    reason: buildDecisionReason(winner, decisionCharacter),
  };
}

function buildNoDecision(
  input: NormalizedInput,
  context: DecisionContext,
  excludedProfiles: ExcludedProfile[],
  reason: string,
): FairConstellationDecision {
  const explainability: DecisionExplainability = {
    voteSummaryBySport: context.voteSummaryBySport,
    fairnessByUser: buildFairnessExplainability(context, []),
    noGoBreakdown: EMPTY_NO_GO_BREAKDOWN,
    rotationReasons: [],
    weatherReasons: [],
    practicalityReasons: [],
    capacityReasons: [],
    costReasons: [],
  };

  return {
    mode: "none",
    activities: [],
    scores: [],
    decisionCharacter: "no_valid_decision",
    explainability,
    noGoBreakdown: EMPTY_NO_GO_BREAKDOWN,
    losingCandidateReasons: [],
    excludedProfiles,
    weatherSnapshot: input.weatherSnapshot,
    reason,
  };
}

function buildCandidate(
  mode: ConstellationMode,
  sportIds: string[],
  profileEvaluations: ProfileEvaluation[],
  proximity: ProximityLevel,
  context: DecisionContext,
): CandidateScore {
  const assignments = assignUsersToSports(mode, sportIds, context);
  const activities = sportIds.map((sportId, index): CandidateActivity => {
    const profileEvaluation = profileEvaluations[index];
    const profile = profileEvaluation.profile;
    const assignedUserIds = (assignments.get(sportId) ?? []).sort();
    return {
      sportId,
      sportName: context.input.sportsById.get(sportId)?.name ?? sportId,
      profileId: profile.id,
      profileName: profile.name,
      locationName: profile.locationName,
      role: index === 0 ? "primary" : "secondary",
      assignedUserIds,
      participantCount: assignedUserIds.length,
      activityContactId: profile.apContactId ?? null,
      weatherNotes: profileEvaluation.weatherReasons,
      practicalityNotes: profileEvaluation.practicalityReasons,
    };
  });

  const noGoBreakdown = buildNoGoBreakdown(activities, context);
  const noGoPressure = scoreNoGoPressure(mode, noGoBreakdown, context);
  const participation = scoreParticipation(activities, context);
  const preference = sportIds.reduce((total, sportId) => total + sportSupport(sportId, context).voteScore, 0);
  const fairness = scoreFairness(sportIds, context);
  const minorityProtection = scoreMinorityProtection(sportIds, assignments, context, mode);
  const togetherness = scoreTogetherness(mode, proximity);
  const weather = profileEvaluations.reduce((total, evaluation) => total + evaluation.weatherScore, 0);
  const practicality = profileEvaluations.reduce((total, evaluation) => total + evaluation.practicalityScore, 0);
  const capacity = scoreLocationCapacity(activities, profileEvaluations, context);
  const cost = profileEvaluations.reduce((total, evaluation) => total + evaluation.costScore, 0);
  const rotation = scoreRotation(sportIds, context);
  const reliability = scoreReliability(sportIds, context);
  const modeBonus = mode === "single" ? 0.3 : mode === "multi_sport" ? 0.15 : 0;
  const primarySupport = sportSupport(sportIds[0], context);
  const voteScore = round(sportIds.reduce((total, sportId) => total + sportSupport(sportId, context).voteScore, 0));
  const uniqueVoters = unique(sportIds.flatMap((sportId) => uniqueVotersForSport(sportId, context))).length;
  const scoreBreakdown = roundBreakdown({
    participation,
    preference,
    fairness,
    minorityProtection,
    togetherness,
    weather,
    practicality,
    locationCapacity: capacity.score,
    cost,
    rotation,
    reliability,
    noGoPressure,
    modeBonus,
  });
  const finalScore = round(
    scoreBreakdown.preference * context.input.options.preferenceScoreMultiplier +
      scoreBreakdown.participation +
      scoreBreakdown.fairness +
      scoreBreakdown.minorityProtection +
      scoreBreakdown.togetherness +
      scoreBreakdown.weather +
      scoreBreakdown.practicality +
      scoreBreakdown.locationCapacity +
      scoreBreakdown.cost +
      scoreBreakdown.rotation +
      scoreBreakdown.reliability -
      scoreBreakdown.noGoPressure +
      scoreBreakdown.modeBonus,
  );

  return {
    id: `${mode}:${activities.map((activity) => activity.profileId).join("+")}`,
    mode,
    activities,
    proximity,
    scoreBreakdown,
    finalScore,
    reasonParts: buildCandidateReasonParts(mode, activities, proximity, scoreBreakdown),
    primaryVoteScore: primarySupport.voteScore,
    primaryVoteShare: primarySupport.voteShare,
    voteScore,
    voteShare: context.totalVoteScore > 0 ? round(voteScore / context.totalVoteScore) : 0,
    uniqueVoters,
    noGoBreakdown,
    rotationReasons: buildRotationReasons(sportIds, context),
    capacityReasons: capacity.reasons,
    hasUnresolvedGoingNoGo: noGoBreakdown.unresolved.some((entry) => entry.attendanceStatus === "going"),
    hasHardWeatherRisk: profileEvaluations.some((evaluation) => evaluation.excluded?.includes("Gewitter")),
    practicalityProblemScore: Math.abs(Math.min(0, practicality + capacity.score)),
  };
}

function assignUsersToSports(mode: ConstellationMode, sportIds: string[], context: DecisionContext): Map<string, string[]> {
  const assignments = new Map(sportIds.map((sportId) => [sportId, [] as string[]]));

  if (mode === "single") {
    const sportId = sportIds[0];
    const noGoUsers = new Set(context.input.noGos.filter((noGo) => noGo.sportId === sportId).map((noGo) => noGo.userId));
    assignments.set(
      sportId,
      context.eligibleParticipantUserIds.filter((userId) => !noGoUsers.has(userId)).sort(),
    );
    return assignments;
  }

  const bestVoteByUser = new Map<string, RankedSportVote>();
  for (const sportId of sportIds) {
    const noGoUsers = new Set(context.input.noGos.filter((noGo) => noGo.sportId === sportId).map((noGo) => noGo.userId));
    for (const vote of context.votesBySport.get(sportId) ?? []) {
      if (noGoUsers.has(vote.userId)) continue;
      const previous = bestVoteByUser.get(vote.userId);
      if (!previous || normalizeVoteWeight(vote) > normalizeVoteWeight(previous)) {
        bestVoteByUser.set(vote.userId, vote);
      }
    }
  }

  for (const vote of bestVoteByUser.values()) {
    assignments.get(vote.sportId)?.push(vote.userId);
  }

  return assignments;
}

function scoreWeather(
  profile: SportProfile,
  weather: WeatherCondition | undefined,
): { score: number; excluded?: string; reasons: string[] } {
  const rules = profile.weatherRules ?? {};
  const indoor = isIndoorProfile(profile);
  const reasons: string[] = [];

  if (indoor) {
    return { score: 0.8, reasons: ["Indoor-Profil ist wetterstabil."] };
  }

  if (!hasWeatherLocation(profile)) {
    return {
      score: -5,
      excluded: "Outdoor-Profil ohne Koordinaten oder PLZ ist nicht wetterfaehig.",
      reasons: ["Outdoor-Profil braucht Koordinaten oder PLZ für Wetterbewertung."],
    };
  }

  if (!weather) {
    return { score: -0.35, reasons: ["Wetter konnte noch nicht sicher bewertet werden."] };
  }

  const weatherCode = weather.weatherCode ?? 0;
  const precipitation = weather.precipitationMm ?? 0;
  const precipitationProbability = weather.precipitationProbability ?? 0;
  const temperature = weather.temperatureC;
  const windSpeed = weather.windSpeedKmh ?? weather.windGustsKmh ?? 0;

  if ((rules.thunderstormUnsafe ?? true) && weatherCode >= 95) {
    return { score: -5, excluded: "Gefährliches Gewitterwetter schließt dieses Outdoor-Profil aus.", reasons };
  }

  let score = 0.4;
  if ((rules.requiresDry || rules.rainSensitive) && precipitation > (rules.maxPrecipitationMm ?? 1.5)) {
    score -= 0.85;
    reasons.push("Regen passt nur schlecht zu diesem Profil.");
  } else if (precipitation > 0.5 || precipitationProbability > 65) {
    score -= 0.35;
    reasons.push("Das Wetter ist etwas ungemütlich, aber nicht gefährlich.");
  } else {
    score += 0.35;
    reasons.push("Das Wetter passt zum Outdoor-Profil.");
  }

  if (rules.windSensitive && windSpeed > (rules.maxWindKmh ?? 35)) {
    score -= 0.45;
    reasons.push("Wind passt nur eingeschraenkt zu diesem Profil.");
  }

  if (rules.heatSensitive && typeof temperature === "number" && temperature > (rules.maxTemperatureC ?? 30)) {
    score -= 0.35;
    reasons.push("Hitze reduziert die Eignung.");
  }

  if (rules.coldSensitive && typeof temperature === "number" && temperature < (rules.minTemperatureC ?? 6)) {
    score -= 0.35;
    reasons.push("Kaelte reduziert die Eignung.");
  }

  return { score: round(score), reasons };
}

function scoreBasePracticality(
  profile: SportProfile,
  options: FairConstellationOptions,
): { score: number; excluded?: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0.35;
  const requiredEquipment = normalizeList(profile.requiredEquipment);
  const availableEquipment = new Set(normalizeList(profile.availableEquipment));
  const apRequirementLevel = normalizeApRequirementLevel(profile);

  if (apRequirementLevel === "critical" && !profile.apContactId && options.criticalApMissingExcludesProfile) {
    return {
      score: -5,
      excluded: "Kritischer Ansprechpartner fehlt.",
      reasons: ["Kritischer AP fehlt."],
    };
  }

  if (profile.lightingAvailable) {
    score += 0.12;
    reasons.push("Beleuchtung ist vorhanden.");
  }

  if (profile.openingNotes) {
    score += 0.08;
    reasons.push("Öffnungszeiten sind für dieses Profil dokumentiert.");
  }

  if (profile.transitNotes) {
    score += 0.08;
    reasons.push("Anreise, OePNV oder Parken sind dokumentiert.");
  }

  if (profile.amenityNotes) {
    score += 0.08;
    reasons.push("Infrastruktur wie Wasser, Toiletten oder Umkleiden ist dokumentiert.");
  }

  if (profile.locationRules) {
    score += 0.05;
    reasons.push("Standortregeln sind hinterlegt.");
  }

  if (profile.safetyNotes) {
    score += 0.03;
    reasons.push("Sicherheitsinformationen sind hinterlegt.");
  }

  if (profile.reservationRequired) {
    score -= 0.12;
    reasons.push("Reservierung muss geprüft werden.");
  }

  if (apRequirementLevel === "required" && !profile.apContactId) {
    score -= options.requiredApMissingPenalty;
    reasons.push("Ansprechpartner ist erforderlich, aber noch nicht hinterlegt.");
  } else if (profile.apContactId) {
    score += options.apAvailableBonus;
    reasons.push("Profil-AP ist hinterlegt.");
  }

  if (requiredEquipment.length > 0) {
    const missingEquipment = requiredEquipment.filter((item) => !availableEquipment.has(item));
    if (missingEquipment.length === 0) {
      score += 0.14;
      reasons.push("Nötige Ausstattung ist als verfügbar markiert.");
    } else {
      score -= Math.min(0.4, 0.12 * missingEquipment.length);
      reasons.push(`Ausstattung offen: ${missingEquipment.slice(0, 3).join(", ")}.`);
    }
  }

  return { score: round(score), reasons };
}

function scoreCost(profile: SportProfile): { score: number; reason: string } {
  const costRequired = profile.costRequired ?? Boolean(profile.costNote);
  const costPerPerson = profile.costPerPerson;

  if (!costRequired || costPerPerson === 0) {
    return { score: 0.1, reason: "Keine strukturierten Kosten erforderlich." };
  }

  if (typeof costPerPerson !== "number") {
    return { score: -0.04, reason: "Kostenhinweis vorhanden, aber keine strukturierten Kosten." };
  }

  if (costPerPerson <= 3) return { score: -0.05, reason: "Niedrige Kosten pro Person." };
  if (costPerPerson <= 8) return { score: -0.15, reason: "Moderate Kosten pro Person." };
  if (costPerPerson <= 15) return { score: -0.35, reason: "Spuerbare Kosten pro Person." };
  return { score: -0.65, reason: "Hohe Kosten pro Person." };
}

function buildNoGoBreakdown(activities: CandidateActivity[], context: DecisionContext): NoGoBreakdown {
  const unresolved: NoGoBreakdown["unresolved"] = [];
  const resolvedByAlternative: NoGoBreakdown["resolvedByAlternative"] = [];
  const ignoredBecauseNotGoing: NoGoBreakdown["ignoredBecauseNotGoing"] = [];
  const selectedSportIds = new Set(activities.map((activity) => activity.sportId));

  for (const noGo of context.input.noGos) {
    if (!context.input.proposedSportIds.has(noGo.sportId)) continue;
    const attendance = context.input.attendanceByUser.get(noGo.userId);
    if (!attendance || attendance.status === "not_going") {
      ignoredBecauseNotGoing.push({ userId: noGo.userId, sportId: noGo.sportId });
      continue;
    }

    if (!selectedSportIds.has(noGo.sportId)) continue;

    const noGoActivity = activities.find((activity) => activity.sportId === noGo.sportId);
    const assignedAlternative = activities.find(
      (activity) => activity.sportId !== noGo.sportId && activity.assignedUserIds.includes(noGo.userId),
    );
    const assignedToNoGo = noGoActivity?.assignedUserIds.includes(noGo.userId) ?? false;

    if (assignedAlternative && !assignedToNoGo) {
      resolvedByAlternative.push({
        userId: noGo.userId,
        noGoSportId: noGo.sportId,
        noGoSportName: context.input.sportsById.get(noGo.sportId)?.name,
        assignedSportId: assignedAlternative.sportId,
        assignedSportName: assignedAlternative.sportName,
      });
      continue;
    }

    unresolved.push({
      userId: noGo.userId,
      sportId: noGo.sportId,
      sportName: context.input.sportsById.get(noGo.sportId)?.name,
      attendanceStatus: attendance.status,
      reason: noGo.reason ?? null,
    });
  }

  return {
    unresolved,
    resolvedByAlternative,
    ignoredBecauseNotGoing,
    summary: summarizeNoGos(unresolved.length, resolvedByAlternative.length, ignoredBecauseNotGoing.length),
  };
}

function scoreNoGoPressure(mode: ConstellationMode, noGoBreakdown: NoGoBreakdown, context: DecisionContext): number {
  let penalty = 0;
  for (const entry of noGoBreakdown.unresolved) {
    if (mode === "single") {
      penalty += entry.attendanceStatus === "going" ? context.input.options.singleGoingNoGoPenalty : context.input.options.singleMaybeNoGoPenalty;
    } else {
      penalty += context.input.options.noGoPenalty * (entry.attendanceStatus === "going" ? 1 : context.input.options.maybeParticipationWeight);
    }
  }
  return round(penalty);
}

function scoreParticipation(activities: CandidateActivity[], context: DecisionContext): number {
  let score = 0;
  for (const activity of activities) {
    for (const userId of activity.assignedUserIds) {
      score += participationWeight(context.input.attendanceByUser.get(userId), context.input.options);
    }
  }
  return round(activities.length === 1 ? score * 0.55 : score * 0.75);
}

function scoreFairness(sportIds: string[], context: DecisionContext): number {
  let score = 0;
  for (const sportId of sportIds) {
    for (const userId of uniqueVotersForSport(sportId, context)) {
      score += context.fairnessDebtByUserSport.get(userSportKey(userId, sportId)) ?? 0;
    }
  }
  return round(score);
}

function scoreMinorityProtection(
  sportIds: string[],
  assignments: Map<string, string[]>,
  context: DecisionContext,
  mode: ConstellationMode,
): number {
  if (sportIds.length < 2) return 0;

  const groupSizes = sportIds.map((sportId) => assignments.get(sportId)?.length ?? 0);
  const smallestIndex = groupSizes.indexOf(Math.min(...groupSizes));
  const minoritySportId = sportIds[smallestIndex];
  const minorityUsers = assignments.get(minoritySportId) ?? [];
  const minorityDebt = minorityUsers.reduce(
    (total, userId) =>
      total +
      (context.fairnessDebtByUserSport.get(userSportKey(userId, minoritySportId)) ?? 0) *
        participationWeight(context.input.attendanceByUser.get(userId), context.input.options),
    0,
  );
  const voteScore = sportSupport(minoritySportId, context).voteScore;

  return round((mode === "single" ? 0 : 0.45) + Math.min(1.4, minorityDebt * 0.45 + voteScore * 0.18));
}

function scoreTogetherness(mode: ConstellationMode, proximity: ProximityLevel): number {
  if (mode === "single") return 1.4;
  if (mode === "multi_sport" && proximity === "same_spot") return 1.25;
  if (mode === "multi_sport" && proximity === "social_radius") return 0.9;
  if (mode === "twin") return -0.55;
  return 0;
}

function scoreLocationCapacity(
  activities: CandidateActivity[],
  profileEvaluations: ProfileEvaluation[],
  context: DecisionContext,
): { score: number; reasons: DecisionExplainability["capacityReasons"] } {
  const groups = groupActivitiesByLocation(activities, profileEvaluations, context.input.options);
  const reasons: DecisionExplainability["capacityReasons"] = [];
  let score = 0;

  for (const group of groups) {
    const assignedCount = unique(group.activities.flatMap((activity) => activity.assignedUserIds)).length;
    const minimum = Math.max(...group.profiles.map((profile) => siteMinimum(profile)));
    const maximumValues = group.profiles.map((profile) => siteMaximum(profile)).filter((value): value is number => typeof value === "number");
    const maximum = maximumValues.length ? Math.min(...maximumValues) : null;
    const profile = group.profiles[0];
    let groupScore = 0.35;
    let reason = "Standortkapazitaet passt zur zugeordneten Gruppe.";

    if (assignedCount < minimum) {
      groupScore = -Math.max(1, minimum - assignedCount);
      reason = "Standort-Minimum wird unterschritten.";
    } else if (typeof maximum === "number" && assignedCount > maximum) {
      groupScore = -Math.max(1, assignedCount - maximum);
      reason = "Standort-Maximum wird überschritten.";
    }

    score += groupScore;
    reasons.push({
      profileId: profile.id,
      locationName: profile.locationName ?? undefined,
      assignedCount,
      minimum,
      maximum,
      score: round(groupScore),
      reason,
    });
  }

  return { score: round(score), reasons };
}

function groupActivitiesByLocation(
  activities: CandidateActivity[],
  profileEvaluations: ProfileEvaluation[],
  options: FairConstellationOptions,
): Array<{ activities: CandidateActivity[]; profiles: SportProfile[] }> {
  const groups: Array<{ activities: CandidateActivity[]; profiles: SportProfile[] }> = [];
  const profileById = new Map(profileEvaluations.map((evaluation) => [evaluation.profile.id, evaluation.profile]));

  for (const activity of activities) {
    const profile = profileById.get(activity.profileId);
    if (!profile) continue;
    const group = groups.find((candidateGroup) => {
      const anchor = candidateGroup.profiles[0];
      // Distance-first via getProfileProximity (which only falls back to the
      // venue name when coordinates are missing), so capacity is grouped by the
      // real physical site rather than by a shared name.
      return anchor.id === profile.id || getProfileProximity(anchor, profile, options) === "same_spot";
    });

    if (group) {
      group.activities.push(activity);
      group.profiles.push(profile);
    } else {
      groups.push({ activities: [activity], profiles: [profile] });
    }
  }

  return groups;
}

function scoreRotation(sportIds: string[], context: DecisionContext): number {
  return round(buildRotationReasons(sportIds, context).reduce((total, reason) => total + reason.penalty, 0));
}

function buildRotationReasons(sportIds: string[], context: DecisionContext): DecisionExplainability["rotationReasons"] {
  const reasons: DecisionExplainability["rotationReasons"] = [];
  const previousPrimarySportId = context.input.previousWeekPrimarySportId;
  const recentActivities = context.input.recentActivities.slice(0, 8);
  const recentCategories = recentActivities.map(
    (activity) => activity.category ?? context.input.sportsById.get(activity.sportId)?.category ?? "unknown",
  );

  sportIds.forEach((sportId, index) => {
    const sport = context.input.sportsById.get(sportId);
    if (!sport) return;
    let penalty = 0;
    let reason = "Keine Rotationsanpassung.";
    const isHardBlockedAsPrimary = index === 0 && sportId === previousPrimarySportId;

    if (isHardBlockedAsPrimary) {
      penalty -= context.input.options.previousPrimaryPenalty;
      reason = "Vorwochensport darf nicht erneut Hauptsportart sein.";
    } else if (recentActivities.some((activity) => activity.sportId === sportId && activity.role === "secondary")) {
      penalty -= context.input.options.recentSecondarySportPenalty;
      reason = "Sportart war zuletzt Secondary und bekommt einen leichten Rotationsmalus.";
    } else if (recentCategories.includes(sport.category)) {
      const wasSecondaryCategory = recentActivities.some(
        (activity) => (activity.category ?? context.input.sportsById.get(activity.sportId)?.category) === sport.category && activity.role === "secondary",
      );
      penalty -= wasSecondaryCategory ? context.input.options.recentSecondaryCategoryPenalty : context.input.options.recentCategoryPenalty;
      reason = "Kategorie kam kürzlich vor und bekommt einen Rotationsmalus.";
    }

    if (penalty !== 0 || isHardBlockedAsPrimary) {
      reasons.push({
        sportId,
        sportName: sport.name,
        reason,
        penalty: round(penalty),
        isHardBlockedAsPrimary,
      });
    }
  });

  return reasons;
}

function scoreReliability(sportIds: string[], context: DecisionContext): number {
  let score = 0;
  for (const sportId of sportIds) {
    for (const vote of context.votesBySport.get(sportId) ?? []) {
      score -=
        (context.reliabilityPenaltyByUser.get(vote.userId) ?? 0) *
        normalizeVoteWeight(vote) *
        preferenceAttendanceWeight(context.input.attendanceByUser.get(vote.userId), context.input.options);
    }
  }
  return round(score);
}

function compareCandidates(a: CandidateScore, b: CandidateScore, context: DecisionContext): number {
  const majorityComparison = compareMajorityProtection(a, b, context);
  if (majorityComparison !== 0) return majorityComparison;

  const fairnessComparison = compareFairnessFirst(a, b, context);
  if (fairnessComparison !== 0) return fairnessComparison;

  const twinComparison = compareTwinRestriction(a, b, context);
  if (twinComparison !== 0) return twinComparison;

  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
  if (b.uniqueVoters !== a.uniqueVoters) return b.uniqueVoters - a.uniqueVoters;
  if (a.noGoBreakdown.unresolved.length !== b.noGoBreakdown.unresolved.length) {
    return a.noGoBreakdown.unresolved.length - b.noGoBreakdown.unresolved.length;
  }
  if (b.scoreBreakdown.practicality !== a.scoreBreakdown.practicality) return b.scoreBreakdown.practicality - a.scoreBreakdown.practicality;
  if (b.scoreBreakdown.weather !== a.scoreBreakdown.weather) return b.scoreBreakdown.weather - a.scoreBreakdown.weather;
  if (typePriority(b.mode) !== typePriority(a.mode)) return typePriority(b.mode) - typePriority(a.mode);
  return a.id.localeCompare(b.id);
}

function compareMajorityProtection(a: CandidateScore, b: CandidateScore, context: DecisionContext): number {
  const aProtected = isMajorityProtected(a, context);
  const bProtected = isMajorityProtected(b, context);
  if (aProtected === bProtected) return 0;
  const protectedCandidate = aProtected ? a : b;
  const challenger = aProtected ? b : a;
  const fairnessGap = fairnessPriorityScore(challenger) - fairnessPriorityScore(protectedCandidate);
  const canOverride =
    fairnessGap >= context.input.options.majorityOverrideRequiresFairnessGap &&
    challenger.primaryVoteScore >= context.input.options.minimumFairnessOverrideVoteScore;
  if (canOverride) return 0;
  return aProtected ? -1 : 1;
}

function compareFairnessFirst(a: CandidateScore, b: CandidateScore, context: DecisionContext): number {
  const fairnessGap = fairnessPriorityScore(a) - fairnessPriorityScore(b);
  const scoreGap = a.finalScore - b.finalScore;

  if (
    Math.abs(fairnessGap) >= context.input.options.fairnessFirstMargin &&
    Math.abs(scoreGap) <= context.input.options.fairnessOverrideWindow
  ) {
    const fairer = fairnessGap > 0 ? a : b;
    if (fairer.primaryVoteScore >= context.input.options.minimumFairnessOverrideVoteScore || context.lowVoteFallback) {
      return fairnessGap > 0 ? -1 : 1;
    }
  }

  return 0;
}

function compareTwinRestriction(a: CandidateScore, b: CandidateScore, context: DecisionContext): number {
  if (a.mode === b.mode) return 0;
  const aIsTwin = a.mode === "twin";
  const bIsTwin = b.mode === "twin";
  if (aIsTwin === bIsTwin) return 0;

  const twin = aIsTwin ? a : b;
  const shared = aIsTwin ? b : a;
  const twinFairnessGap = fairnessPriorityScore(twin) - fairnessPriorityScore(shared);
  const twinScoreGap = twin.finalScore - shared.finalScore;
  const twinCanWin = twinFairnessGap >= context.input.options.twinFairnessMargin || twinScoreGap >= context.input.options.twinScoreMargin;

  if (!twinCanWin) {
    return aIsTwin ? 1 : -1;
  }

  return 0;
}

function isMajorityProtected(candidate: CandidateScore, context: DecisionContext): boolean {
  if (candidate.primaryVoteShare < context.input.options.majorityProtectionVoteShare) return false;
  if (candidate.hasUnresolvedGoingNoGo) return false;
  if (candidate.hasHardWeatherRisk) return false;
  if (candidate.practicalityProblemScore > context.input.options.majorityProtectionMaxPracticalityProblem) return false;
  return true;
}

function buildExplainability(
  winner: CandidateScore,
  context: DecisionContext,
  profileEvaluations: ProfileEvaluation[],
): DecisionExplainability {
  return {
    voteSummaryBySport: context.voteSummaryBySport,
    fairnessByUser: buildFairnessExplainability(context, winner.activities),
    noGoBreakdown: winner.noGoBreakdown,
    rotationReasons: winner.rotationReasons,
    weatherReasons: profileEvaluations.map((evaluation) => ({
      profileId: evaluation.profile.id,
      profileName: evaluation.profile.name,
      score: evaluation.weatherScore,
      excluded: Boolean(evaluation.excluded),
      reasons: evaluation.weatherReasons,
    })),
    practicalityReasons: profileEvaluations.map((evaluation) => ({
      profileId: evaluation.profile.id,
      profileName: evaluation.profile.name,
      score: evaluation.practicalityScore,
      reasons: evaluation.practicalityReasons,
    })),
    capacityReasons: winner.capacityReasons,
    costReasons: profileEvaluations.map((evaluation) => ({
      profileId: evaluation.profile.id,
      costRequired: evaluation.profile.costRequired ?? Boolean(evaluation.profile.costNote),
      costPerPerson: evaluation.profile.costPerPerson,
      score: evaluation.costScore,
      reason: evaluation.costReason,
    })),
  };
}

function buildFairnessExplainability(
  context: DecisionContext,
  activities: CandidateActivity[],
): DecisionExplainability["fairnessByUser"] {
  const activityBySport = new Map(activities.map((activity) => [activity.sportId, activity]));
  const votedSportsByUser = new Map<string, string[]>();
  for (const vote of context.eligibleVotes) {
    const next = votedSportsByUser.get(vote.userId) ?? [];
    next.push(vote.sportId);
    votedSportsByUser.set(vote.userId, unique(next));
  }

  return [...votedSportsByUser.entries()].map(([userId, sportIds]) => {
    const coveredSportId = sportIds.find((sportId) => activityBySport.get(sportId)?.assignedUserIds.includes(userId));
    return {
      userId,
      ignoredWeeks: context.fairnessWeeksByUser.get(userId) ?? 0,
      fairnessDebt: context.fairnessDebtByUser.get(userId) ?? 0,
      currentVotedSportIds: sportIds.sort(),
      coveredByDecision: Boolean(coveredSportId),
      coveredBySportId: coveredSportId,
    };
  });
}

function buildLosingCandidateReasons(winner: CandidateScore, scores: CandidateScore[]): LosingCandidateReason[] {
  return scores
    .filter((candidate) => candidate.id !== winner.id)
    .slice(0, 3)
    .map((candidate) => ({
      candidateId: candidate.id,
      mode: candidate.mode,
      sportIds: candidate.activities.map((activity) => activity.sportId),
      sportNames: candidate.activities.map((activity) => activity.sportName),
      finalScore: candidate.finalScore,
      scoreGapToWinner: round(winner.finalScore - candidate.finalScore),
      keyReasons: buildLosingReasons(winner, candidate),
    }));
}

function buildLosingReasons(winner: CandidateScore, candidate: CandidateScore): string[] {
  const reasons: string[] = [];
  if (candidate.finalScore < winner.finalScore) reasons.push("Der Gesamtscore lag unter dem Gewinner.");
  if (candidate.primaryVoteScore < winner.primaryVoteScore) reasons.push("Die Hauptaktivität hatte weniger aktuelle Unterstützung.");
  if (candidate.noGoBreakdown.unresolved.length > winner.noGoBreakdown.unresolved.length) {
    reasons.push("Es blieben mehr No-Go-Konflikte ungelöst.");
  }
  if (candidate.scoreBreakdown.weather < winner.scoreBreakdown.weather) reasons.push("Wetter oder Standort passten schlechter.");
  if (candidate.scoreBreakdown.practicality < winner.scoreBreakdown.practicality) reasons.push("Die Machbarkeit war schwaecher bewertet.");
  return reasons.length ? reasons : ["Der Gewinner lag in den deterministischen Tie-Breaks vorne."];
}

function classifyDecision(winner: CandidateScore, scores: CandidateScore[], context: DecisionContext): DecisionCharacter {
  if (context.lowVoteFallback) return "fallback";
  if (
    isMajorityProtected(winner, context) &&
    (fairnessPriorityScore(winner) > 0 || scores.some((score) => fairnessPriorityScore(score) > fairnessPriorityScore(winner)))
  ) {
    return "majority_protected";
  }
  if (scores.some((score) => score.id !== winner.id && fairnessPriorityScore(winner) - fairnessPriorityScore(score) >= context.input.options.fairnessFirstMargin)) {
    return "fairness_adjusted";
  }
  if (winner.mode === "multi_sport") return "combined_event";
  if (winner.mode === "twin") return "split_groups";
  if (winner.scoreBreakdown.weather < 0) return "weather_adjusted";
  if (winner.scoreBreakdown.practicality + winner.scoreBreakdown.locationCapacity < 0) return "practicality_adjusted";
  if (winner.primaryVoteShare >= context.input.options.majorityProtectionVoteShare) return "clear_majority";
  return "clear_majority";
}

function buildDecisionReason(candidate: CandidateScore, character: DecisionCharacter): string {
  const main = candidate.activities[0];
  const secondary = candidate.activities[1];

  if (!main) return "Keine Entscheidung möglich.";

  if (character === "majority_protected") {
    return `${main.sportName} bleibt vorne, weil die aktuelle Mehrheit klar war und keine starken Gegenfaktoren überwogen.`;
  }

  if (character === "fairness_adjusted") {
    return `${main.sportName} wurde gewählt, weil es genug aktuelle Unterstützung und einen relevanten Fairness-Ausgleich gab.`;
  }

  if (candidate.mode === "single") {
    return `${main.sportName} (${main.profileName}) wurde gewählt, weil diese Konstellation Zustimmung, Fairness, Wetter und Machbarkeit am besten verbindet.`;
  }

  if (candidate.mode === "multi_sport" && secondary) {
    return `${main.sportName} und ${secondary.sportName} wurden als Multi-Sport Event gewählt, weil beide Gruppen Rückhalt haben und die Profile nah genug für ein gemeinsames Club-Event sind.`;
  }

  if (candidate.mode === "twin" && secondary) {
    return `${main.sportName} und ${secondary.sportName} wurden als Twin Event gewählt, weil zwei echte Gruppen entstanden sind und diese Lösung fairer ist als eine Gruppe zu ignorieren.`;
  }

  return candidate.reasonParts.join(" ");
}

function buildCandidateReasonParts(
  mode: ConstellationMode,
  activities: CandidateActivity[],
  proximity: ProximityLevel,
  scoreBreakdown: ScoreBreakdown,
): string[] {
  const parts = [
    `${modeLabel(mode)} mit ${activities.map((activity) => activity.profileName).join(" + ")}.`,
    `Stimmen/Fairness: ${round(scoreBreakdown.preference + scoreBreakdown.fairness)} Punkte.`,
  ];

  if (activities.length > 1) {
    parts.push(
      proximity === "same_spot"
        ? "Die Profile liegen am selben Ort."
        : proximity === "social_radius"
          ? "Die Profile liegen im Social Radius."
          : "Die Gruppen finden getrennt statt.",
    );
  }

  return parts;
}

function buildVoteSummary(
  input: NormalizedInput,
  votesBySport: Map<string, RankedSportVote[]>,
  reliabilityPenaltyByUser: Map<string, number>,
): DecisionExplainability["voteSummaryBySport"] {
  const rows = [...input.proposedSportIds].map((sportId) => {
    const votes = votesBySport.get(sportId) ?? [];
    const weightedVoteScore = sumVoteScore(votes, reliabilityPenaltyByUser, input.attendanceByUser, input.options);
    return {
      sportId,
      sportName: input.sportsById.get(sportId)?.name,
      weightedVoteScore,
      uniqueVoters: uniqueVoters(votes).length,
      firstChoiceCount: votes.filter((vote) => (vote.rank ?? 1) === 1).length,
      secondChoiceCount: votes.filter((vote) => vote.rank === 2).length,
      thirdChoiceCount: votes.filter((vote) => vote.rank === 3).length,
      voteShare: 0,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.weightedVoteScore, 0);
  return rows
    .map((row) => ({ ...row, voteShare: total > 0 ? round(row.weightedVoteScore / total) : 0 }))
    .sort((a, b) => b.weightedVoteScore - a.weightedVoteScore || a.sportId.localeCompare(b.sportId));
}

function calculateFairnessDebtByUserSport(
  preferenceHistory: PreferenceHistoryEntry[],
  options: FairConstellationOptions,
): Map<string, number> {
  const entriesByUserSport = groupBy(preferenceHistory, (entry) => userSportKey(entry.userId, entry.sportId));
  const debt = new Map<string, number>();
  for (const [key, entries] of entriesByUserSport) {
    const ignoredWeeks = countIgnoredWeeks(entries);
    debt.set(key, round(Math.min(ignoredWeeks * options.neglectBoostPerWeek, options.maxFairnessDebt)));
  }
  return debt;
}

function calculateFairnessWeeksByUser(preferenceHistory: PreferenceHistoryEntry[]): Map<string, number> {
  const entriesByUser = groupBy(preferenceHistory, (entry) => entry.userId);
  const weeks = new Map<string, number>();
  for (const [userId, entries] of entriesByUser) {
    weeks.set(userId, countIgnoredWeeks(entries));
  }
  return weeks;
}

function countIgnoredWeeks(entries: PreferenceHistoryEntry[]): number {
  const weeks = groupBy(entries, (entry) => entry.weekStartDate);
  const sortedWeeks = [...weeks.entries()].sort(([a], [b]) => b.localeCompare(a));
  let ignoredWeeks = 0;

  for (const [, weekEntries] of sortedWeeks) {
    const votedEntries = weekEntries.filter((entry) => entry.votedFor);
    if (votedEntries.length === 0) break;
    const covered = votedEntries.some((entry) => entry.coveredByDecision ?? entry.wasSelected);
    if (covered) break;
    ignoredWeeks += 1;
  }

  return ignoredWeeks;
}

function calculateReliabilityPenalties(
  history: ReliabilityHistoryEntry[],
  attendance: ParticipationEntry[],
  options: FairConstellationOptions,
): Map<string, number> {
  const entriesByUser = groupBy(history, (entry) => entry.userId);
  const penalties = new Map<string, number>();

  for (const [userId, entries] of entriesByUser) {
    const recentNoShows = entries
      .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
      .slice(0, 6)
      .filter((entry) => entry.plannedStatus === "going" && entry.actualStatus === "absent").length;
    penalties.set(userId, round(Math.min(recentNoShows * options.reliabilityPenaltyPerNoShow, options.maxReliabilityPenalty)));
  }

  for (const entry of attendance) {
    if (entry.status === "going" && entry.actualStatus === "absent") {
      penalties.set(
        entry.userId,
        round(Math.min((penalties.get(entry.userId) ?? 0) + options.reliabilityPenaltyPerNoShow, options.maxReliabilityPenalty)),
      );
    }
  }

  return penalties;
}

function rankSportIds(context: DecisionContext): string[] {
  return [...context.votedSportIds].sort((a, b) => {
    const aScore = groupSupportScore(a, context);
    const bScore = groupSupportScore(b, context);
    return bScore - aScore || a.localeCompare(b);
  });
}

function groupSupportScore(sportId: string, context: DecisionContext): number {
  const support = sportSupport(sportId, context);
  const debtScore = uniqueVotersForSport(sportId, context).reduce(
    (total, userId) =>
      total +
      (context.fairnessDebtByUserSport.get(userSportKey(userId, sportId)) ?? 0) *
        preferenceAttendanceWeight(context.input.attendanceByUser.get(userId), context.input.options) *
        0.35,
    0,
  );
  return round(support.voteScore + debtScore);
}

function sportSupport(sportId: string, context: DecisionContext): { voteScore: number; voteShare: number; uniqueVoters: number } {
  const row = context.voteSummaryBySport.find((summary) => summary.sportId === sportId);
  return {
    voteScore: row?.weightedVoteScore ?? 0,
    voteShare: row?.voteShare ?? 0,
    uniqueVoters: row?.uniqueVoters ?? 0,
  };
}

function sumVoteScore(
  votes: RankedSportVote[],
  reliabilityPenaltyByUser: Map<string, number>,
  attendanceByUser: Map<string, ParticipationEntry>,
  options: FairConstellationOptions,
): number {
  return round(
    votes.reduce((total, vote) => {
      const reliabilityMultiplier = 1 - (reliabilityPenaltyByUser.get(vote.userId) ?? 0);
      return total + normalizeVoteWeight(vote) * reliabilityMultiplier * preferenceAttendanceWeight(attendanceByUser.get(vote.userId), options);
    }, 0),
  );
}

function normalizeVoteWeight(vote: RankedSportVote): number {
  if (typeof vote.weight === "number" && Number.isFinite(vote.weight)) return Math.max(0, vote.weight);
  if (vote.rank === 1) return 1;
  if (vote.rank === 2) return 0.6;
  if (vote.rank === 3) return 0.3;
  return 1;
}

function participationWeight(attendance: ParticipationEntry | undefined, options: FairConstellationOptions): number {
  if (!attendance) return options.noAttendanceWeight;
  if (attendance.status === "going") return 1;
  if (attendance.status === "maybe") return options.maybeParticipationWeight;
  return 0;
}

function preferenceAttendanceWeight(attendance: ParticipationEntry | undefined, options: FairConstellationOptions): number {
  if (!attendance) return options.noAttendanceWeight;
  if (attendance.status === "going") return 1;
  if (attendance.status === "maybe") return options.maybePreferenceWeight;
  return 0;
}

function isDecisionParticipant(attendance: ParticipationEntry | undefined): boolean {
  return attendance?.status === "going" || attendance?.status === "maybe";
}

function collectDecisionParticipantUserIds(
  attendanceByUser: Map<string, ParticipationEntry>,
  votes: RankedSportVote[],
): string[] {
  const users = new Set<string>();
  for (const vote of votes) {
    if (isDecisionParticipant(attendanceByUser.get(vote.userId))) users.add(vote.userId);
  }
  return [...users].sort();
}

function groupVotesBySport(votes: RankedSportVote[]): Map<string, RankedSportVote[]> {
  const groups = new Map<string, RankedSportVote[]>();
  for (const vote of votes) {
    const next = groups.get(vote.sportId) ?? [];
    next.push(vote);
    groups.set(vote.sportId, next);
  }
  return groups;
}

function groupProfilesBySport(evaluations: ProfileEvaluation[]): Map<string, ProfileEvaluation[]> {
  const groups = new Map<string, ProfileEvaluation[]>();
  for (const evaluation of evaluations) {
    const next = groups.get(evaluation.profile.sportId) ?? [];
    next.push(evaluation);
    groups.set(evaluation.profile.sportId, next);
  }
  return groups;
}

function chooseBestProfileForSport(
  evaluations: ProfileEvaluation[],
  anchor: SportProfile | undefined,
  options: FairConstellationOptions,
): ProfileEvaluation | undefined {
  return [...evaluations].sort((a, b) => {
    const aPairing = anchor ? proximityScore(getProfileProximity(a.profile, anchor, options)) : 0;
    const bPairing = anchor ? proximityScore(getProfileProximity(b.profile, anchor, options)) : 0;
    return (
      bPairing +
        b.weatherScore +
        b.practicalityScore +
        b.costScore -
        (aPairing + a.weatherScore + a.practicalityScore + a.costScore) ||
      a.profile.name.localeCompare(b.profile.name)
    );
  })[0];
}

function chooseBestProfilePair(
  primary: ProfileEvaluation[],
  secondary: ProfileEvaluation[],
  options: FairConstellationOptions,
): [ProfileEvaluation, ProfileEvaluation] | undefined {
  const pairs: Array<[ProfileEvaluation, ProfileEvaluation, number]> = [];

  for (const first of primary) {
    for (const second of secondary) {
      const proximity = getProfileProximity(first.profile, second.profile, options);
      const score =
        first.weatherScore +
        first.practicalityScore +
        first.costScore +
        second.weatherScore +
        second.practicalityScore +
        second.costScore +
        proximityScore(proximity);
      pairs.push([first, second, score]);
    }
  }

  return [...pairs].sort(
    (a, b) =>
      b[2] - a[2] ||
      a[0].profile.name.localeCompare(b[0].profile.name) ||
      a[1].profile.name.localeCompare(b[1].profile.name),
  )[0]?.slice(0, 2) as [ProfileEvaluation, ProfileEvaluation] | undefined;
}

function getProfileProximity(first: SportProfile, second: SportProfile, options: FairConstellationOptions): ProximityLevel {
  if (first.id === second.id) return "same_spot";

  // Distance is the authoritative signal: two venues are the "same spot" only if
  // their coordinates actually sit within the same-spot radius, and within the
  // social ("Rufnähe") radius they count as nearby. This prevents two different
  // places that happen to share a name from being treated as one location.
  const distance = distanceKm(first, second);
  if (typeof distance === "number") {
    if (distance <= options.sameSpotRadiusKm) return "same_spot";
    if (distance <= options.socialRadiusKm) return "social_radius";
    return "split_location";
  }

  // Only when at least one venue has no coordinates do we fall back to the
  // name-derived venue key as a best-effort grouping hint.
  if (first.venueGroupKey && first.venueGroupKey === second.venueGroupKey) return "same_spot";
  return "unknown";
}

function proximityScore(proximity: ProximityLevel): number {
  if (proximity === "same_spot") return 0.75;
  if (proximity === "social_radius") return 0.45;
  if (proximity === "split_location") return -0.2;
  return -0.1;
}

function uniqueVotersForSport(sportId: string, context: DecisionContext): string[] {
  return uniqueVoters(context.votesBySport.get(sportId) ?? []);
}

function uniqueVoters(votes: RankedSportVote[]): string[] {
  return unique(votes.map((vote) => vote.userId)).sort();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function normalizeList(values: string[] | undefined): string[] {
  return (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeApRequirementLevel(profile: SportProfile): ApRequirementLevel {
  if (profile.apRequirementLevel === "critical" || profile.apRequirementLevel === "required" || profile.apRequirementLevel === "none") {
    return profile.apRequirementLevel;
  }
  return profile.apRequired ? "required" : "none";
}

function hasCoordinates(profile: SportProfile): boolean {
  return typeof profile.latitude === "number" && typeof profile.longitude === "number";
}

function hasWeatherLocation(profile: SportProfile): boolean {
  return hasCoordinates(profile) || Boolean(profile.postalCode?.trim());
}

function isIndoorProfile(profile: SportProfile): boolean {
  return Boolean(profile.isIndoor) || profile.locationType === "indoor";
}

function siteMinimum(profile: SportProfile): number {
  return profile.minimumParticipants ?? profile.minimumGroupSize ?? 1;
}

function siteMaximum(profile: SportProfile): number | null {
  return profile.maximumParticipants ?? profile.maximumGroupSize ?? null;
}

function distanceKm(first: SportProfile, second: SportProfile): number | undefined {
  if (!hasCoordinates(first) || !hasCoordinates(second)) return undefined;
  const lat1 = toRadians(first.latitude ?? 0);
  const lat2 = toRadians(second.latitude ?? 0);
  const deltaLat = toRadians((second.latitude ?? 0) - (first.latitude ?? 0));
  const deltaLon = toRadians((second.longitude ?? 0) - (first.longitude ?? 0));
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundBreakdown(score: ScoreBreakdown): ScoreBreakdown {
  return {
    participation: round(score.participation),
    preference: round(score.preference),
    fairness: round(score.fairness),
    minorityProtection: round(score.minorityProtection),
    togetherness: round(score.togetherness),
    weather: round(score.weather),
    practicality: round(score.practicality),
    locationCapacity: round(score.locationCapacity),
    cost: round(score.cost),
    rotation: round(score.rotation),
    reliability: round(score.reliability),
    noGoPressure: round(score.noGoPressure),
    modeBonus: round(score.modeBonus),
  };
}

function fairnessPriorityScore(candidate: CandidateScore): number {
  return round(candidate.scoreBreakdown.fairness + candidate.scoreBreakdown.minorityProtection);
}

function typePriority(mode: ConstellationMode): number {
  if (mode === "single") return 3;
  if (mode === "multi_sport") return 2;
  if (mode === "twin") return 1;
  return 0;
}

function modeLabel(mode: ConstellationMode): string {
  if (mode === "multi_sport") return "Multi-Sport";
  if (mode === "twin") return "Twin Event";
  if (mode === "single") return "Single Event";
  return "Keine Entscheidung";
}

function summarizeNoGos(unresolved: number, resolved: number, ignored: number): string {
  if (unresolved === 0 && resolved === 0 && ignored === 0) return "Keine No-Go-Konflikte.";
  const parts: string[] = [];
  if (resolved > 0) parts.push(`${resolved} No-Go durch Alternative gelöst`);
  if (unresolved > 0) parts.push(`${unresolved} No-Go nicht vollständig gelöst`);
  if (ignored > 0) parts.push(`${ignored} No-Go wegen Nicht-Teilnahme ignoriert`);
  return `${parts.join(", ")}.`;
}

function dedupeCandidates(candidates: CandidateScore[]): CandidateScore[] {
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
}

function userSportKey(userId: string, sportId: string): string {
  return `${userId}:${sportId}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
