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
import { getWeekStartDate, isDecisionReleaseOpen } from "./date";

export type EventDay = "saturday" | "sunday";

export type WeekEventRef = { eventId: string; eventDay: EventDay };

export type WeekEventSummary = {
  id: string;
  eventDay: EventDay;
  startsAt: string | null;
  weekStartDate: string;
  status: Row<"weekly_events">["status"];
};

export type MccEventState = {
  clubId: string;
  event: Row<"weekly_events">;
  eventDay: EventDay;
  weekEvents: WeekEventSummary[];
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
): Promise<ServiceResult<{ clubId: string; events: WeekEventRef[] }>> {
  const { data, error } = await supabase.rpc("ensure_mcc_week", {});

  if (error || !data || data.length === 0) {
    return { data: null, error: fromPostgrestError(error, "MCC-Testwoche konnte nicht vorbereitet werden.") };
  }

  return ok({
    clubId: data[0].mcc_club_id,
    events: data.map((row) => ({ eventId: row.mcc_event_id, eventDay: row.mcc_event_day })),
  });
}

function orderEvents<T extends { week_start_date?: string; weekStartDate?: string; event_day?: EventDay; eventDay?: EventDay }>(rows: T[]): T[] {
  const dayRank = (row: T): number => ((row.event_day ?? row.eventDay ?? "sunday") === "saturday" ? 0 : 1);
  const weekOf = (row: T): string => row.week_start_date ?? row.weekStartDate ?? "";
  return [...rows].sort((a, b) => {
    const weekCompare = weekOf(a).localeCompare(weekOf(b));
    if (weekCompare !== 0) return weekCompare;
    return dayRank(a) - dayRank(b);
  });
}

// Lightweight list of this week's and next week's events (past weeks excluded),
// used by the event page to list every Cardiotag with its own voting.
export async function getMccWeekEvents(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<{ clubId: string; events: Row<"weekly_events">[] }>> {
  const bootstrap = await bootstrapMccWeek(supabase);
  if (bootstrap.error) {
    return { data: null, error: bootstrap.error };
  }

  const eventIds = bootstrap.data.events.map((entry) => entry.eventId);
  const { data, error } = await supabase.from("weekly_events").select().in("id", eventIds);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Events konnten nicht geladen werden.") };
  }

  const currentWeek = getWeekStartDate();
  // Skipped events (too few votes by decision time) move to the archive, so they
  // are not listed on the event page anymore.
  const events = orderEvents(data).filter((row) => row.week_start_date >= currentWeek && row.status !== "cancelled");
  return ok({ clubId: bootstrap.data.clubId, events });
}

export async function getMccEventState(
  supabase: AppSupabaseClient,
  userId: string,
  eventId?: string,
): Promise<ServiceResult<MccEventState>> {
  const bootstrap = await bootstrapMccWeek(supabase);

  if (bootstrap.error) {
    return { data: null, error: bootstrap.error };
  }

  const eventIds = bootstrap.data.events.map((entry) => entry.eventId);
  const { data: eventRows, error: eventError } = await supabase.from("weekly_events").select().in("id", eventIds);

  if (eventError || !eventRows || eventRows.length === 0) {
    return { data: null, error: fromPostgrestError(eventError, "Event konnte nicht geladen werden.") };
  }

  const ordered = orderEvents(eventRows);
  // Default to this week's first Cardiotag (earliest week, Saturday first).
  const event = (eventId ? ordered.find((row) => row.id === eventId) : undefined) ?? ordered[0];
  const weekEvents: WeekEventSummary[] = ordered.map((row) => ({
    id: row.id,
    eventDay: row.event_day,
    startsAt: row.starts_at,
    weekStartDate: row.week_start_date,
    status: row.status,
  }));

  return buildEventState(supabase, userId, event, bootstrap.data.clubId, weekEvents);
}

// Loads a single event's full state directly by id, without the weekly bootstrap.
// Faster when the events were already ensured (e.g. by getMccWeekEvents).
export async function getEventStateById(
  supabase: AppSupabaseClient,
  userId: string,
  eventId: string,
): Promise<ServiceResult<MccEventState>> {
  const { data: event, error } = await supabase.from("weekly_events").select().eq("id", eventId).single();
  if (error || !event) {
    return { data: null, error: fromPostgrestError(error, "Event konnte nicht geladen werden.") };
  }
  const summary: WeekEventSummary = {
    id: event.id,
    eventDay: event.event_day,
    startsAt: event.starts_at,
    weekStartDate: event.week_start_date,
    status: event.status,
  };
  return buildEventState(supabase, userId, event, event.club_id, [summary]);
}

async function buildEventState(
  supabase: AppSupabaseClient,
  userId: string,
  event: Row<"weekly_events">,
  clubId: string,
  weekEvents: WeekEventSummary[],
): Promise<ServiceResult<MccEventState>> {
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

  // Load profiles for every sport the user can choose from (not only proposed
  // ones), so the sport picker on the event screen shows real location profiles.
  const profileSportIds = [...new Set([...sports.data.map((sport) => sport.id), ...proposals.data.map((proposal) => proposal.sport_id)])];
  const sportProfiles = await listSportProfilesForSports(supabase, profileSportIds);
  if (sportProfiles.error) return { data: null, error: sportProfiles.error };

  const visibleVotes = excludeNonAttendingVotes(votes.data, attendance.data);
  const visibleNoGos = excludeNonAttendingEntries(noGos.data, attendance.data);
  const decision = decisionPreview.error ? emptyDecision(decisionPreview.error.message) : decisionPreview.data;
  const names = new Map(sports.data.map((sport) => [sport.id, sport.name]));

  return ok({
    clubId,
    event,
    eventDay: event.event_day,
    weekEvents,
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
  weekStartDate?: string,
  eventDay: EventDay = "sunday",
): Promise<ServiceResult<{ attempted: boolean }>> {
  if (weekStartDate && !isDecisionReleaseOpen(weekStartDate, eventDay)) {
    return ok({ attempted: false });
  }

  const weekday = new Date().getDay();
  // Saturday decision opens Wednesday (3), Sunday Thursday (4).
  const earliestWeekday = eventDay === "saturday" ? 3 : 4;
  if (!weekStartDate && weekday < earliestWeekday) {
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
