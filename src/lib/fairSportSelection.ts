export type SelectionMode = "single" | "combined" | "subgroups";

export type Sport = {
  id: string;
  name?: string;
  category: string;
  compatibleSportIds?: string[];
  incompatibleLocationTypes?: string[];
  incompatibleWeatherTags?: string[];
};

export type SportProposal = {
  sportId: string;
};

export type SportVote = {
  sportId: string;
  userId: string;
  weight?: number;
};

export type PreferenceHistoryEntry = {
  userId: string;
  sportId: string;
  weekStartDate: string;
  wasSelected: boolean;
  votedFor: boolean;
};

export type RecentSelection = {
  sportId: string;
  category: string;
  weekStartDate: string;
};

export type SelectionContext = {
  locationType?: string;
  weatherTags?: string[];
  incompatibleSportIds?: string[];
};

export type SportScore = {
  sportId: string;
  baseVoteScore: number;
  fairnessScore: number;
  diversityScore: number;
  repetitionPenalty: number;
  finalScore: number;
};

export type SportSubgroup = {
  sportId: string;
  userIds: string[];
};

export type FairSportSelectionResult = {
  mode: SelectionMode | "none";
  selectedSportId?: string;
  secondarySportId?: string;
  subgroups?: SportSubgroup[];
  scores: SportScore[];
  reason: string;
};

export type FairSportSelectionInput = {
  sports: Sport[];
  proposals: SportProposal[];
  votes: SportVote[];
  previousWeekSportId?: string;
  preferenceHistory?: PreferenceHistoryEntry[];
  recentSelections?: RecentSelection[];
  context?: SelectionContext;
  options?: Partial<SelectionOptions>;
};

type SelectionOptions = {
  neglectBoostPerWeek: number;
  maxNeglectBoost: number;
  diversityBoost: number;
  recentCategoryPenalty: number;
  veryRecentCategoryPenalty: number;
  recentCategoryWindow: number;
  strongSecondaryVoteRatio: number;
  splitScoreRatio: number;
  minVotesForSecondary: number;
};

const DEFAULT_OPTIONS: SelectionOptions = {
  neglectBoostPerWeek: 0.35,
  maxNeglectBoost: 2,
  diversityBoost: 0.35,
  recentCategoryPenalty: 0.6,
  veryRecentCategoryPenalty: 1.25,
  recentCategoryWindow: 3,
  strongSecondaryVoteRatio: 0.65,
  splitScoreRatio: 0.75,
  minVotesForSecondary: 2,
};

export function selectFairSport(input: FairSportSelectionInput): FairSportSelectionResult {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const sportsById = new Map(input.sports.map((sport) => [sport.id, sport]));
  const eligibleSportIds = getEligibleSportIds(input, sportsById);
  const votesBySport = groupVotesBySport(input.votes, eligibleSportIds);

  const votedEligibleSportIds = [...eligibleSportIds].filter((sportId) => {
    return (votesBySport.get(sportId) ?? []).length > 0;
  });

  if (votedEligibleSportIds.length === 0) {
    return {
      mode: "none",
      scores: [],
      reason: "No decision: no eligible proposed sport has at least one vote.",
    };
  }

  const neglectByUser = calculateNeglectScores(input.preferenceHistory ?? [], options);
  const recentSelections = input.recentSelections ?? inferRecentSelections(input.preferenceHistory ?? [], sportsById);
  const recentCategories = recentSelections.slice(0, options.recentCategoryWindow).map((selection) => selection.category);
  const veryRecentCategory = recentCategories[0];

  const scores = votedEligibleSportIds
    .map((sportId) => {
      const sport = sportsById.get(sportId);
      const sportVotes = votesBySport.get(sportId) ?? [];
      const baseVoteScore = sumVoteWeights(sportVotes);
      const fairnessScore = sumUniqueVoterFairness(sportVotes, neglectByUser);
      const diversityScore = sport && !recentCategories.includes(sport.category) ? options.diversityBoost : 0;
      const repetitionPenalty = getRepetitionPenalty(sport?.category, veryRecentCategory, recentCategories, options);
      const finalScore = roundScore(baseVoteScore + fairnessScore + diversityScore - repetitionPenalty);

      return {
        sportId,
        baseVoteScore,
        fairnessScore: roundScore(fairnessScore),
        diversityScore,
        repetitionPenalty,
        finalScore,
      };
    })
    .sort((a, b) => compareScores(a, b, sportsById, recentSelections));

  const winner = scores[0];
  const runnerUp = scores[1];

  if (runnerUp) {
    const winnerSport = sportsById.get(winner.sportId);
    const runnerUpSport = sportsById.get(runnerUp.sportId);
    const compatible = areSportsCompatible(winnerSport, runnerUpSport);
    const runnerUpHasStrongSupport =
      runnerUp.baseVoteScore >= options.minVotesForSecondary &&
      runnerUp.baseVoteScore >= winner.baseVoteScore * options.strongSecondaryVoteRatio;

    if (compatible && runnerUpHasStrongSupport) {
      return {
        mode: "combined",
        selectedSportId: winner.sportId,
        secondarySportId: runnerUp.sportId,
        scores,
        reason: [
          `Selected ${labelSport(winnerSport, winner.sportId)} with ${winner.finalScore} points.`,
          `${labelSport(runnerUpSport, runnerUp.sportId)} also had strong support and is compatible, so a combined event is recommended.`,
        ].join(" "),
      };
    }

    const clearlySplit =
      !compatible &&
      runnerUp.baseVoteScore >= options.minVotesForSecondary &&
      runnerUp.finalScore >= winner.finalScore * options.splitScoreRatio;

    if (clearlySplit) {
      return {
        mode: "subgroups",
        selectedSportId: winner.sportId,
        secondarySportId: runnerUp.sportId,
        subgroups: [
          { sportId: winner.sportId, userIds: uniqueVoters(votesBySport.get(winner.sportId) ?? []) },
          { sportId: runnerUp.sportId, userIds: uniqueVoters(votesBySport.get(runnerUp.sportId) ?? []) },
        ],
        scores,
        reason: [
          `Selected ${labelSport(winnerSport, winner.sportId)} as the top option with ${winner.finalScore} points.`,
          `${labelSport(runnerUpSport, runnerUp.sportId)} has clearly split support but is not compatible, so subgroups are recommended.`,
        ].join(" "),
      };
    }
  }

  const fairnessWon =
    winner.fairnessScore > 0 &&
    scores.some((score) => score.baseVoteScore > winner.baseVoteScore && score.finalScore < winner.finalScore);

  return {
    mode: "single",
    selectedSportId: winner.sportId,
    scores,
    reason: [
      `Selected ${labelSport(sportsById.get(winner.sportId), winner.sportId)} with ${winner.finalScore} points.`,
      fairnessWon
        ? "A neglected minority preference won after capped fairness boosts were applied."
        : "The decision follows the strongest overall score after votes, fairness, diversity, and repetition checks.",
    ].join(" "),
  };
}

export function calculateNeglectScores(
  preferenceHistory: PreferenceHistoryEntry[],
  options: Partial<Pick<SelectionOptions, "neglectBoostPerWeek" | "maxNeglectBoost">> = {},
): Map<string, number> {
  const boostPerWeek = options.neglectBoostPerWeek ?? DEFAULT_OPTIONS.neglectBoostPerWeek;
  const maxBoost = options.maxNeglectBoost ?? DEFAULT_OPTIONS.maxNeglectBoost;
  const entriesByUser = groupBy(preferenceHistory, (entry) => entry.userId);
  const scores = new Map<string, number>();

  for (const [userId, entries] of entriesByUser) {
    const weeks = groupBy(entries, (entry) => entry.weekStartDate);
    const sortedWeeks = [...weeks.entries()].sort(([a], [b]) => b.localeCompare(a));
    let neglectedWeeks = 0;

    for (const [, weekEntries] of sortedWeeks) {
      const votedEntries = weekEntries.filter((entry) => entry.votedFor);

      if (votedEntries.length === 0) {
        break;
      }

      const selectedPreferredSport = votedEntries.some((entry) => entry.wasSelected);

      if (selectedPreferredSport) {
        break;
      }

      neglectedWeeks += 1;
    }

    scores.set(userId, roundScore(Math.min(neglectedWeeks * boostPerWeek, maxBoost)));
  }

  return scores;
}

function getEligibleSportIds(input: FairSportSelectionInput, sportsById: Map<string, Sport>): Set<string> {
  const proposedSportIds = new Set(input.proposals.map((proposal) => proposal.sportId));
  const eligibleSportIds = new Set<string>();

  for (const sportId of proposedSportIds) {
    const sport = sportsById.get(sportId);

    if (!sport || sportId === input.previousWeekSportId || isContextIncompatible(sport, input.context)) {
      continue;
    }

    eligibleSportIds.add(sportId);
  }

  return eligibleSportIds;
}

function isContextIncompatible(sport: Sport, context?: SelectionContext): boolean {
  if (!context) {
    return false;
  }

  if (context.incompatibleSportIds?.includes(sport.id)) {
    return true;
  }

  if (context.locationType && sport.incompatibleLocationTypes?.includes(context.locationType)) {
    return true;
  }

  return Boolean(
    context.weatherTags?.some((weatherTag) => sport.incompatibleWeatherTags?.includes(weatherTag)),
  );
}

function groupVotesBySport(votes: SportVote[], eligibleSportIds: Set<string>): Map<string, SportVote[]> {
  const votesBySport = new Map<string, SportVote[]>();

  for (const vote of votes) {
    if (!eligibleSportIds.has(vote.sportId)) {
      continue;
    }

    const sportVotes = votesBySport.get(vote.sportId) ?? [];
    sportVotes.push(vote);
    votesBySport.set(vote.sportId, sportVotes);
  }

  return votesBySport;
}

function sumVoteWeights(votes: SportVote[]): number {
  return roundScore(votes.reduce((total, vote) => total + normalizeWeight(vote.weight), 0));
}

function normalizeWeight(weight = 1): number {
  if (!Number.isFinite(weight)) {
    return 1;
  }

  return Math.max(0, weight);
}

function sumUniqueVoterFairness(votes: SportVote[], neglectByUser: Map<string, number>): number {
  return uniqueVoters(votes).reduce((total, userId) => total + (neglectByUser.get(userId) ?? 0), 0);
}

function getRepetitionPenalty(
  category: string | undefined,
  veryRecentCategory: string | undefined,
  recentCategories: string[],
  options: SelectionOptions,
): number {
  if (!category) {
    return 0;
  }

  if (category === veryRecentCategory) {
    return options.veryRecentCategoryPenalty;
  }

  if (recentCategories.includes(category)) {
    return options.recentCategoryPenalty;
  }

  return 0;
}

function inferRecentSelections(
  preferenceHistory: PreferenceHistoryEntry[],
  sportsById: Map<string, Sport>,
): RecentSelection[] {
  const selectedByWeek = new Map<string, RecentSelection>();

  for (const entry of preferenceHistory) {
    if (!entry.wasSelected || selectedByWeek.has(entry.weekStartDate)) {
      continue;
    }

    const sport = sportsById.get(entry.sportId);

    if (sport) {
      selectedByWeek.set(entry.weekStartDate, {
        sportId: entry.sportId,
        category: sport.category,
        weekStartDate: entry.weekStartDate,
      });
    }
  }

  return [...selectedByWeek.values()].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
}

function areSportsCompatible(first?: Sport, second?: Sport): boolean {
  if (!first || !second) {
    return false;
  }

  return Boolean(first.compatibleSportIds?.includes(second.id) || second.compatibleSportIds?.includes(first.id));
}

function uniqueVoters(votes: SportVote[]): string[] {
  return [...new Set(votes.map((vote) => vote.userId))].sort();
}

function compareScores(
  a: SportScore,
  b: SportScore,
  sportsById: Map<string, Sport>,
  recentSelections: RecentSelection[],
): number {
  if (b.finalScore !== a.finalScore) {
    return b.finalScore - a.finalScore;
  }

  if (b.baseVoteScore !== a.baseVoteScore) {
    return b.baseVoteScore - a.baseVoteScore;
  }

  if (b.fairnessScore !== a.fairnessScore) {
    return b.fairnessScore - a.fairnessScore;
  }

  const aLastSelected = getLastSelectedDate(a.sportId, recentSelections);
  const bLastSelected = getLastSelectedDate(b.sportId, recentSelections);

  if (aLastSelected !== bLastSelected) {
    return aLastSelected.localeCompare(bLastSelected);
  }

  const aName = labelSport(sportsById.get(a.sportId), a.sportId);
  const bName = labelSport(sportsById.get(b.sportId), b.sportId);

  return aName.localeCompare(bName);
}

function getLastSelectedDate(sportId: string, recentSelections: RecentSelection[]): string {
  return recentSelections.find((selection) => selection.sportId === sportId)?.weekStartDate ?? "0000-00-00";
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

function labelSport(sport: Sport | undefined, fallbackId: string): string {
  return sport?.name ?? fallbackId;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
