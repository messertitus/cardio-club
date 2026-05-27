export type VoteRank = 1 | 2 | 3;

export const MAX_VOTES_PER_EVENT = 3;

export function rankToVoteWeight(rank: VoteRank): number {
  if (rank === 1) {
    return 1;
  }

  if (rank === 2) {
    return 0.6;
  }

  return 0.3;
}

export function isVoteRank(value: number): value is VoteRank {
  return value === 1 || value === 2 || value === 3;
}

export function getAvailableVoteRanks(usedRanks: number[]): VoteRank[] {
  const used = new Set(usedRanks);
  return [1, 2, 3].filter((rank): rank is VoteRank => !used.has(rank));
}
