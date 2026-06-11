// SERVER-ONLY. Runs the fair-constellation algorithm and persists decisions.
//
// This is the secret core: scoring, ranking, fairness/no-go mechanics and the
// tuned DEFAULT_OPTIONS live in ./algorithm.ts and must never be imported by
// client code. The frontend only ever receives the sanitized DecisionView
// produced by ./sanitize.ts.
//
// Ported 1:1 from the former client services (decisions.ts / eventActivities.ts /
// sportProfiles.ts / weather.ts) so the decision result is byte-for-byte
// unchanged — only the execution location moved from the browser to the server.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  selectFairConstellation,
  type AbstractSport,
  type ApRequirementLevel,
  type FairConstellationDecision,
  type FairConstellationInput,
  type ParticipationEntry,
  type PreferenceHistoryEntry,
  type ProfileWeatherSnapshot,
  type RecentActivitySelection,
  type ReliabilityHistoryEntry,
  type SportProfile,
  type WeatherRules,
} from "./algorithm.ts";
import { fetchEventWeatherSnapshot } from "./weather.ts";

type Sb = SupabaseClient;
type AnyRow = Record<string, any>;

export type ServiceError = { message: string; code?: string; cause?: unknown };
export type ServiceResult<T> = { data: T; error: null } | { data: null; error: ServiceError };

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}
function fail<T = never>(message: string, cause?: unknown, code?: string): ServiceResult<T> {
  return { data: null, error: { message, code, cause } };
}
function fromPostgrestError(error: { message?: string; code?: string } | null, fallback: string): ServiceError {
  return { message: error?.message ?? fallback, code: error?.code, cause: error };
}

export type GetEventDecisionPreviewInput = {
  eventId: string;
  context?: { weatherSnapshot?: ProfileWeatherSnapshot };
  options?: FairConstellationInput["options"];
};

export type FinalizedDecision = { event: AnyRow; decision: FairConstellationDecision };

export async function getEventDecisionPreview(
  supabase: Sb,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<FairConstellationDecision>> {
  const decisionInput = await buildDecisionInput(supabase, input);
  if (decisionInput.error) {
    return { data: null, error: decisionInput.error };
  }
  return ok(selectFairConstellation(decisionInput.data));
}

export async function finalizeEventDecision(
  supabase: Sb,
  input: GetEventDecisionPreviewInput,
): Promise<ServiceResult<FinalizedDecision>> {
  const eventResult = await fetchEvent(supabase, input.eventId);
  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  if (
    eventResult.data.status === "decided" ||
    eventResult.data.status === "completed" ||
    eventResult.data.status === "cancelled"
  ) {
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
      decision_character: decision.decisionCharacter,
      weather_snapshot: decision.weatherSnapshot ?? null,
      activity_contact_id: primaryContactId,
      status: "decided",
      // SECURITY: the raw algorithm internals (scoreBreakdown, explainability,
      // losing-candidate reasons, no-go breakdown) are NOT persisted. They used to
      // be written here and were readable by any member via the REST API. Nothing
      // reads them back (the admin summary is recomputed live from a preview), so
      // we keep them null. Do not re-introduce them — see migration 044.
      decision_scorecard: null,
      decision_explainability: null,
      losing_candidate_reasons: null,
      no_go_breakdown: null,
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
  supabase: Sb,
  input: { eventId: string; decision?: FairConstellationDecision },
): Promise<ServiceResult<{ subgroups: AnyRow[] }>> {
  const decision = input.decision ?? (await getEventDecisionPreview(supabase, input));

  if ("error" in decision && decision.error) {
    return { data: null, error: decision.error };
  }

  const resolvedDecision = ("data" in decision ? decision.data : decision) as FairConstellationDecision;
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
  supabase: Sb,
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
      fetchPreviousPrimarySportId(supabase, event),
      fetchRecentActivities(supabase, event),
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
    listSportProfilesForSports(supabase, sportIds),
  ]);

  if (sportsResult.error) return { data: null, error: sportsResult.error };
  if (profilesResult.error) return { data: null, error: profilesResult.error };

  // Events are local: only consider sport profiles in the event's city. Profiles
  // without a recorded city are kept so events still work where city data is thin.
  const cityScopedProfiles = event.city
    ? profilesResult.data.filter((row) => !row.location_city || row.location_city === event.city)
    : profilesResult.data;
  const sportProfiles = cityScopedProfiles.map(mapSportProfile);
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
    noGos: noGosResult.data.map((noGo) => ({ sportId: noGo.sport_id, userId: noGo.user_id, reason: noGo.reason })),
    attendance: attendanceResult.data.map(mapAttendance),
    previousWeekSportId: previousResult.data ?? undefined,
    previousWeekPrimarySportId: previousResult.data ?? undefined,
    preferenceHistory: historyResult.data.map(mapPreferenceHistory),
    recentActivities: recentResult.data,
    reliabilityHistory: reliabilityResult.data,
    weatherSnapshot,
    options: input.options,
  });
}

async function withActivityContacts(
  supabase: Sb,
  eventId: string,
  decision: FairConstellationDecision,
): Promise<FairConstellationDecision> {
  const activityContactIds = await Promise.all(
    decision.activities.map(async (activity) => {
      return (
        activity.activityContactId ??
        (await selectProfileContact(supabase, activity.profileId)) ??
        activity.assignedUserIds[0] ??
        (await selectActivityContact(supabase, eventId, activity.sportId))
      );
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

async function selectActivityContact(supabase: Sb, eventId: string, selectedSportId: string): Promise<string | null> {
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

async function selectProfileContact(supabase: Sb, profileId: string): Promise<string | null> {
  const { data, error } = await supabase.from("sport_profiles").select("ap_contact_id").eq("id", profileId).maybeSingle();
  if (error || !data) return null;
  return data.ap_contact_id;
}

async function fetchEvent(supabase: Sb, eventId: string): Promise<ServiceResult<AnyRow>> {
  const { data, error } = await supabase.from("weekly_events").select().eq("id", eventId).single();
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load event.") };
  }
  return ok(data);
}

async function fetchProposals(supabase: Sb, eventId: string): Promise<ServiceResult<AnyRow[]>> {
  const { data, error } = await supabase.from("sport_proposals").select().eq("event_id", eventId);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport proposals.") };
  }
  return ok(data);
}

async function fetchVotes(supabase: Sb, eventId: string): Promise<ServiceResult<AnyRow[]>> {
  const { data, error } = await supabase.from("sport_votes").select().eq("event_id", eventId);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport votes.") };
  }
  return ok(data);
}

async function fetchNoGos(supabase: Sb, eventId: string): Promise<ServiceResult<AnyRow[]>> {
  const { data, error } = await supabase.from("sport_no_gos").select().eq("event_id", eventId);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sport no-gos.") };
  }
  return ok(data);
}

async function fetchAttendance(supabase: Sb, eventId: string): Promise<ServiceResult<AnyRow[]>> {
  const { data, error } = await supabase.from("attendance").select().eq("event_id", eventId);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load attendance.") };
  }
  return ok(data);
}

async function fetchSports(supabase: Sb, sportIds: string[]): Promise<ServiceResult<AnyRow[]>> {
  if (sportIds.length === 0) {
    return ok([]);
  }
  const { data, error } = await supabase.from("sports").select().in("id", sportIds).eq("is_active", true);
  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sports.") };
  }
  return ok(data);
}

async function fetchPreviousPrimarySportId(supabase: Sb, event: AnyRow): Promise<ServiceResult<string | null>> {
  const { data: recentEvents, error: recentEventsError } = await supabase
    .from("weekly_events")
    .select("id, week_start_date, selected_sport_id, decision_type")
    .eq("club_id", event.club_id)
    .lt("week_start_date", event.week_start_date)
    .order("week_start_date", { ascending: false })
    .limit(6);

  if (recentEventsError || !recentEvents) {
    return { data: null, error: fromPostgrestError(recentEventsError, "Could not load previous selected sport.") };
  }

  const typedEvents = recentEvents as AnyRow[];
  if (typedEvents.length === 0) return ok(null);

  const { data: activities, error: activitiesError } = await supabase
    .from("event_activities")
    .select("event_id, sport_id, role")
    .in("event_id", typedEvents.map((row) => row.id))
    .eq("role", "primary");

  if (activitiesError || !activities) {
    return { data: null, error: fromPostgrestError(activitiesError, "Could not load previous event activities.") };
  }

  const primaryByEventId = new Map(activities.map((activity) => [activity.event_id, activity.sport_id]));
  const previous = typedEvents.find((row) => primaryByEventId.has(row.id) || row.selected_sport_id);
  return ok(previous ? primaryByEventId.get(previous.id) ?? previous.selected_sport_id ?? null : null);
}

async function fetchRecentActivities(supabase: Sb, event: AnyRow): Promise<ServiceResult<RecentActivitySelection[]>> {
  const { data: events, error: eventsError } = await supabase
    .from("weekly_events")
    .select("id, week_start_date, selected_sport_id, decision_type")
    .eq("club_id", event.club_id)
    .lt("week_start_date", event.week_start_date)
    .order("week_start_date", { ascending: false })
    .limit(6);

  if (eventsError || !events) {
    return { data: null, error: fromPostgrestError(eventsError, "Could not load recent selections.") };
  }

  const typedEvents = events as AnyRow[];
  if (typedEvents.length === 0) return ok([]);

  const { data: activities, error: activitiesError } = await supabase
    .from("event_activities")
    .select("event_id, sport_id, role, activity_type")
    .in("event_id", typedEvents.map((row) => row.id));

  if (activitiesError || !activities) {
    return { data: null, error: fromPostgrestError(activitiesError, "Could not load recent activities.") };
  }

  const sportIds = [
    ...new Set([
      ...activities.map((activity) => activity.sport_id),
      ...typedEvents.map((row) => row.selected_sport_id).filter((sportId): sportId is string => Boolean(sportId)),
    ]),
  ];
  const sportsResult = await fetchSports(supabase, sportIds);
  if (sportsResult.error) return { data: null, error: sportsResult.error };
  const sportsById = new Map(sportsResult.data.map((sport) => [sport.id, sport]));
  const activitiesByEventId = groupBy(activities, (activity) => activity.event_id);
  const recentActivities: RecentActivitySelection[] = [];

  for (const recentEvent of typedEvents) {
    const eventActivities = activitiesByEventId.get(recentEvent.id) ?? [];
    if (eventActivities.length > 0) {
      for (const activity of eventActivities) {
        const sport = sportsById.get(activity.sport_id);
        recentActivities.push({
          eventId: recentEvent.id,
          sportId: activity.sport_id,
          sportName: sport?.name,
          category: sport?.category,
          weekStartDate: recentEvent.week_start_date,
          role: activity.role,
          activityType: activity.activity_type,
        });
      }
      continue;
    }

    if (recentEvent.selected_sport_id) {
      const sport = sportsById.get(recentEvent.selected_sport_id);
      recentActivities.push({
        eventId: recentEvent.id,
        sportId: recentEvent.selected_sport_id,
        sportName: sport?.name,
        category: sport?.category,
        weekStartDate: recentEvent.week_start_date,
        role: "primary",
        activityType: recentEvent.decision_type ?? "single",
      });
    }
  }

  return ok(recentActivities);
}

async function fetchPreferenceHistory(
  supabase: Sb,
  clubId: string,
  beforeWeekStartDate: string,
): Promise<ServiceResult<AnyRow[]>> {
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

async function fetchReliabilityHistory(supabase: Sb, event: AnyRow): Promise<ServiceResult<ReliabilityHistoryEntry[]>> {
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

  const typedEvents = events as AnyRow[];
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
  supabase: Sb,
  event: AnyRow,
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
  const coveredByUserAndSport = new Set(
    decision.activities.flatMap((activity) => activity.assignedUserIds.map((userId) => `${userId}:${activity.sportId}`)),
  );
  const rows = votes.data
    .filter((vote) => !nonAttendingUsers.has(vote.user_id))
    .map((vote) => {
      const covered = coveredByUserAndSport.has(`${vote.user_id}:${vote.sport_id}`);
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

// ---- event activities (ported from services/eventActivities.ts) ----

async function replaceEventActivitiesFromDecision(
  supabase: Sb,
  input: { eventId: string; startsAt?: string | null; decision: FairConstellationDecision },
): Promise<ServiceResult<AnyRow[]>> {
  const { error: deleteError } = await supabase.from("event_activities").delete().eq("event_id", input.eventId);
  if (deleteError) {
    return { data: null, error: fromPostgrestError(deleteError, "Alte Event-Aktivitäten konnten nicht ersetzt werden.") };
  }

  if (input.decision.activities.length === 0) {
    return ok([]);
  }

  const sportIds = [...new Set(input.decision.activities.map((activity) => activity.sportId))];
  const sportsResult = sportIds.length
    ? await supabase.from("sports").select("id, name").in("id", sportIds)
    : { data: [] as AnyRow[], error: null };

  if (sportsResult.error || !sportsResult.data) {
    return { data: null, error: fromPostgrestError(sportsResult.error, "Sportarten der Event-Aktivitäten konnten nicht geladen werden.") };
  }

  const sportNames = new Map(sportsResult.data.map((sport) => [sport.id, sport.name]));

  const { data, error } = await supabase
    .from("event_activities")
    .insert(
      input.decision.activities.map((activity) => ({
        event_id: input.eventId,
        sport_id: activity.sportId,
        sport_profile_id: activity.profileId,
        role: activity.role,
        activity_type: input.decision.mode,
        title: activityTitle(sportNames.get(activity.sportId) ?? "Sportart", activity.profileName, activity.locationName),
        location: activity.locationName ?? null,
        starts_at: input.startsAt ?? null,
        activity_contact_id: activity.activityContactId ?? null,
        assigned_user_ids: activity.assignedUserIds,
      })),
    )
    .select();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Event-Aktivitäten konnten nicht gespeichert werden.") };
  }
  return ok(data);
}

function activityTitle(sportName: string, profileName: string, locationName?: string | null): string {
  if (profileName.toLowerCase().includes(sportName.toLowerCase())) {
    return profileName;
  }
  if (locationName) {
    return `${sportName} ${locationPreposition(locationName)} ${locationName}`;
  }
  return `${sportName} · ${profileName}`;
}

function locationPreposition(location: string): string {
  const lower = location.toLowerCase();
  if (lower.includes("see") || lower.includes("rhein") || lower.includes("ufer")) return "am";
  if (lower.includes("park") || lower.includes("halle") || lower.includes("platz") || lower.includes("schänzle")) return "im";
  return "in";
}

// ---- sport profiles (ported from services/sportProfiles.ts, without the
// AsyncStorage cache which is a client-only concern) ----

export async function listSportProfilesForSports(supabase: Sb, sportIds: string[]): Promise<ServiceResult<AnyRow[]>> {
  const normalizedSportIds = normalizeSportIds(sportIds);
  if (normalizedSportIds.length === 0) {
    return ok([]);
  }

  const linksResult = await supabase.from("sport_profile_sports").select().in("sport_id", normalizedSportIds);

  if (linksResult.error) {
    if (!isMissingRelationError(linksResult.error)) {
      return { data: null, error: fromPostgrestError(linksResult.error, "Sportprofile konnten nicht geladen werden.") };
    }
    return loadLegacyProfilesForSports(supabase, normalizedSportIds);
  }

  const linkedProfileIds = [...new Set((linksResult.data ?? []).map((link) => link.profile_id))];
  const linkedRows = linkedProfileIds.length
    ? await supabase.from("sport_profiles").select().in("id", linkedProfileIds).eq("is_active", true).order("name", { ascending: true })
    : { data: [] as AnyRow[], error: null };

  if (linkedRows.error || !linkedRows.data) {
    return { data: null, error: fromPostgrestError(linkedRows.error, "Sportprofile konnten nicht geladen werden.") };
  }

  const legacyRows = await loadLegacyProfilesForSports(supabase, normalizedSportIds);
  if (legacyRows.error) return legacyRows;

  const profilesById = new Map(linkedRows.data.map((profile) => [profile.id, profile]));
  const result = new Map<string, AnyRow>();
  for (const link of linksResult.data ?? []) {
    const profile = profilesById.get(link.profile_id);
    if (!profile?.is_active) continue;
    result.set(`${profile.id}:${link.sport_id}`, { ...profile, sport_id: link.sport_id });
  }
  for (const profile of legacyRows.data) {
    result.set(`${profile.id}:${profile.sport_id}`, profile);
  }

  return ok([...result.values()].sort((a, b) => a.name.localeCompare(b.name)));
}

async function loadLegacyProfilesForSports(supabase: Sb, sportIds: string[]): Promise<ServiceResult<AnyRow[]>> {
  const { data, error } = await supabase
    .from("sport_profiles")
    .select()
    .in("sport_id", sportIds)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportprofile konnten nicht geladen werden.") };
  }
  return ok(data);
}

function normalizeSportIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isMissingRelationError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : "";
  return code === "42P01" || message.includes("sport_profile_sports");
}

function mapSportProfile(row: AnyRow): SportProfile {
  return {
    id: row.id,
    sportId: row.sport_id,
    name: row.name,
    locationName: row.location_name,
    postalCode: row.postal_code,
    venueGroupKey: row.venue_group_key,
    latitude: row.latitude,
    longitude: row.longitude,
    locationType: row.location_type,
    isIndoor: row.is_indoor,
    minimumGroupSize: row.minimum_group_size,
    maximumGroupSize: row.maximum_group_size,
    minimumParticipants: row.minimum_participants,
    maximumParticipants: row.maximum_participants,
    requiredEquipment: row.required_equipment,
    availableEquipment: row.available_equipment,
    costNote: row.cost_note,
    costRequired: row.cost_required,
    costPerPerson: row.cost_per_person,
    costCurrency: row.cost_currency,
    openingNotes: row.opening_notes,
    lightingAvailable: row.lighting_available,
    transitNotes: row.transit_notes,
    amenityNotes: row.amenity_notes,
    reservationRequired: row.reservation_required,
    safetyNotes: row.safety_notes,
    locationRules: row.location_rules,
    apRequired: row.ap_required,
    apRequirementLevel: row.ap_requirement_level as ApRequirementLevel | null,
    apContactId: row.ap_contact_id,
    weatherRules: isWeatherRules(row.weather_rules) ? row.weather_rules : {},
    isActive: row.is_active,
  };
}

function isWeatherRules(value: unknown): value is WeatherRules {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---- small mappers (ported from services/decisions.ts) ----

function mapSport(row: AnyRow): AbstractSport {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    intensityLevel: row.intensity_level,
    combinableTags: row.combinable_tags,
  };
}

function mapAttendance(row: AnyRow): ParticipationEntry {
  return {
    userId: row.user_id,
    status: row.status,
    actualStatus: row.actual_status,
  };
}

function mapPreferenceHistory(row: AnyRow): PreferenceHistoryEntry {
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

function asWeatherSnapshot(value: unknown): ProfileWeatherSnapshot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as ProfileWeatherSnapshot;
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}
