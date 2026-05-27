import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type ProposeSportInput = {
  eventId: string;
  sportId: string;
  proposedBy: string;
  note?: string | null;
};

export async function proposeSport(
  supabase: AppSupabaseClient,
  input: ProposeSportInput,
): Promise<ServiceResult<Row<"sport_proposals">>> {
  const { data, error } = await supabase
    .from("sport_proposals")
    .insert({
      event_id: input.eventId,
      sport_id: input.sportId,
      proposed_by: input.proposedBy,
      note: input.note ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not propose sport.") };
  }

  return ok(data);
}

export async function listSports(supabase: AppSupabaseClient): Promise<ServiceResult<Row<"sports">[]>> {
  const { data, error } = await supabase.from("sports").select().order("name", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load sports.") };
  }

  return ok(data);
}

export async function listEventProposals(
  supabase: AppSupabaseClient,
  eventId: string,
): Promise<ServiceResult<Row<"sport_proposals">[]>> {
  const { data, error } = await supabase.from("sport_proposals").select().eq("event_id", eventId);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load proposals.") };
  }

  return ok(data);
}
