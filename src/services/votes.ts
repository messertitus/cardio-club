import type { Row } from "./database.types";
import { isVoteRank, MAX_VOTES_PER_EVENT, rankToVoteWeight, type VoteRank } from "../lib/votingRules";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type VoteForSportInput = {
  eventId: string;
  sportId: string;
  userId: string;
  rank: VoteRank;
};

export type RemoveVoteInput = {
  eventId: string;
  sportId: string;
  userId: string;
};

export async function voteForSport(
  supabase: AppSupabaseClient,
  input: VoteForSportInput,
): Promise<ServiceResult<Row<"sport_votes">>> {
  if (!isVoteRank(input.rank)) {
    return fail("Bitte wähle Rang 1, 2 oder 3.");
  }

  const eventResult = await getVoteEvent(supabase, input.eventId);

  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  if (!isVotingOpen(eventResult.data.status)) {
    return fail("Die Abstimmung ist geschlossen, weil die Entscheidung bereits festgelegt wurde.");
  }

  const attendanceResult = await getVoteAttendance(supabase, input.eventId, input.userId);

  if (attendanceResult.error) {
    return { data: null, error: attendanceResult.error };
  }

  if (!attendanceResult.data || attendanceResult.data.status === "not_going") {
    return fail("Bitte gib zuerst an, ob du dabei bist oder vielleicht kommst.");
  }

  const existingVotes = await listVotesForUser(supabase, input.eventId, input.userId);

  if (existingVotes.error) {
    return { data: null, error: existingVotes.error };
  }

  const duplicateSport = existingVotes.data.find((vote) => vote.sport_id === input.sportId);

  if (duplicateSport && duplicateSport.vote_rank !== input.rank) {
    return fail("Du hast für diese Sportart bereits abgestimmt.");
  }

  const duplicateRank = existingVotes.data.find((vote) => vote.vote_rank === input.rank && vote.sport_id !== input.sportId);

  if (duplicateRank) {
    return fail(`Rang ${input.rank} ist bereits vergeben. Entferne diese Stimme zuerst.`);
  }

  if (!duplicateSport && existingVotes.data.length >= MAX_VOTES_PER_EVENT) {
    return fail("Du kannst pro Woche für maximal drei Sportarten abstimmen.");
  }

  const { data, error } = await supabase
    .from("sport_votes")
    .upsert(
      {
        event_id: input.eventId,
        sport_id: input.sportId,
        user_id: input.userId,
        vote_rank: input.rank,
        weight: rankToVoteWeight(input.rank),
      },
      { onConflict: "event_id,sport_id,user_id" },
    )
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not save vote.") };
  }

  return ok(data);
}

export async function removeVote(
  supabase: AppSupabaseClient,
  input: RemoveVoteInput,
): Promise<ServiceResult<{ removed: true }>> {
  const eventResult = await getVoteEvent(supabase, input.eventId);

  if (eventResult.error) {
    return { data: null, error: eventResult.error };
  }

  if (!isVotingOpen(eventResult.data.status)) {
    return fail("Die Abstimmung ist geschlossen, weil die Entscheidung bereits festgelegt wurde.");
  }

  const { error } = await supabase
    .from("sport_votes")
    .delete()
    .eq("event_id", input.eventId)
    .eq("sport_id", input.sportId)
    .eq("user_id", input.userId);

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Could not remove vote.") };
  }

  return ok({ removed: true });
}

export async function listEventVotes(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_votes">[]>> {
  const { data, error } = await supabase.from("sport_votes").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load votes.") };
  }

  return ok(data);
}

async function listVotesForUser(
  supabase: AppSupabaseClient,
  eventId: string,
  userId: string,
): Promise<ServiceResult<Row<"sport_votes">[]>> {
  const { data, error } = await supabase
    .from("sport_votes")
    .select()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load your votes.") };
  }

  return ok(data);
}

async function getVoteEvent(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Pick<Row<"weekly_events">, "status">>> {
  const { data, error } = await supabase.from("weekly_events").select("status").eq("id", eventId).single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load event status.") };
  }

  return ok(data);
}

async function getVoteAttendance(
  supabase: AppSupabaseClient,
  eventId: string,
  userId: string,
): Promise<ServiceResult<Pick<Row<"attendance">, "status"> | null>> {
  const { data, error } = await supabase
    .from("attendance")
    .select("status")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Could not load your attendance status.") };
  }

  return ok(data);
}

function isVotingOpen(status: Row<"weekly_events">["status"]): boolean {
  return status === "proposing" || status === "voting";
}
