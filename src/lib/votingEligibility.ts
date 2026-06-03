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
  const attendingUsers = new Set(attendance.filter((row) => row.status === "going" || row.status === "maybe").map((row) => row.user_id));
  return votes.filter((vote) => attendingUsers.has(vote.user_id));
}
