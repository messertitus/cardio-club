export type ConstellationMode = "single" | "multi_sport" | "twin" | "none";
export type ActivityRole = "primary" | "secondary";
export type ParticipationStatus = "going" | "maybe" | "not_going";
export type ActualAttendanceStatus = "present" | "absent" | "excused" | "unknown";
export type ProfileLocationType = "indoor" | "outdoor" | "water" | "field" | "flexible";
export type ProximityLevel = "same_spot" | "social_radius" | "split_location" | "unknown";

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
};

export type SportProfile = {
  id: string;
  sportId: string;
  name: string;
  locationName?: string | null;
  venueGroupKey?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationType: ProfileLocationType;
  isIndoor?: boolean;
  minimumGroupSize?: number;
  maximumGroupSize?: number | null;
  requiredEquipment?: string[];
  availableEquipment?: string[];
  costNote?: string | null;
  openingNotes?: string | null;
  lightingAvailable?: boolean | null;
  transitNotes?: string | null;
  amenityNotes?: string | null;
  reservationRequired?: boolean | null;
  safetyNotes?: string | null;
  locationRules?: string | null;
  apRequired?: boolean | null;
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
  noAttendanceWeight: number;
  neglectBoostPerWeek: number;
  maxFairnessDebt: number;
  noGoPenalty: number;
  minSecondaryVoteScore: number;
  strongSecondaryVoteRatio: number;
  twinScoreRatio: number;
  fairnessFirstMargin: number;
  fairnessOverrideWindow: number;
  twinFairnessMargin: number;
  socialRadiusKm: number;
  sameSpotRadiusKm: number;
  previousPrimaryPenalty: number;
  recentCategoryPenalty: number;
  reliabilityPenaltyPerNoShow: number;
  maxReliabilityPenalty: number;
};

export type ScoreBreakdown = {
  participation: number;
  preference: number;
  fairness: number;
  minorityProtection: number;
  togetherness: number;
  weather: number;
  practicality: number;
  rotation: number;
  reliability: number;
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

export type CandidateScore = {
  id: string;
  mode: ConstellationMode;
  activities: CandidateActivity[];
  proximity: ProximityLevel;
  scoreBreakdown: ScoreBreakdown;
  finalScore: number;
  reasonParts: string[];
};

export type ExcludedProfile = {
  profileId: string;
  sportId: string;
  reason: string;
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
  preferenceHistory?: PreferenceHistoryEntry[];
  recentSelections?: RecentSelection[];
  reliabilityHistory?: ReliabilityHistoryEntry[];
  weatherSnapshot?: ProfileWeatherSnapshot;
  options?: Partial<FairConstellationOptions>;
};

type ProfileEvaluation = {
  profile: SportProfile;
  weatherScore: number;
  practicalityScore: number;
  excluded?: string;
  weatherReasons: string[];
  practicalityReasons: string[];
};

const DEFAULT_OPTIONS: FairConstellationOptions = {
  maxActivities: 2,
  maybeParticipationWeight: 0.55,
  noAttendanceWeight: 0,
  neglectBoostPerWeek: 0.35,
  maxFairnessDebt: 2,
  noGoPenalty: 2.5,
  minSecondaryVoteScore: 1.2,
  strongSecondaryVoteRatio: 0.32,
  twinScoreRatio: 0.82,
  fairnessFirstMargin: 0.45,
  fairnessOverrideWindow: 2.2,
  twinFairnessMargin: 0.7,
  socialRadiusKm: 0.75,
  sameSpotRadiusKm: 0.12,
  previousPrimaryPenalty: 0.85,
  recentCategoryPenalty: 0.35,
  reliabilityPenaltyPerNoShow: 0.12,
  maxReliabilityPenalty: 0.45,
};

export function selectFairConstellation(input: FairConstellationInput): FairConstellationDecision {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const sportsById = new Map(input.sports.map((sport) => [sport.id, sport]));
  const proposedSportIds = new Set(input.proposals.map((proposal) => proposal.sportId));
  const activeProfiles = input.sportProfiles.filter((profile) => profile.isActive !== false && proposedSportIds.has(profile.sportId));
  const attendanceByUser = new Map((input.attendance ?? []).map((entry) => [entry.userId, entry]));
  const noGoUsersBySport = groupNoGos(input.noGos ?? [], proposedSportIds);
  const eligibleVotes = input.votes.filter((vote) => {
    const attendance = attendanceByUser.get(vote.userId);
    return proposedSportIds.has(vote.sportId) && isDecisionParticipant(attendance) && !noGoUsersBySport.get(vote.sportId)?.has(vote.userId);
  });
  const votesBySport = groupVotesBySport(eligibleVotes);
  const votedSportIds = [...proposedSportIds].filter((sportId) => (votesBySport.get(sportId) ?? []).length > 0);

  if (votedSportIds.length === 0) {
    return {
      mode: "none",
      activities: [],
      scores: [],
      excludedProfiles: [],
      weatherSnapshot: input.weatherSnapshot,
      reason: "Keine Entscheidung: Es gibt keine gültigen Stimmen von teilnehmenden oder vielleicht teilnehmenden Mitgliedern.",
    };
  }

  const fairnessDebtByUser = calculateFairnessDebt(input.preferenceHistory ?? [], options);
  const reliabilityPenaltyByUser = calculateReliabilityPenalties(input.reliabilityHistory ?? [], input.attendance ?? [], options);
  const profileEvaluations = evaluateProfiles(activeProfiles, input.weatherSnapshot ?? {}, options);
  const excludedProfiles = profileEvaluations
    .filter((evaluation) => evaluation.excluded)
    .map((evaluation) => ({
      profileId: evaluation.profile.id,
      sportId: evaluation.profile.sportId,
      reason: evaluation.excluded ?? "Profil ausgeschlossen.",
    }));
  const profilesBySport = groupProfilesBySport(profileEvaluations.filter((evaluation) => !evaluation.excluded));

  const candidates: CandidateScore[] = [];

  for (const sportId of votedSportIds) {
    const bestProfile = chooseBestProfileForSport(profilesBySport.get(sportId) ?? [], [sportId], undefined);
    if (!bestProfile) continue;
    candidates.push(
      buildCandidate({
        mode: "single",
        sportIds: [sportId],
        profileEvaluations: [bestProfile],
        sportsById,
        votesBySport,
        noGoUsersBySport,
        attendanceByUser,
        fairnessDebtByUser,
        reliabilityPenaltyByUser,
        recentSelections: input.recentSelections ?? [],
        previousWeekSportId: input.previousWeekSportId,
        proximity: "same_spot",
        options,
      }),
    );
  }

  const rankedSportIds = rankSportIds(votedSportIds, votesBySport, fairnessDebtByUser, reliabilityPenaltyByUser, attendanceByUser, options);
  for (let i = 0; i < rankedSportIds.length; i += 1) {
    for (let j = i + 1; j < rankedSportIds.length; j += 1) {
      const firstSportId = rankedSportIds[i];
      const secondSportId = rankedSportIds[j];
      const profilePair = chooseBestProfilePair(profilesBySport.get(firstSportId) ?? [], profilesBySport.get(secondSportId) ?? [], options);
      if (!profilePair) continue;

      const [firstProfile, secondProfile] = profilePair;
      const proximity = getProfileProximity(firstProfile.profile, secondProfile.profile, options);
      const firstScore = groupSupportScore(firstSportId, votesBySport, fairnessDebtByUser, reliabilityPenaltyByUser, attendanceByUser, options);
      const secondScore = groupSupportScore(secondSportId, votesBySport, fairnessDebtByUser, reliabilityPenaltyByUser, attendanceByUser, options);
      const hasMeaningfulSecondGroup =
        secondScore >= options.minSecondaryVoteScore && secondScore >= firstScore * options.strongSecondaryVoteRatio;

      if (!hasMeaningfulSecondGroup) {
        continue;
      }

      if (proximity === "same_spot" || proximity === "social_radius") {
        candidates.push(
          buildCandidate({
            mode: "multi_sport",
            sportIds: [firstSportId, secondSportId],
            profileEvaluations: [firstProfile, secondProfile],
            sportsById,
            votesBySport,
            noGoUsersBySport,
            attendanceByUser,
            fairnessDebtByUser,
            reliabilityPenaltyByUser,
            recentSelections: input.recentSelections ?? [],
            previousWeekSportId: input.previousWeekSportId,
            proximity,
            options,
          }),
        );
      }

      const twinCandidate = buildCandidate({
        mode: "twin",
        sportIds: [firstSportId, secondSportId],
        profileEvaluations: [firstProfile, secondProfile],
        sportsById,
        votesBySport,
        noGoUsersBySport,
        attendanceByUser,
        fairnessDebtByUser,
        reliabilityPenaltyByUser,
        recentSelections: input.recentSelections ?? [],
        previousWeekSportId: input.previousWeekSportId,
        proximity: proximity === "unknown" ? "split_location" : proximity,
        options,
      });

      if (twinCandidate.scoreBreakdown.participation >= options.minSecondaryVoteScore * 2) {
        candidates.push(twinCandidate);
      }
    }
  }

  const scores = candidates.sort((a, b) => compareCandidates(a, b, options));
  const winner = scores[0];

  if (!winner) {
    return {
      mode: "none",
      activities: [],
      scores: [],
      excludedProfiles,
      weatherSnapshot: input.weatherSnapshot,
      reason: "Keine Entscheidung: Für die vorgeschlagenen Sportarten gibt es kein machbares Sportprofil.",
    };
  }

  return {
    mode: winner.mode,
    selectedSportId: winner.activities[0]?.sportId,
    secondarySportId: winner.activities[1]?.sportId,
    selectedProfileId: winner.activities[0]?.profileId,
    secondaryProfileId: winner.activities[1]?.profileId,
    activities: winner.activities,
    scores,
    scoreBreakdown: winner.scoreBreakdown,
    excludedProfiles,
    weatherSnapshot: input.weatherSnapshot,
    reason: buildDecisionReason(winner),
  };
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

    debtByUser.set(userId, round(Math.min(ignoredWeeks * boostPerWeek, maxDebt)));
  }

  return debtByUser;
}

function evaluateProfiles(
  profiles: SportProfile[],
  weatherSnapshot: ProfileWeatherSnapshot,
  options: FairConstellationOptions,
): ProfileEvaluation[] {
  return profiles.map((profile) => {
    const weather = scoreWeather(profile, weatherSnapshot[profile.id]);
    const practicality = scoreBasePracticality(profile);

    return {
      profile,
      weatherScore: weather.score,
      practicalityScore: practicality.score,
      excluded: weather.excluded,
      weatherReasons: weather.reasons,
      practicalityReasons: practicality.reasons,
    };
  });
}

function scoreWeather(
  profile: SportProfile,
  weather: WeatherCondition | undefined,
): { score: number; excluded?: string; reasons: string[] } {
  const rules = profile.weatherRules ?? {};
  const indoor = profile.isIndoor || profile.locationType === "indoor";
  const reasons: string[] = [];

  if (indoor) {
    return { score: 0.8, reasons: ["Indoor-Profil ist wetterstabil."] };
  }

  if (!hasCoordinates(profile) || !weather) {
    return { score: -0.35, reasons: ["Wetter konnte mangels Koordinaten oder Wetterdaten nicht sicher bewertet werden."] };
  }

  const weatherCode = weather.weatherCode ?? 0;
  const precipitation = weather.precipitationMm ?? 0;
  const precipitationProbability = weather.precipitationProbability ?? 0;
  const temperature = weather.temperatureC;

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

  if (rules.heatSensitive && typeof temperature === "number" && temperature > (rules.maxTemperatureC ?? 30)) {
    score -= 0.35;
    reasons.push("Hitze reduziert die Eignung.");
  }

  if (rules.coldSensitive && typeof temperature === "number" && temperature < (rules.minTemperatureC ?? 6)) {
    score -= 0.35;
    reasons.push("Kälte reduziert die Eignung.");
  }

  return { score: round(score), reasons };
}

function scoreBasePracticality(profile: SportProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0.35;
  const requiredEquipment = normalizeList(profile.requiredEquipment);
  const availableEquipment = new Set(normalizeList(profile.availableEquipment));

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
    reasons.push("Anreise, ÖPNV oder Parken sind dokumentiert.");
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

  if (profile.costNote) {
    score -= 0.04;
    reasons.push("Kosten müssen berücksichtigt werden.");
  }

  if (profile.reservationRequired) {
    score -= 0.12;
    reasons.push("Reservierung muss geprüft werden.");
  }

  if (profile.apRequired && profile.apContactId) {
    score += 0.12;
    reasons.push("Ansprechpartner ist für dieses Profil hinterlegt.");
  } else if (profile.apRequired) {
    score -= 0.18;
    reasons.push("Ansprechpartner vor Ort wird benötigt, ist aber noch nicht profilbezogen hinterlegt.");
  } else if (profile.apContactId) {
    score += 0.06;
    reasons.push("Profil-AP ist hinterlegt.");
  }

  if (requiredEquipment.length > 0) {
    const missingEquipment = requiredEquipment.filter((item) => !availableEquipment.has(item));
    if (missingEquipment.length === 0) {
      score += 0.14;
      reasons.push("Noetige Ausstattung ist als verfuegbar markiert.");
    } else {
      score -= Math.min(0.4, 0.12 * missingEquipment.length);
      reasons.push(`Ausstattung offen: ${missingEquipment.slice(0, 3).join(", ")}.`);
    }
  }

  if (!profile.isIndoor && profile.locationType !== "indoor" && !hasCoordinates(profile)) {
    score -= 0.12;
    reasons.push("Koordinaten fehlen, daher sind Wetter und Naehe weniger belastbar.");
  }

  return { score: round(score), reasons };
}

function buildCandidate({
  mode,
  sportIds,
  profileEvaluations,
  sportsById,
  votesBySport,
  noGoUsersBySport,
  attendanceByUser,
  fairnessDebtByUser,
  reliabilityPenaltyByUser,
  recentSelections,
  previousWeekSportId,
  proximity,
  options,
}: {
  mode: ConstellationMode;
  sportIds: string[];
  profileEvaluations: ProfileEvaluation[];
  sportsById: Map<string, AbstractSport>;
  votesBySport: Map<string, RankedSportVote[]>;
  noGoUsersBySport: Map<string, Set<string>>;
  attendanceByUser: Map<string, ParticipationEntry>;
  fairnessDebtByUser: Map<string, number>;
  reliabilityPenaltyByUser: Map<string, number>;
  recentSelections: RecentSelection[];
  previousWeekSportId?: string;
  proximity: ProximityLevel;
  options: FairConstellationOptions;
}): CandidateScore {
  const assignments = assignUsersToSports(sportIds, votesBySport, noGoUsersBySport);
  const allEligibleUsers = collectEligibleUserIds(votesBySport, noGoUsersBySport, attendanceByUser);
  const activities = sportIds.map((sportId, index): CandidateActivity => {
    const profile = profileEvaluations[index].profile;
    const assignedUserIds = mode === "single"
      ? allEligibleUsers.filter((userId) => !noGoUsersBySport.get(sportId)?.has(userId)).sort()
      : (assignments.get(sportId) ?? []).sort();
    return {
      sportId,
      sportName: sportsById.get(sportId)?.name ?? sportId,
      profileId: profile.id,
      profileName: profile.name,
      locationName: profile.locationName,
      role: index === 0 ? "primary" : "secondary",
      assignedUserIds,
      participantCount: assignedUserIds.length,
      activityContactId: profile.apContactId ?? null,
      weatherNotes: profileEvaluations[index].weatherReasons,
      practicalityNotes: profileEvaluations[index].practicalityReasons,
    };
  });

  const participation = scoreParticipation(activities, attendanceByUser, profileEvaluations, mode, options);
  const preference = sportIds.reduce(
    (total, sportId) => total + sumVoteScore(votesBySport.get(sportId) ?? [], reliabilityPenaltyByUser, attendanceByUser, options),
    0,
  );
  const fairness = scoreFairness(sportIds, votesBySport, assignments, fairnessDebtByUser, mode);
  const minorityProtection = scoreMinorityProtection(sportIds, votesBySport, assignments, fairnessDebtByUser, attendanceByUser, mode, options);
  const togetherness = scoreTogetherness(mode, proximity);
  const weather = profileEvaluations.reduce((total, evaluation) => total + evaluation.weatherScore, 0);
  const practicality = profileEvaluations.reduce((total, evaluation) => total + evaluation.practicalityScore, 0) +
    scoreActivityGroupSizes(activities, profileEvaluations);
  const rotation = scoreRotation(sportIds, sportsById, recentSelections, previousWeekSportId, mode, options);
  const reliability = scoreReliability(sportIds, votesBySport, reliabilityPenaltyByUser, attendanceByUser, options);
  const noGoPenalty = scoreNoGoPressure(activities, noGoUsersBySport, attendanceByUser, options);

  const scoreBreakdown = roundBreakdown({
    participation,
    preference,
    fairness,
    minorityProtection,
    togetherness,
    weather,
    practicality,
    rotation,
    reliability: reliability - noGoPenalty,
  });
  const finalScore = round(
    Object.values(scoreBreakdown).reduce((total, value) => total + value, 0) +
      (mode === "single" ? 0.3 : mode === "multi_sport" ? 0.15 : 0),
  );

  return {
    id: `${mode}:${activities.map((activity) => activity.profileId).join("+")}`,
    mode,
    activities,
    proximity,
    scoreBreakdown,
    finalScore,
    reasonParts: buildCandidateReasonParts(mode, activities, proximity, scoreBreakdown),
  };
}

function scoreParticipation(
  activities: CandidateActivity[],
  attendanceByUser: Map<string, ParticipationEntry>,
  profileEvaluations: ProfileEvaluation[],
  mode: ConstellationMode,
  options: FairConstellationOptions,
): number {
  let score = 0;

  for (let index = 0; index < activities.length; index += 1) {
    const activity = activities[index];
    const profile = profileEvaluations[index].profile;
    const minGroup = profile.minimumGroupSize ?? 1;
    const maxGroup = profile.maximumGroupSize ?? Number.POSITIVE_INFINITY;

    for (const userId of activity.assignedUserIds) {
      score += participationWeight(attendanceByUser.get(userId), options);
    }

    if (activity.participantCount < minGroup) {
      score -= Math.max(1, minGroup - activity.participantCount);
    }

    if (activity.participantCount > maxGroup) {
      score -= Math.max(1, activity.participantCount - maxGroup);
    }
  }

  return round(mode === "single" ? score * 0.55 : score * 0.75);
}

function scoreFairness(
  sportIds: string[],
  votesBySport: Map<string, RankedSportVote[]>,
  assignments: Map<string, string[]>,
  fairnessDebtByUser: Map<string, number>,
  mode: ConstellationMode,
): number {
  let score = 0;

  for (const sportId of sportIds) {
    const assigned = mode === "single" ? uniqueVoters(votesBySport.get(sportId) ?? []) : assignments.get(sportId) ?? [];
    for (const userId of assigned) {
      score += fairnessDebtByUser.get(userId) ?? 0;
    }
  }

  return round(score);
}

function scoreMinorityProtection(
  sportIds: string[],
  votesBySport: Map<string, RankedSportVote[]>,
  assignments: Map<string, string[]>,
  fairnessDebtByUser: Map<string, number>,
  attendanceByUser: Map<string, ParticipationEntry>,
  mode: ConstellationMode,
  options: FairConstellationOptions,
): number {
  if (sportIds.length < 2) {
    return 0;
  }

  const groupSizes = sportIds.map((sportId) => assignments.get(sportId)?.length ?? uniqueVoters(votesBySport.get(sportId) ?? []).length);
  const smallestIndex = groupSizes.indexOf(Math.min(...groupSizes));
  const minoritySportId = sportIds[smallestIndex];
  const minorityUsers = assignments.get(minoritySportId) ?? uniqueVoters(votesBySport.get(minoritySportId) ?? []);
  const minorityDebt = minorityUsers.reduce(
    (total, userId) => total + (fairnessDebtByUser.get(userId) ?? 0) * participationWeight(attendanceByUser.get(userId), options),
    0,
  );
  const voteScore = sumVoteScore(votesBySport.get(minoritySportId) ?? [], new Map(), attendanceByUser, options);

  return round((mode === "single" ? 0 : 0.45) + Math.min(1.4, minorityDebt * 0.45 + voteScore * 0.18));
}

function scoreTogetherness(mode: ConstellationMode, proximity: ProximityLevel): number {
  if (mode === "single") return 1.4;
  if (mode === "multi_sport" && proximity === "same_spot") return 1.25;
  if (mode === "multi_sport" && proximity === "social_radius") return 0.9;
  if (mode === "twin") return -0.55;
  return 0;
}

function scoreActivityGroupSizes(activities: CandidateActivity[], profileEvaluations: ProfileEvaluation[]): number {
  let score = 0;

  for (let index = 0; index < activities.length; index += 1) {
    const activity = activities[index];
    const profile = profileEvaluations[index].profile;
    const minGroup = profile.minimumGroupSize ?? 1;
    const maxGroup = profile.maximumGroupSize ?? Number.POSITIVE_INFINITY;

    if (activity.participantCount >= minGroup && activity.participantCount <= maxGroup) {
      score += 0.35;
    } else {
      score -= 1;
    }
  }

  return score;
}

function scoreRotation(
  sportIds: string[],
  sportsById: Map<string, AbstractSport>,
  recentSelections: RecentSelection[],
  previousWeekSportId: string | undefined,
  mode: ConstellationMode,
  options: FairConstellationOptions,
): number {
  let score = 0;
  const previousCategory = previousWeekSportId ? sportsById.get(previousWeekSportId)?.category : undefined;
  const recentCategories = recentSelections.slice(0, 4).map((selection) => selection.category);

  sportIds.forEach((sportId, index) => {
    const sport = sportsById.get(sportId);
    if (!sport) return;

    if (sportId === previousWeekSportId) {
      score -= index === 0 ? options.previousPrimaryPenalty : options.previousPrimaryPenalty * 0.35;
    } else if (sport.category === previousCategory && mode === "single") {
      score -= options.recentCategoryPenalty;
    } else if (recentCategories.includes(sport.category)) {
      score -= options.recentCategoryPenalty * 0.5;
    }
  });

  return round(score);
}

function scoreReliability(
  sportIds: string[],
  votesBySport: Map<string, RankedSportVote[]>,
  reliabilityPenaltyByUser: Map<string, number>,
  attendanceByUser: Map<string, ParticipationEntry>,
  options: FairConstellationOptions,
): number {
  let score = 0;

  for (const sportId of sportIds) {
    for (const vote of votesBySport.get(sportId) ?? []) {
      score -= (reliabilityPenaltyByUser.get(vote.userId) ?? 0) * normalizeVoteWeight(vote) * participationWeight(attendanceByUser.get(vote.userId), options);
    }
  }

  return round(score);
}

function scoreNoGoPressure(
  activities: CandidateActivity[],
  noGoUsersBySport: Map<string, Set<string>>,
  attendanceByUser: Map<string, ParticipationEntry>,
  options: FairConstellationOptions,
): number {
  let penalty = 0;

  for (const activity of activities) {
    const noGos = noGoUsersBySport.get(activity.sportId) ?? new Set<string>();
    for (const userId of noGos) {
      const attendanceWeight = participationWeight(attendanceByUser.get(userId), options);
      if (attendanceWeight <= 0) continue;

      const hasAlternativeActivity = activities.some(
        (candidateActivity) => candidateActivity.sportId !== activity.sportId && candidateActivity.assignedUserIds.includes(userId),
      );
      if (!hasAlternativeActivity) {
        penalty += options.noGoPenalty * attendanceWeight;
      }
    }
  }

  return penalty;
}

function assignUsersToSports(
  sportIds: string[],
  votesBySport: Map<string, RankedSportVote[]>,
  noGoUsersBySport: Map<string, Set<string>>,
): Map<string, string[]> {
  const bestVoteByUser = new Map<string, RankedSportVote>();

  for (const sportId of sportIds) {
    for (const vote of votesBySport.get(sportId) ?? []) {
      if (noGoUsersBySport.get(sportId)?.has(vote.userId)) continue;
      const previous = bestVoteByUser.get(vote.userId);
      if (!previous || normalizeVoteWeight(vote) > normalizeVoteWeight(previous)) {
        bestVoteByUser.set(vote.userId, vote);
      }
    }
  }

  const assignments = new Map(sportIds.map((sportId) => [sportId, [] as string[]]));
  for (const vote of bestVoteByUser.values()) {
    assignments.get(vote.sportId)?.push(vote.userId);
  }

  return assignments;
}

function chooseBestProfileForSport(
  evaluations: ProfileEvaluation[],
  sportIds: string[],
  anchor?: SportProfile,
): ProfileEvaluation | undefined {
  return [...evaluations].sort((a, b) => {
    const aPairing = anchor ? proximityScore(getProfileProximity(a.profile, anchor, DEFAULT_OPTIONS)) : 0;
    const bPairing = anchor ? proximityScore(getProfileProximity(b.profile, anchor, DEFAULT_OPTIONS)) : 0;
    return (
      bPairing + b.weatherScore + b.practicalityScore - (aPairing + a.weatherScore + a.practicalityScore) ||
      a.profile.name.localeCompare(b.profile.name) ||
      sportIds.length
    );
  })[0];
}

function chooseBestProfilePair(
  first: ProfileEvaluation[],
  second: ProfileEvaluation[],
  options: FairConstellationOptions,
): [ProfileEvaluation, ProfileEvaluation] | undefined {
  const pairs: Array<[ProfileEvaluation, ProfileEvaluation, number]> = [];

  for (const a of first) {
    for (const b of second) {
      const proximity = getProfileProximity(a.profile, b.profile, options);
      const score = a.weatherScore + a.practicalityScore + b.weatherScore + b.practicalityScore + proximityScore(proximity);
      pairs.push([a, b, score]);
    }
  }

  pairs.sort((a, b) => b[2] - a[2] || a[0].profile.name.localeCompare(b[0].profile.name));
  const winner = pairs[0];
  return winner ? [winner[0], winner[1]] : undefined;
}

function getProfileProximity(first: SportProfile, second: SportProfile, options: FairConstellationOptions): ProximityLevel {
  if (first.id === second.id) return "same_spot";
  if (first.venueGroupKey && first.venueGroupKey === second.venueGroupKey) return "same_spot";

  const distance = distanceKm(first, second);
  if (typeof distance !== "number") return "unknown";
  if (distance <= options.sameSpotRadiusKm) return "same_spot";
  if (distance <= options.socialRadiusKm) return "social_radius";
  return "split_location";
}

function proximityScore(proximity: ProximityLevel): number {
  if (proximity === "same_spot") return 0.75;
  if (proximity === "social_radius") return 0.45;
  if (proximity === "split_location") return -0.2;
  return -0.1;
}

function compareCandidates(a: CandidateScore, b: CandidateScore, options: FairConstellationOptions): number {
  const fairnessComparison = compareFairnessFirst(a, b, options);
  if (fairnessComparison !== 0) return fairnessComparison;

  const togethernessComparison = compareTogethernessPreference(a, b, options);
  if (togethernessComparison !== 0) return togethernessComparison;

  if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
  if (typePriority(b.mode) !== typePriority(a.mode)) return typePriority(b.mode) - typePriority(a.mode);
  return a.id.localeCompare(b.id);
}

function compareFairnessFirst(a: CandidateScore, b: CandidateScore, options: FairConstellationOptions): number {
  const aFairness = fairnessPriorityScore(a);
  const bFairness = fairnessPriorityScore(b);
  const fairnessGap = aFairness - bFairness;
  const scoreGap = a.finalScore - b.finalScore;

  if (Math.abs(fairnessGap) >= options.fairnessFirstMargin && Math.abs(scoreGap) <= options.fairnessOverrideWindow) {
    return fairnessGap > 0 ? -1 : 1;
  }

  return 0;
}

function compareTogethernessPreference(a: CandidateScore, b: CandidateScore, options: FairConstellationOptions): number {
  if (a.mode === b.mode) return 0;

  const aIsTwin = a.mode === "twin";
  const bIsTwin = b.mode === "twin";
  if (aIsTwin !== bIsTwin) {
    const twin = aIsTwin ? a : b;
    const shared = aIsTwin ? b : a;
    const twinFairnessGap = fairnessPriorityScore(twin) - fairnessPriorityScore(shared);
    const twinScoreGap = twin.finalScore - shared.finalScore;
    const twinCanWin = twinFairnessGap >= options.twinFairnessMargin || twinScoreGap >= options.twinScoreRatio;

    if (!twinCanWin) {
      return aIsTwin ? 1 : -1;
    }
  }

  if (Math.abs(a.finalScore - b.finalScore) <= 0.35 && Math.abs(fairnessPriorityScore(a) - fairnessPriorityScore(b)) <= 0.35) {
    return typePriority(a.mode) > typePriority(b.mode) ? -1 : 1;
  }

  return 0;
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
    parts.push(proximity === "same_spot" ? "Die Profile liegen am selben Ort." : proximity === "social_radius" ? "Die Profile liegen im Social Radius." : "Die Gruppen finden getrennt statt.");
  }

  return parts;
}

function buildDecisionReason(candidate: CandidateScore): string {
  const main = candidate.activities[0];
  const secondary = candidate.activities[1];

  if (!main) {
    return "Keine Entscheidung möglich.";
  }

  if (candidate.mode === "single") {
    return `${main.sportName} (${main.profileName}) wurde gewählt, weil diese Konstellation Zustimmung, Fairness, Wetter und Machbarkeit am besten verbindet.`;
  }

  if (candidate.mode === "multi_sport" && secondary) {
    return `${main.sportName} und ${secondary.sportName} wurden als Multi-Sport Event gewählt, weil beide Gruppen starken Rückhalt haben und die Profile räumlich nah genug für ein gemeinsames Club-Event sind.`;
  }

  if (candidate.mode === "twin" && secondary) {
    return `${main.sportName} und ${secondary.sportName} wurden als Twin Event gewählt, weil zwei echte Gruppen entstanden sind und diese Lösung fairer ist als eine Gruppe zu ignorieren.`;
  }

  return candidate.reasonParts.join(" ");
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

function rankSportIds(
  sportIds: string[],
  votesBySport: Map<string, RankedSportVote[]>,
  fairnessDebtByUser: Map<string, number>,
  reliabilityPenaltyByUser: Map<string, number>,
  attendanceByUser: Map<string, ParticipationEntry>,
  options: FairConstellationOptions,
): string[] {
  return [...sportIds].sort((a, b) => {
    const aScore = groupSupportScore(a, votesBySport, fairnessDebtByUser, reliabilityPenaltyByUser, attendanceByUser, options);
    const bScore = groupSupportScore(b, votesBySport, fairnessDebtByUser, reliabilityPenaltyByUser, attendanceByUser, options);
    return bScore - aScore || a.localeCompare(b);
  });
}

function groupSupportScore(
  sportId: string,
  votesBySport: Map<string, RankedSportVote[]>,
  fairnessDebtByUser: Map<string, number>,
  reliabilityPenaltyByUser: Map<string, number>,
  attendanceByUser: Map<string, ParticipationEntry>,
  options: FairConstellationOptions,
): number {
  const votes = votesBySport.get(sportId) ?? [];
  const voteScore = sumVoteScore(votes, reliabilityPenaltyByUser, attendanceByUser, options);
  const debtScore = uniqueVoters(votes).reduce(
    (total, userId) => total + (fairnessDebtByUser.get(userId) ?? 0) * participationWeight(attendanceByUser.get(userId), options) * 0.35,
    0,
  );
  return round(voteScore + debtScore);
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
      return total + normalizeVoteWeight(vote) * reliabilityMultiplier * participationWeight(attendanceByUser.get(vote.userId), options);
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

function isDecisionParticipant(attendance: ParticipationEntry | undefined): boolean {
  return attendance?.status === "going" || attendance?.status === "maybe";
}

function collectEligibleUserIds(
  votesBySport: Map<string, RankedSportVote[]>,
  noGoUsersBySport: Map<string, Set<string>>,
  attendanceByUser: Map<string, ParticipationEntry>,
): string[] {
  const users = new Set<string>();
  for (const votes of votesBySport.values()) {
    for (const vote of votes) {
      if (isDecisionParticipant(attendanceByUser.get(vote.userId))) {
        users.add(vote.userId);
      }
    }
  }
  for (const noGoUsers of noGoUsersBySport.values()) {
    for (const userId of noGoUsers) {
      if (isDecisionParticipant(attendanceByUser.get(userId))) {
        users.add(userId);
      }
    }
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

function groupNoGos(noGos: SportNoGo[], proposedSportIds: Set<string>): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  for (const noGo of noGos) {
    if (!proposedSportIds.has(noGo.sportId)) continue;
    const next = groups.get(noGo.sportId) ?? new Set<string>();
    next.add(noGo.userId);
    groups.set(noGo.sportId, next);
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

function uniqueVoters(votes: RankedSportVote[]): string[] {
  return [...new Set(votes.map((vote) => vote.userId))].sort();
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

function hasCoordinates(profile: SportProfile): boolean {
  return typeof profile.latitude === "number" && typeof profile.longitude === "number";
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
    rotation: round(score.rotation),
    reliability: round(score.reliability),
  };
}

function modeLabel(mode: ConstellationMode): string {
  if (mode === "multi_sport") return "Multi-Sport";
  if (mode === "twin") return "Twin Event";
  if (mode === "single") return "Single Event";
  return "Keine Entscheidung";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
