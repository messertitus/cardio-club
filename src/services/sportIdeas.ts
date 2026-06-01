import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export async function listSportIdeas(supabase: AppSupabaseClient): Promise<ServiceResult<Row<"sport_ideas">[]>> {
  const { data, error } = await supabase.from("sport_ideas").select().order("created_at", { ascending: false }).limit(50);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportideen konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function suggestSportIdea(
  supabase: AppSupabaseClient,
  input: { userId: string; name: string; note?: string | null; location?: string | null; preferredTime?: string | null },
): Promise<ServiceResult<Row<"sport_ideas">>> {
  const { data, error } = await supabase
    .from("sport_ideas")
    .insert({
      name: input.name.trim(),
      note: input.note?.trim() || null,
      location: input.location?.trim() || null,
      preferred_time: input.preferredTime?.trim() || null,
      suggested_by: input.userId,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportidee konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function reviewSportIdea(
  supabase: AppSupabaseClient,
  input: { ideaId: string; status: "approved" | "rejected" },
): Promise<ServiceResult<Row<"sport_ideas">>> {
  const { data, error } = await supabase
    .from("sport_ideas")
    .update({ status: input.status })
    .eq("id", input.ideaId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Sportidee konnte nicht geprüft werden.") };
  }

  return ok(data);
}

export async function isCurrentUserAdmin(supabase: AppSupabaseClient, userId: string): Promise<ServiceResult<boolean>> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  if (error) {
    return { data: null, error: fromPostgrestError(error, "Rolle konnte nicht geladen werden.") };
  }

  if (data?.role === "admin") {
    return ok(true);
  }

  const { data: memberships, error: membershipError } = await supabase.from("club_members").select("role").eq("user_id", userId);

  if (membershipError || !memberships) {
    return { data: null, error: fromPostgrestError(membershipError, "Rolle konnte nicht geladen werden.") };
  }

  return ok(memberships.some((membership) => membership.role === "admin"));
}
