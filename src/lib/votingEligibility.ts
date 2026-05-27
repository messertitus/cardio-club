export type AttendanceLike = {
  user_id: string;
  status: "going" | "maybe" | "not_going";
};

export type VoteLike = {
  user_id: string;
};

export function excludeNonAttendingVotes<TVote extends VoteLike>(
  votes: TVote[],
  attendance: AttendanceLike[],
): TVote[] {
  const nonAttendingUsers = new Set(attendance.filter((row) => row.status === "not_going").map((row) => row.user_id));
  return votes.filter((vote) => !nonAttendingUsers.has(vote.user_id));
}
