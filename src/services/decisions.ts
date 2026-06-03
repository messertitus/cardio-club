import {
  selectFairConstellation,
  type AbstractSport,
  type FairConstellationDecision,
  type FairConstellationInput,
  type ParticipationEntry,
  type PreferenceHistoryEntry,
  type ProfileWeatherSnapshot,
  type RecentSelection,
  type ReliabilityHistoryEntry,
} from "../lib/fairConstellationSelection";
import type { Row } from "./database.types";
import { replaceEventActivitiesFromDecision } from "./eventActivities";
import { mapSportProfile } from "./sportProfiles";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";
import { fetchEventWeatherSnapshot } from "./weather";

export type EventDecisionPreview = FairConstellationDecision;
export type DecisionContext = {
  weatherSnapshot?: ProfileWeatherSnapshot;
};

export type GetEventDecisionPreviewInput = {
  eventId: string;
  context?: DecisionContext;
  options?: FairConstellationInput["options"];
};

export type FinalizedDecision = {
  event: Row<"weekly_events">;
  decision: FairConstellationDecision;
};

export type CreatedSubgroups = {
  subgroups: Row<"event_subgroups">[];
};

type RecentEventRow = Pick<Row<"weekly_events">, "id" | "week_start_date" | "selected_sport_id">;

export async function getEventDecisionPreview(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<EventDecisionPreview>> {
  const decisionInput = await buildDecisionInput(supabase, input);

  if (decisionInput.error) {
    return { data: null, error: decisionInput.error };
  }

  return ok(selectFairConstellation(decisionInput.data));
}

export async function finalizeEventDecision(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<FinalizedDecision>> {
  const eventResult = await fetchEvent(supabase, input.eventId);

  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  if (eventResult.data.status === "decided" || eventResult.data.status === "completed" || eventResult.data.status === "cancelled") {
    return fail("Diese Entscheidung wurde bereits abgeschlossen.");
  }

  const preview = await getEventDecisionPreview(supabase, input);

  if (preview.error) {
    return { data: null, error: preview.error };
  }

  if (!preview.data.selectedSportId) {
    return fail("Cannot finalize event decision because no eligible constellation won.");
  }

  const decision = await withActivityContacts(supabase, input.eventId, preview.data);
  const primaryContactId = decision.activities[0]?.activityContactId ?? null;

  const activities = await replaceEventActivitiesFromDecision(supabase, {
    eventId: eventResult.data.id,
    startsAt: eventResult.data.starts_at,
    decision,
  });

  if (activities.error) {
    return { data: null, error: activities.error };
  }

  const historyResult = await persistPreferenceHistory(supabase, eventResult.data, decision);

  if (historyResult.error) {
    return { data: null, error: historyResult.error };
  }

  if (decision.mode === "twin") {
    const subgroupResult = await createSubgroupsFromDecision(supabase, { eventId: eventResult.data.id, decision });
    if (subgroupResult.error) {
      return { data: null, error: subgroupResult.error };
    }
  }

  const { data: event, error } = await supabase
    .from("weekly_events")
    .update({
      selected_sport_id: decision.selectedSportId,
      secondary_sport_id: decision.secondarySportId ?? null,
      decision_type: decision.mode,
      decision_reason: decision.reason,
      decision_scorecard: decision.scoreBreakdown ?? null,
      weather_snapshot: decision.weatherSnapshot ?? null,
      activity_contact_id: primaryContactId,
      status: "decided",
    })
    .eq("id", input.eventId)
    .in("status", ["proposing", "voting"])
    .select()
    .single();

  if (error || !event) {
    return { data: null, error: fromPostgrestError(error, "Could not finalize event decision.") };
  }

  return ok({ event, decision });
}

export async function createSubgroupsFromDecision(
  supabase: AppSupabaseClient,
  input: {
    eventId: string;
    decision?: FairConstellationDecision;
    context?: DecisionContext;
  },
): Promise<ServiceResult<CreatedSubgroups>> {
  const decision = input.decision ?? (await getEventDecisionPreview(supabase, input));

  if ("error" in decision && decision.error) {
    return { data: null, error: decision.error };
  }

  const resolvedDecision = "data" in decision ? decision.data : decision;
  if (resolvedDecision.mode !== "twin" || resolvedDecision.activities.length < 2) {
    return ok({ subgroups: [] });
  }

  const { error: deleteError } = await supabase.from("event_subgroups").delete().eq("event_id", input.eventId);

  if (deleteError) {
    return { data: null, error: fromPostgrestError(deleteError, "Could not replace old subgroups.") };
  }

  const { data, error } = await supabase
    .from("event_subgroups")
    .insert(
      resolvedDecision.activities.map((activity, index) => ({
        event_id: input.eventId,
        sport_id: activity.sportId,
        title: activity.profileName || `Gruppe ${index + 1}`,
        location: activity.locationName ?? null,
        activity_contact_id: activity.activityContactId ?? null,
      })),
    )
    .select();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not create subgroups.") };
  }

  await Promise.all(
    resolvedDecision.activities.map((activity, index) => {
      const subgroup = data[index];
      if (!subgroup || activity.assignedUserIds.length === 0) return Promise.resolve();
      return supabase
        .from("attendance")
        .update({ subgroup_id: subgroup.id })
        .eq("event_id", input.eventId)
        .in("user_id", activity.assignedUserIds);
    }),
  );

  return ok({ subgroups: data });
}

async function buildDecisionInput(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<FairConstellationInput>> {
  const eventResult = await fetchEvent(supabase, input.eventId);

  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  const event = eventResult.data;
  const [proposalsResult, votesResult, attendanceResult, noGosResult, previousResult, recentResult, historyResult, reliabilityResult] =
    await Promise.all([
      fetchProposals(supabase, event.id),
      fetchVotes(supabase, event.id),
      fetchAttendance(supabase, event.id),
      fetchNoGos(supabase, event.id),
      fetchPreviousSelectedSportId(supabase, event),
      fetchRecentSelections(supabase, event),
      fetchPreferenceHistory(supabase, event.club_id, event.week_start_date),
      fetchReliabilityHistory(supabase, event),
    ]);

  if (proposalsResult.error) return { data: null, error: proposalsResult.error };
  if (votesResult.error) return { data: null, error: votesResult.error };
  if (attendanceResult.error) return { data: null, error: attendanceResult.error };
  if (noGosResult.error) return { data: null, error: noGosResult.error };
  if (previousResult.error) return { data: null, error: previousResult.error };
  if (recentResult.error) return { data: null, error: recentResult.error };
  if (historyResult.error) return { data: null, error: historyResult.error };
  if (reliabilityResult.error) return { data: null, error: reliabilityResult.error };

  const sportIds = [...new Set(proposalsResult.data.map((proposal) => proposal.sport_id))];
  const [sportsResult, profilesResult] = await Promise.all([
    fetchSports(supabase, sportIds),
    fetchSportProfiles(supabase, sportIds),
  ]);

  if (sportsResult.error) return { data: null, error: sportsResult.error };
  if (profilesResult.error) return { data: null, error: profilesResult.error };

  const sportProfiles = profilesResult.data.map(mapSportProfile);
  const weatherSnapshot =
    input.context?.weatherSnapshot ??
    asWeatherSnapshot(event.weather_snapshot) ??
    (await fetchEventWeatherSnapshot(sportProfiles, event.starts_at));

  return ok({
    sports: sportsResult.data.map(mapSport),
    sportProfiles,
    proposals: proposalsResult.data.map((proposal) => ({ sportId: proposal.sport_id })),
    votes: votesResult.data.map((vote) => ({
      sportId: vote.sport_id,
      userId: vote.user_id,
      rank: vote.vote_rank,
      weight: vote.weight,
    })),
    noGos: noGosResult.data.map((noGo) => ({ sportId: noGo.sport_id, userId: noGo.user_id })),
    attendance: attendanceResult.data.map(mapAttendance),
    previousWeekSportId: previousResult.data ?? undefined,
    preferenceHistory: historyResult.data.map(mapPreferenceHistory),
    recentSelections: recentResult.data.map(mapRecentSelection),
    reliabilityHistory: reliabilityResult.data,
    weatherSnapshot,
    options: input.options,
  });
}

async function withActivityContacts(
  supabase: AppSupabaseClient,
  eventId: string,
  decision: FairConstellationDecision,
): Promise<FairConstellationDecision> {
  const activityContactIds = await Promise.all(
    decision.activities.map(async (activity) => {
      return (await selectPrimarySportContact(supabase, activity.sportId)) ?? activity.assignedUserIds[0] ?? (await selectActivityContact(supabase, eventId, activity.sportId));
    }),
  );

  return {
    ...decision,
    activities: decision.activities.map((activity, index) => ({
      ...activity,
      activityContactId: activityContactIds[index],
    })),
  };
}

async function selectActivityContact(
  supabase: AppSupabaseClient,
  eventId: string,
  selectedSportId: string,
): Promise<string | null> {
  const [votes, attendance] = await Promise.all([fetchVotes(supabase, eventId), fetchAttendance(supabase, eventId)]);
  if (votes.error || attendance.error) return null;

  const attendingUsers = new Set(
    attendance.data.filter((row) => row.status === "going" || row.status === "maybe").map((row) => row.user_id),
  );
  const selectedVoters = votes.data
    .filter((vote) => vote.sport_id === selectedSportId && attendingUsers.has(vote.user_id))
    .sort((a, b) => a.vote_rank - b.vote_rank || a.created_at.localeCompare(b.created_at));

  return selectedVoters[0]?.user_id ?? attendance.data.find((row) => row.status === "going")?.user_id ?? null;
}

async function selectPrimarySportContact(supabase: AppSupabaseClient, sportId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("sport_contacts")
    .select("user_id, is_primary, created_at")
    .eq("sport_id", sportId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data.user_id;
}

async function fetchEvent(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"weekly_events">>> {
  const { data, error } = await supabase.from("weekly_events").select().eq("id", eventId).single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load event.") };
  }

  return ok(data);
}

async function fetchProposals(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_proposals">[]>> {
  const { data, error } = await supabase.from("sport_proposals").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport proposals.") };
  }

  return ok(data);
}

async function fetchVotes(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_votes">[]>> {
  const { data, error } = await supabase.from("sport_votes").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport votes.") };
  }

  return ok(data);
}

async function fetchNoGos(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_no_gos">[]>> {
  const { data, error } = await supabase.from("sport_no_gos").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport no-gos.") };
  }

  return ok(data);
}

async function fetchAttendance(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"attendance">[]>> {
  const { data, error } = await supabase.from("attendance").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load attendance.") };
  }

  return ok(data);
}

async function fetchSports(
  supabase: AppSupabaseClient,
  sportIds: string[],
): Promise<ServiceResult<Row<"sports">[]>> {
  if (sportIds.length === 0) {
    return ok([]);
  }

  const { data, error } = await supabase.from("sports").select().in("id", sportIds);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sports.") };
  }

  return ok(data);
}

async function fetchSportProfiles(
  supabase: AppSupabaseClient,
  sportIds: string[],
): Promise<ServiceResult<Row<"sport_profiles">[]>> {
  if (sportIds.length === 0) {
    return ok([]);
  }

  const { data, error } = await supabase
    .from("sport_profiles")
    .select()
    .in("sport_id", sportIds)
    .eq("is_active", true);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport profiles.") };
  }

  return ok(data);
}

async function fetchPreviousSelectedSportId(
  supabase: AppSupabaseClient,
  event: Row<"weekly_events">,
): Promise<ServiceResult<string | null>> {
  const { data, error } = await supabase
    .from("weekly_events")
    .select("selected_sport_id")
    .eq("club_id", event.club_id)
    .lt("week_start_date", event.week_start_date)
    .not("selected_sport_id", "is", null)
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Could not load previous selected sport.") };
  }

  return ok(data?.selected_sport_id ?? null);
}

async function fetchRecentSelections(
  supabase: AppSupabaseClient,
  event: Row<"weekly_events">,
): Promise<ServiceResult<Array<Row<"weekly_events"> & { sports: Pick<Row<"sports">, "category"> | null }>>> {
  const { data, error } = await supabase
    .from("weekly_events")
    .select("*, sports:selected_sport_id(category)")
    .eq("club_id", event.club_id)
    .lt("week_start_date", event.week_start_date)
    .not("selected_sport_id", "is", null)
    .order("week_start_date", { ascending: false })
    .limit(6);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load recent selections.") };
  }

  return ok(data as Array<Row<"weekly_events"> & { sports: Pick<Row<"sports">, "category"> | null }>);
}

async function fetchPreferenceHistory(
  supabase: AppSupabaseClient,
  clubId: string,
  beforeWeekStartDate: string,
): Promise<ServiceResult<Row<"member_preference_history">[]>> {
  const { data, error } = await supabase
    .from("member_preference_history")
    .select()
    .eq("club_id", clubId)
    .lt("week_start_date", beforeWeekStartDate)
    .order("week_start_date", { ascending: false })
    .limit(500);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load preference history.") };
  }

  return ok(data);
}

async function fetchReliabilityHistory(
  supabase: AppSupabaseClient,
  event: Row<"weekly_events">,
): Promise<ServiceResult<ReliabilityHistoryEntry[]>> {
  const { data: events, error: eventsError } = await supabase
    .from("weekly_events")
    .select("id, week_start_date, selected_sport_id")
    .eq("club_id", event.club_id)
    .lt("week_start_date", event.week_start_date)
    .order("week_start_date", { ascending: false })
    .limit(8);

  if (eventsError || !events) {
    return { data: null, error: fromPostgrestError(eventsError, "Could not load reliability events.") };
  }

  const typedEvents = events as RecentEventRow[];
  if (typedEvents.length === 0) {
    return ok([]);
  }

  const weekByEventId = new Map(typedEvents.map((row) => [row.id, row.week_start_date]));
  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select()
    .in("event_id", typedEvents.map((row) => row.id));

  if (attendanceError || !attendance) {
    return { data: null, error: fromPostgrestError(attendanceError, "Could not load reliability attendance.") };
  }

  return ok(
    attendance.map((row) => ({
      userId: row.user_id,
      weekStartDate: weekByEventId.get(row.event_id) ?? "",
      plannedStatus: row.status,
      actualStatus: row.actual_status ?? "unknown",
    })),
  );
}

async function persistPreferenceHistory(
  supabase: AppSupabaseClient,
  event: Row<"weekly_events">,
  decision: FairConstellationDecision,
): Promise<ServiceResult<{ saved: true }>> {
  const votes = await fetchVotes(supabase, event.id);

  if (votes.error) {
    return { data: null, error: votes.error };
  }

  const attendance = await fetchAttendance(supabase, event.id);

  if (attendance.error) {
    return { data: null, error: attendance.error };
  }

  const nonAttendingUsers = new Set(attendance.data.filter((row) => row.status === "not_going").map((row) => row.user_id));
  const coveredSportIds = new Set(decision.activities.map((activity) => activity.sportId));
  const rows = votes.data
    .filter((vote) => !nonAttendingUsers.has(vote.user_id))
    .map((vote) => {
      const covered = coveredSportIds.has(vote.sport_id);
      return {
        club_id: event.club_id,
        user_id: vote.user_id,
        sport_id: vote.sport_id,
        week_start_date: event.week_start_date,
        voted_for: true,
        was_selected: covered,
        vote_rank: vote.vote_rank,
        covered_by_decision: covered,
        covered_by_activity_type: covered ? decision.mode : null,
      };
    });

  if (rows.length === 0) {
    return ok({ saved: true });
  }

  const { error } = await supabase
    .from("member_preference_history")
    .upsert(rows, { onConflict: "club_id,user_id,sport_id,week_start_date" });

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Could not save preference history.") };
  }

  return ok({ saved: true });
}

function mapSport(row: Row<"sports">): AbstractSport {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    intensityLevel: row.intensity_level,
    combinableTags: row.combinable_tags,
  };
}

function mapAttendance(row: Row<"attendance">): ParticipationEntry {
  return {
    userId: row.user_id,
    status: row.status,
    actualStatus: row.actual_status,
  };
}

function mapPreferenceHistory(row: Row<"member_preference_history">): PreferenceHistoryEntry {
  return {
    userId: row.user_id,
    sportId: row.sport_id,
    weekStartDate: row.week_start_date,
    wasSelected: row.was_selected,
    votedFor: row.voted_for,
    voteRank: row.vote_rank,
    coveredByDecision: row.covered_by_decision,
    coveredByActivityType: row.covered_by_activity_type,
  };
}

function mapRecentSelection(
  row: Row<"weekly_events"> & { sports: Pick<Row<"sports">, "category"> | null },
): RecentSelection {
  return {
    sportId: row.selected_sport_id ?? "",
    category: row.sports?.category ?? "unknown",
    weekStartDate: row.week_start_date,
  };
}

function asWeatherSnapshot(value: unknown): ProfileWeatherSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as ProfileWeatherSnapshot;
}
