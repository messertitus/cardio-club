import { getWeekStartDate } from "./date";
import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type CreateWeeklyEventInput = {
  clubId: string;
  weekStartDate?: string;
  location?: string | null;
  startsAt?: string | null;
  notes?: string | null;
};

export async function createWeeklyEvent(
  supabase: AppSupabaseClient,
  input: CreateWeeklyEventInput,
): Promise<ServiceResult<Row<"weekly_events">>> {
  const { data, error } = await supabase
    .from("weekly_events")
    .insert({
      club_id: input.clubId,
      week_start_date: input.weekStartDate ?? getWeekStartDate(),
      location: input.location ?? null,
      starts_at: input.startsAt ?? null,
      notes: input.notes ?? null,
      status: "proposing",
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not create weekly event.") };
  }

  return ok(data);
}

export async function getCurrentWeeklyEvent(
  supabase: AppSupabaseClient,
  input: { clubId: string; date?: Date },
): Promise<ServiceResult<Row<"weekly_events"> | null>> {
  const weekStartDate = getWeekStartDate(input.date);
  // A week can hold a Saturday and a Sunday event — return the Sunday one by
  // default (event_day 'sunday' sorts after 'saturday') so callers stay simple.
  const { data, error } = await supabase
    .from("weekly_events")
    .select()
    .eq("club_id", input.clubId)
    .eq("week_start_date", weekStartDate)
    .order("event_day", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Could not load current weekly event.") };
  }

  return ok(data);
}

export async function listEventHistory(
  supabase: AppSupabaseClient,
  clubId: string,
): Promise<ServiceResult<Row<"weekly_events">[]>> {
  const { data, error } = await supabase
    .from("weekly_events")
    .select()
    .eq("club_id", clubId)
    .order("week_start_date", { ascending: false })
    .limit(20);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load event history.") };
  }

  return ok(data);
}
