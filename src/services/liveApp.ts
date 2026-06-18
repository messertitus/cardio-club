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
import { emptyDecisionView, type DecisionView } from "../lib/decisionView";
import { getWeekStartDate, isDecisionReleaseOpen } from "./date";
import { isEventDecisionReadyForChat } from "../lib/eventChatReadiness";
export { isEventDecisionReadyForChat };

import type { EventDay } from "./date";
export type { EventDay };

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
  decision: DecisionView;
};

// ensure_mcc_week() is a heavy, write-everything RPC (profile, membership,
// events, proposals). For an existing user in an existing week it is almost pure
// overhead, yet it used to run serially before the data on every page open. We
// memoize the result per session so it runs at most once per BOOTSTRAP_TTL_MS,
// no matter how often the user switches between Event / Chat / Members. The
// memo holds the in-flight promise too, so parallel callers share one RPC.
// A new week (or a failure) is picked up within the TTL.
type BootstrapResult = ServiceResult<{ clubId: string; events: WeekEventRef[] }>;
const BOOTSTRAP_TTL_MS = 5 * 60 * 1000;
let bootstrapPromise: Promise<BootstrapResult> | null = null;
let bootstrapStartedAt = 0;

export async function bootstrapMccWeek(
  supabase: AppSupabaseClient,
  options?: { force?: boolean },
): Promise<BootstrapResult> {
  const now = Date.now();
  if (!options?.force && bootstrapPromise && now - bootstrapStartedAt < BOOTSTRAP_TTL_MS) {
    return bootstrapPromise;
  }

  bootstrapStartedAt = now;
  bootstrapPromise = (async (): Promise<BootstrapResult> => {
    const { data, error } = await supabase.rpc("ensure_mcc_week", {});
    if (error || !data || data.length === 0) {
      return { data: null, error: fromPostgrestError(error, "MCC-Testwoche konnte nicht vorbereitet werden.") };
    }
    return ok({
      clubId: data[0].mcc_club_id,
      events: data.map((row) => ({ eventId: row.mcc_event_id, eventDay: row.mcc_event_day })),
    });
  })();

  const result = await bootstrapPromise;
  // Don't cache failures: clear so the next call retries instead of being stuck
  // on a transient error for the whole TTL.
  if (result.error) {
    bootstrapPromise = null;
    bootstrapStartedAt = 0;
  }
  return result;
}

// Drop the memoized bootstrap, e.g. on sign-out so the next user re-runs it.
export function resetMccBootstrapCache(): void {
  bootstrapPromise = null;
  bootstrapStartedAt = 0;
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
  // Default to the member's own city (earliest week, Saturday first within it),
  // falling back to the first Cardiotag if their city has no event this week.
  const cityResult = await supabase.from("profiles").select("city").eq("id", userId).maybeSingle();
  const myCity = cityResult.data?.city?.trim().toLowerCase() ?? null;
  const cityMatch = myCity ? ordered.find((row) => (row.city ?? "").trim().toLowerCase() === myCity) : undefined;
  const event = (eventId ? ordered.find((row) => row.id === eventId) : undefined) ?? cityMatch ?? ordered[0];
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

function groupByEvent<T extends { event_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.event_id);
    if (list) list.push(row);
    else map.set(row.event_id, [row]);
  }
  return map;
}

// Chat-only week state. Builds exactly what the chat reads (event, attendance,
// votes, activities, sports, and the decision *fallback* used to label
// sub-channels) for ALL of the week's events in batched `.in(event_id, …)`
// queries — instead of one full getEventStateById per event. It deliberately
// skips what the chat never touches: sport proposals, no-gos, sport profiles and
// — the big one — the decision Edge Function, which is now invoked only for the
// rare event that is decision-ready yet has no persisted event_activities row.
// Unused MccEventState fields are returned empty.
export async function getWeekChatStates(
  supabase: AppSupabaseClient,
  userId: string,
  events: Row<"weekly_events">[],
): Promise<ServiceResult<MccEventState[]>> {
  if (events.length === 0) return ok([]);
  const eventIds = events.map((event) => event.id);

  const [sports, attendanceAll, votesAll, activitiesAll] = await Promise.all([
    listSports(supabase),
    supabase.from("attendance").select().in("event_id", eventIds),
    supabase.from("sport_votes").select().in("event_id", eventIds),
    supabase.from("event_activities").select().in("event_id", eventIds),
  ]);
  if (sports.error) return { data: null, error: sports.error };
  if (attendanceAll.error) return { data: null, error: fromPostgrestError(attendanceAll.error, "Teilnahmen konnten nicht geladen werden.") };
  if (votesAll.error) return { data: null, error: fromPostgrestError(votesAll.error, "Stimmen konnten nicht geladen werden.") };
  if (activitiesAll.error) return { data: null, error: fromPostgrestError(activitiesAll.error, "Aktivitäten konnten nicht geladen werden.") };

  const attendanceByEvent = groupByEvent(attendanceAll.data ?? []);
  const votesByEvent = groupByEvent(votesAll.data ?? []);
  const activitiesByEvent = groupByEvent(activitiesAll.data ?? []);

  const weekEvents: WeekEventSummary[] = orderEvents(events).map((event) => ({
    id: event.id,
    eventDay: event.event_day,
    startsAt: event.starts_at,
    weekStartDate: event.week_start_date,
    status: event.status,
  }));

  const states = await Promise.all(
    events.map(async (event): Promise<MccEventState> => {
      const attendance = attendanceByEvent.get(event.id) ?? [];
      const eventActivities = activitiesByEvent.get(event.id) ?? [];
      const visibleVotes = excludeNonAttendingVotes(votesByEvent.get(event.id) ?? [], attendance);
      const attendingVoterCount = new Set(visibleVotes.map((vote) => vote.user_id)).size;

      // The decision preview only ever feeds the sub-channel fallback when there
      // are no persisted activities yet — so fetch it only then, and only for a
      // chat that is actually open. In the common case this is zero Edge calls.
      let decision = emptyDecisionView("");
      if (eventActivities.length === 0 && isEventDecisionReadyForChat(event, attendingVoterCount)) {
        const preview = await getEventDecisionPreview(supabase, { eventId: event.id });
        if (preview.data) decision = preview.data;
      }

      return {
        clubId: event.club_id,
        event,
        eventDay: event.event_day,
        weekEvents,
        sports: sports.data,
        proposals: [],
        sportProfiles: [],
        votes: visibleVotes,
        noGos: [],
        attendance,
        eventActivities,
        myAttendance: attendance.find((row) => row.user_id === userId) ?? null,
        myVotes: [],
        myNoGos: [],
        decision,
      };
    }),
  );

  return ok(states);
}

async function buildEventState(
  supabase: AppSupabaseClient,
  userId: string,
  event: Row<"weekly_events">,
  clubId: string,
  weekEvents: WeekEventSummary[],
): Promise<ServiceResult<MccEventState>> {
  const [sports, proposals, votes, attendance, noGos, eventActivities] = await Promise.all([
    listSports(supabase),
    listEventProposals(supabase, event.id),
    listEventVotes(supabase, event.id),
    listAttendance(supabase, event.id),
    listEventNoGos(supabase, event.id),
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
  // Keep the sport picker local to the event's city (profiles without a city stay
  // visible so thin city data does not empty the list).
  const cityScopedProfiles = event.city
    ? sportProfiles.data.filter((profile) => !profile.location_city || profile.location_city === event.city)
    : sportProfiles.data;

  const visibleVotes = excludeNonAttendingVotes(votes.data, attendance.data);
  const visibleNoGos = excludeNonAttendingEntries(noGos.data, attendance.data);

  // No live preview: the algorithm runs ONCE at the 48h moment and persists the
  // result (status -> decided). Only a decided/completed event has a decision to
  // show; before that the UI shows a hint, never a recomputed forecast. For a
  // decided event the recompute uses the FROZEN weather_snapshot, so it is
  // deterministic and identical on every client.
  const decisionReady = event.status === "decided" || event.status === "completed";
  let decision = emptyDecisionView("Die Entscheidung fällt 48 Stunden vor dem Event.");
  if (decisionReady) {
    const decisionResult = await getEventDecisionPreview(supabase, { eventId: event.id });
    if (decisionResult.data) decision = decisionResult.data;
  }

  return ok({
    clubId,
    event,
    eventDay: event.event_day,
    weekEvents,
    sports: sports.data,
    proposals: proposals.data,
    sportProfiles: cityScopedProfiles,
    votes: visibleVotes,
    noGos: visibleNoGos,
    attendance: attendance.data,
    eventActivities: eventActivities.data,
    myAttendance: attendance.data.find((row) => row.user_id === userId) ?? null,
    myVotes: visibleVotes.filter((row) => row.user_id === userId).sort((a, b) => a.vote_rank - b.vote_rank),
    myNoGos: visibleNoGos.filter((row) => row.user_id === userId),
    decision,
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
