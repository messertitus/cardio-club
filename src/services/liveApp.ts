import { buildDecisionPresentation } from "../lib/decisionPresentation";
import { excludeNonAttendingEntries, excludeNonAttendingVotes } from "../lib/votingEligibility";
import type { VoteRank } from "../lib/votingRules";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import { listAttendance, updateAttendance } from "./attendance";
import type { AttendanceStatus, Row } from "./database.types";
import { listEventActivities } from "./eventActivities";
import { getEventDecisionPreview } from "./decisions";
import { listEventNoGos, removeSportNoGo, setSportNoGo } from "./noGos";
import { listEventProposals, listSports } from "./proposals";
import { listSportProfilesForSports } from "./sportProfiles";
import type { AppSupabaseClient } from "./supabaseClient";
import { listEventVotes, removeVote, voteForSport } from "./votes";
import type { FairConstellationDecision } from "../lib/fairConstellationSelection";

export type MccEventState = {
  clubId: string;
  event: Row<"weekly_events">;
  sports: Row<"sports">[];
  proposals: Row<"sport_proposals">[];
  sportProfiles: Row<"sport_profiles">[];
  votes: Row<"sport_votes">[];
  noGos: Row<"sport_no_gos">[];
  attendance: Row<"attendance">[];
  eventActivities: Row<"event_activities">[];
  myAttendance: Row<"attendance"> | null;
  myVotes: Row<"sport_votes">[];
  myNoGos: Row<"sport_no_gos">[];
  decision: FairConstellationDecision;
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

  const [sports, proposals, votes, attendance, noGos, decisionPreview, eventActivities] = await Promise.all([
    listSports(supabase),
    listEventProposals(supabase, event.id),
    listEventVotes(supabase, event.id),
    listAttendance(supabase, event.id),
    listEventNoGos(supabase, event.id),
    getEventDecisionPreview(supabase, { eventId: event.id }),
    listEventActivities(supabase, event.id),
  ]);

  if (sports.error) return { data: null, error: sports.error };
  if (proposals.error) return { data: null, error: proposals.error };
  if (votes.error) return { data: null, error: votes.error };
  if (attendance.error) return { data: null, error: attendance.error };
  if (noGos.error) return { data: null, error: noGos.error };
  if (eventActivities.error) return { data: null, error: eventActivities.error };

  const proposedSportIds = [...new Set(proposals.data.map((proposal) => proposal.sport_id))];
  const sportProfiles = await listSportProfilesForSports(supabase, proposedSportIds);
  if (sportProfiles.error) return { data: null, error: sportProfiles.error };

  const visibleVotes = excludeNonAttendingVotes(votes.data, attendance.data);
  const visibleNoGos = excludeNonAttendingEntries(noGos.data, attendance.data);
  const decision = decisionPreview.error ? emptyDecision(decisionPreview.error.message) : decisionPreview.data;
  const names = new Map(sports.data.map((sport) => [sport.id, sport.name]));

  return ok({
    clubId: bootstrap.data.clubId,
    event,
    sports: sports.data,
    proposals: proposals.data,
    sportProfiles: sportProfiles.data,
    votes: visibleVotes,
    noGos: visibleNoGos,
    attendance: attendance.data,
    eventActivities: eventActivities.data,
    myAttendance: attendance.data.find((row) => row.user_id === userId) ?? null,
    myVotes: visibleVotes.filter((row) => row.user_id === userId).sort((a, b) => a.vote_rank - b.vote_rank),
    myNoGos: visibleNoGos.filter((row) => row.user_id === userId),
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

export async function saveMccNoGo(
  supabase: AppSupabaseClient,
  input: { eventId: string; userId: string; sportId: string },
) {
  return setSportNoGo(supabase, input);
}

export async function clearMccNoGo(
  supabase: AppSupabaseClient,
  input: { eventId: string; userId: string; sportId: string },
) {
  return removeSportNoGo(supabase, input);
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

function emptyDecision(reason: string): FairConstellationDecision {
  return {
    mode: "none",
    activities: [],
    scores: [],
    decisionCharacter: "no_valid_decision",
    explainability: {
      voteSummaryBySport: [],
      fairnessByUser: [],
      noGoBreakdown: {
        unresolved: [],
        resolvedByAlternative: [],
        ignoredBecauseNotGoing: [],
        summary: "Keine No-Go-Konflikte.",
      },
      rotationReasons: [],
      weatherReasons: [],
      practicalityReasons: [],
      capacityReasons: [],
      costReasons: [],
    },
    noGoBreakdown: {
      unresolved: [],
      resolvedByAlternative: [],
      ignoredBecauseNotGoing: [],
      summary: "Keine No-Go-Konflikte.",
    },
    losingCandidateReasons: [],
    excludedProfiles: [],
    reason,
  };
}
