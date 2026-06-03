export type AttendanceLike = {
  user_id: string;
  status: "going" | "maybe" | "not_going";
};

export type UserScopedDecisionInput = {
  user_id: string;
};

export function excludeNonAttendingEntries<TEntry extends UserScopedDecisionInput>(
  entries: TEntry[],
  attendance: AttendanceLike[],
): TEntry[] {
  const attendingUsers = new Set(attendance.filter((row) => row.status === "going" || row.status === "maybe").map((row) => row.user_id));
  return entries.filter((entry) => attendingUsers.has(entry.user_id));
}

export function excludeNonAttendingVotes<TVote extends UserScopedDecisionInput>(
  votes: TVote[],
  attendance: AttendanceLike[],
): TVote[] {
  return excludeNonAttendingEntries(votes, attendance);
}
