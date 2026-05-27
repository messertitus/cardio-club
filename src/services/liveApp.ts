import { buildDecisionPresentation } from "../lib/decisionPresentation";
import { selectFairSport, type FairSportSelectionResult, type Sport } from "../lib/fairSportSelection";
import { excludeNonAttendingVotes } from "../lib/votingEligibility";
import type { VoteRank } from "../lib/votingRules";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import { listAttendance, updateAttendance } from "./attendance";
import type { AttendanceStatus, Row } from "./database.types";
import { getEventDecisionPreview } from "./decisions";
import { listEventProposals, listSports } from "./proposals";
import type { AppSupabaseClient } from "./supabaseClient";
import { listEventVotes, removeVote, voteForSport } from "./votes";

export type MccEventState = {
  clubId: string;
  event: Row<"weekly_events">;
  sports: Row<"sports">[];
  proposals: Row<"sport_proposals">[];
  votes: Row<"sport_votes">[];
  attendance: Row<"attendance">[];
  myAttendance: Row<"attendance"> | null;
  myVotes: Row<"sport_votes">[];
  decision: FairSportSelectionResult;
  decisionText: ReturnType<typeof buildDecisionPresentation>;
};

export async function bootstrapMccWeek(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<{ clubId: string; eventId: string }>> {
  const { data, error } = await supabase.rpc("ensure_mcc_week", {});

  if (error || !data?.[0]) {
    return { data: null, error: fromPostgrestError(error, "MCC-Testwoche konnte nicht vorbereitet werden.") };
  }

  return ok({ clubId: data[0].mcc_club_id, eventId: data[0].mcc_event_id });
}

export async function getMccEventState(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<ServiceResult<MccEventState>> {
  const bootstrap = await bootstrapMccWeek(supabase);

  if (bootstrap.error) {
    return { data: null, error: bootstrap.error };
  }

  const { data: event, error: eventError } = await supabase
    .from("weekly_events")
    .select()
    .eq("id", bootstrap.data.eventId)
    .single();

  if (eventError || !event) {
    return { data: null, error: fromPostgrestError(eventError, "Event konnte nicht geladen werden.") };
  }

  const [sports, proposals, votes, attendance, decisionPreview] = await Promise.all([
    listSports(supabase),
    listEventProposals(supabase, event.id),
    listEventVotes(supabase, event.id),
    listAttendance(supabase, event.id),
    getEventDecisionPreview(supabase, { eventId: event.id }),
  ]);

  if (sports.error) return { data: null, error: sports.error };
  if (proposals.error) return { data: null, error: proposals.error };
  if (votes.error) return { data: null, error: votes.error };
  if (attendance.error) return { data: null, error: attendance.error };

  const visibleVotes = excludeNonAttendingVotes(votes.data, attendance.data);
  const decision = decisionPreview.error
    ? selectFairSport({
        sports: sports.data.map(mapSport),
        proposals: proposals.data.map((proposal) => ({ sportId: proposal.sport_id })),
        votes: visibleVotes.map((vote) => ({ sportId: vote.sport_id, userId: vote.user_id, weight: vote.weight })),
      })
    : decisionPreview.data;
  const names = new Map(sports.data.map((sport) => [sport.id, sport.name]));

  return ok({
    clubId: bootstrap.data.clubId,
    event,
    sports: sports.data,
    proposals: proposals.data,
    votes: visibleVotes,
    attendance: attendance.data,
    myAttendance: attendance.data.find((row) => row.user_id === userId) ?? null,
    myVotes: visibleVotes.filter((row) => row.user_id === userId).sort((a, b) => a.vote_rank - b.vote_rank),
    decision,
    decisionText: buildDecisionPresentation(decision, names),
  });
}

export async function saveMccAttendance(
  supabase: AppSupabaseClient,
  input: { eventId: string; userId: string; status: AttendanceStatus },
) {
  return updateAttendance(supabase, input);
}

export async function saveMccVoteRank(
  supabase: AppSupabaseClient,
  input: { eventId: string; userId: string; sportId: string; rank: VoteRank },
) {
  return voteForSport(supabase, input);
}

export async function clearMccVote(
  supabase: AppSupabaseClient,
  input: { eventId: string; userId: string; sportId: string },
) {
  return removeVote(supabase, input);
}

export async function finalizeMccDecisionIfReady(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<{ attempted: boolean }>> {
  const weekday = new Date().getDay();

  if (weekday !== 3) {
    return ok({ attempted: false });
  }

  const { finalizeEventDecision } = await import("./decisions");
  const result = await finalizeEventDecision(supabase, { eventId });

  if (result.error) {
    return fail(result.error.message, result.error);
  }

  return ok({ attempted: true });
}

function mapSport(row: Row<"sports">): Sport {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    compatibleSportIds: row.combinable_tags,
  };
}
