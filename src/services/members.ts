import type { ClubMemberRole, Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type MccMember = {
  userId: string;
  displayName: string;
  phone: string | null;
  city: string | null;
  favoriteSports: string | null;
  birthDate: string | null;
  role: ClubMemberRole;
  joinedAt: string;
  contactSports: string[];
};

export async function listMccMembers(
  supabase: AppSupabaseClient,
  input: { clubId: string },
): Promise<ServiceResult<MccMember[]>> {
  const { data: memberships, error } = await supabase
    .from("club_members")
    .select()
    .eq("club_id", input.clubId)
    .order("joined_at", { ascending: false });

  if (error || !memberships) {
    return { data: null, error: fromPostgrestError(error, "Mitglieder konnten nicht geladen werden.") };
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, phone, city, favorite_sports, birth_date").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name" | "phone" | "city" | "favorite_sports" | "birth_date">>, error: null };

  if (profilesError || !profiles) {
    return { data: null, error: fromPostgrestError(profilesError, "Profile konnten nicht geladen werden.") };
  }

  const names = new Map(profiles.map((profile) => [profile.id, toMemberDisplayName(profile.display_name)]));
  const phones = new Map(profiles.map((profile) => [profile.id, profile.phone]));
  const cities = new Map(profiles.map((profile) => [profile.id, profile.city]));
  const favoriteSports = new Map(profiles.map((profile) => [profile.id, profile.favorite_sports]));
  const birthDates = new Map(profiles.map((profile) => [profile.id, profile.birth_date]));
  const contactSports = await loadContactSports(supabase, userIds);
  if (contactSports.error) {
    return { data: null, error: contactSports.error };
  }

  return ok(
    memberships.map((membership) => ({
      userId: membership.user_id,
      role: membership.role,
      joinedAt: membership.joined_at,
      displayName: names.get(membership.user_id) ?? "Mitglied",
      phone: phones.get(membership.user_id) ?? null,
      city: cities.get(membership.user_id) ?? null,
      favoriteSports: favoriteSports.get(membership.user_id) ?? null,
      birthDate: birthDates.get(membership.user_id) ?? null,
      contactSports: contactSports.data.get(membership.user_id) ?? [],
    })),
  );
}

async function loadContactSports(supabase: AppSupabaseClient, userIds: string[]): Promise<ServiceResult<Map<string, string[]>>> {
  if (userIds.length === 0) return ok(new Map());

  const { data: contacts, error } = await supabase.from("sport_contacts").select("user_id, sport_id").in("user_id", userIds);

  if (error || !contacts) {
    return { data: null, error: fromPostgrestError(error, "Ansprechpartner konnten nicht geladen werden.") };
  }

  const sportIds = [...new Set(contacts.map((contact) => contact.sport_id))];
  const { data: sports, error: sportsError } = sportIds.length
    ? await supabase.from("sports").select("id, name").in("id", sportIds)
    : { data: [] as Array<Pick<Row<"sports">, "id" | "name">>, error: null };

  if (sportsError || !sports) {
    return { data: null, error: fromPostgrestError(sportsError, "Sportarten der Ansprechpartner konnten nicht geladen werden.") };
  }

  const sportNames = new Map(sports.map((sport) => [sport.id, sport.name]));
  const result = new Map<string, string[]>();

  for (const contact of contacts) {
    const next = result.get(contact.user_id) ?? [];
    next.push(sportNames.get(contact.sport_id) ?? "Sportart");
    result.set(contact.user_id, next);
  }

  return ok(result);
}

function toMemberDisplayName(value: string): string {
  const trimmed = value.trim();

  return trimmed.includes("@") ? "Mitglied" : trimmed || "Mitglied";
}
