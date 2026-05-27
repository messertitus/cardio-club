import {
  selectFairSport,
  type FairSportSelectionInput,
  type FairSportSelectionResult,
  type PreferenceHistoryEntry,
  type RecentSelection,
  type SelectionContext,
  type Sport,
} from "../lib/fairSportSelection";
import { excludeNonAttendingVotes } from "../lib/votingEligibility";
import type { Row } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type EventDecisionPreview = FairSportSelectionResult;

export type DecisionContext = SelectionContext;

export type GetEventDecisionPreviewInput = {
  eventId: string;
  context?: DecisionContext;
  options?: FairSportSelectionInput["options"];
};

export type FinalizedDecision = {
  event: Row<"weekly_events">;
  decision: FairSportSelectionResult;
};

export type CreatedSubgroups = {
  subgroups: Row<"event_subgroups">[];
};

export async function getEventDecisionPreview(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<EventDecisionPreview>> {
  const decisionInput = await buildDecisionInput(supabase, input);

  if (decisionInput.error) {
    return { data: null, error: decisionInput.error };
  }

  return ok(selectFairSport(decisionInput.data));
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
    return fail("Cannot finalize event decision because no eligible sport won.");
  }

  const { data: event, error } = await supabase
    .from("weekly_events")
    .update({
      selected_sport_id: preview.data.selectedSportId,
      secondary_sport_id: preview.data.secondarySportId ?? null,
      decision_reason: preview.data.reason,
      status: "decided",
    })
    .eq("id", input.eventId)
    .in("status", ["proposing", "voting"])
    .select()
    .single();

  if (error || !event) {
    return { data: null, error: fromPostgrestError(error, "Could not finalize event decision.") };
  }

  const historyResult = await persistPreferenceHistory(supabase, event, preview.data);

  if (historyResult.error) {
    return { data: null, error: historyResult.error };
  }

  return ok({ event, decision: preview.data });
}

export async function createSubgroupsFromDecision(
  supabase: AppSupabaseClient,
  input: {
    eventId: string;
    decision?: FairSportSelectionResult;
    context?: DecisionContext;
  },
): Promise<ServiceResult<CreatedSubgroups>> {
  const decision = input.decision ?? (await getEventDecisionPreview(supabase, input));

  if ("error" in decision && decision.error) {
    return { data: null, error: decision.error };
  }

  const resolvedDecision = "data" in decision ? decision.data : decision;
  const subgroups = resolvedDecision.subgroups;

  if (!subgroups || subgroups.length === 0) {
    return ok({ subgroups: [] });
  }

  const { data, error } = await supabase
    .from("event_subgroups")
    .insert(
      subgroups.map((subgroup, index) => ({
        event_id: input.eventId,
        sport_id: subgroup.sportId,
        title: `Group ${index + 1}`,
      })),
    )
    .select();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not create subgroups.") };
  }

  return ok({ subgroups: data });
}

async function buildDecisionInput(
  supabase: AppSupabaseClient,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<FairSportSelectionInput>> {
  const eventResult = await fetchEvent(supabase, input.eventId);

  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  const event = eventResult.data;
  const [proposalsResult, votesResult, attendanceResult, previousResult, recentResult, historyResult] = await Promise.all([
    fetchProposals(supabase, event.id),
    fetchVotes(supabase, event.id),
    fetchAttendance(supabase, event.id),
    fetchPreviousSelectedSportId(supabase, event),
    fetchRecentSelections(supabase, event),
    fetchPreferenceHistory(supabase, event.club_id, event.week_start_date),
  ]);

  if (proposalsResult.error) {
    return { data: null, error: proposalsResult.error };
  }

  if (votesResult.error) {
    return { data: null, error: votesResult.error };
  }

  if (attendanceResult.error) {
    return { data: null, error: attendanceResult.error };
  }

  if (previousResult.error) {
    return { data: null, error: previousResult.error };
  }

  if (recentResult.error) {
    return { data: null, error: recentResult.error };
  }

  if (historyResult.error) {
    return { data: null, error: historyResult.error };
  }

  const sportIds = [...new Set(proposalsResult.data.map((proposal) => proposal.sport_id))];
  const sportsResult = await fetchSports(supabase, sportIds);

  if (sportsResult.error) {
    return { data: null, error: sportsResult.error };
  }

  const eligibleVotes = excludeNonAttendingVotes(votesResult.data, attendanceResult.data);

  return ok({
    sports: sportsResult.data.map(mapSport),
    proposals: proposalsResult.data.map((proposal) => ({ sportId: proposal.sport_id })),
    votes: eligibleVotes.map((vote) => ({
      sportId: vote.sport_id,
      userId: vote.user_id,
      weight: vote.weight,
    })),
    previousWeekSportId: previousResult.data ?? undefined,
    preferenceHistory: historyResult.data.map(mapPreferenceHistory),
    recentSelections: recentResult.data.map(mapRecentSelection),
    context: input.context,
    options: input.options,
  });
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

async function persistPreferenceHistory(
  supabase: AppSupabaseClient,
  event: Row<"weekly_events">,
  decision: FairSportSelectionResult,
): Promise<ServiceResult<{ saved: true }>> {
  const votes = await fetchVotes(supabase, event.id);

  if (votes.error) {
    return { data: null, error: votes.error };
  }

  const attendance = await fetchAttendance(supabase, event.id);

  if (attendance.error) {
    return { data: null, error: attendance.error };
  }

  const rows = excludeNonAttendingVotes(votes.data, attendance.data).map((vote) => ({
    club_id: event.club_id,
    user_id: vote.user_id,
    sport_id: vote.sport_id,
    week_start_date: event.week_start_date,
    voted_for: true,
    was_selected: vote.sport_id === decision.selectedSportId || vote.sport_id === decision.secondarySportId,
  }));

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

function mapSport(row: Row<"sports">): Sport {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
  };
}

function mapPreferenceHistory(row: Row<"member_preference_history">): PreferenceHistoryEntry {
  return {
    userId: row.user_id,
    sportId: row.sport_id,
    weekStartDate: row.week_start_date,
    wasSelected: row.was_selected,
    votedFor: row.voted_for,
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
