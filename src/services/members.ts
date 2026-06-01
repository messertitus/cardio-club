import type { ClubMemberRole, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type MccMember = {
  userId: string;
  displayName: string;
  phone: string | null;
  city: string | null;
  role: ClubMemberRole;
  joinedAt: string;
  isActivityContact: boolean;
};

export async function listMccMembers(
  supabase: AppSupabaseClient,
  input: { clubId: string; activityContactId?: string | null },
): Promise<ServiceResult<MccMember[]>> {
  const { data: memberships, error } = await supabase
    .from("club_members")
    .select()
    .eq("club_id", input.clubId)
    .order("joined_at", { ascending: true });

  if (error || !memberships) {
    return { data: null, error: fromPostgrestError(error, "Mitglieder konnten nicht geladen werden.") };
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, phone, city").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name" | "phone" | "city">>, error: null };

  if (profilesError || !profiles) {
    return { data: null, error: fromPostgrestError(profilesError, "Profile konnten nicht geladen werden.") };
  }

  const names = new Map(profiles.map((profile) => [profile.id, toMemberDisplayName(profile.display_name)]));
  const phones = new Map(profiles.map((profile) => [profile.id, profile.phone]));
  const cities = new Map(profiles.map((profile) => [profile.id, profile.city]));
  return ok(
    memberships.map((membership) => ({
      userId: membership.user_id,
      role: membership.role,
      joinedAt: membership.joined_at,
      displayName: names.get(membership.user_id) ?? "Mitglied",
      phone: phones.get(membership.user_id) ?? null,
      city: cities.get(membership.user_id) ?? null,
      isActivityContact: membership.user_id === input.activityContactId,
    })),
  );
}

function toMemberDisplayName(value: string): string {
  const trimmed = value.trim();

  return trimmed.includes("@") ? "Mitglied" : trimmed || "Mitglied";
}
