import type { AppSupabaseClient } from "./supabaseClient";
import type { ClubMemberRole, Row } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import { ensureProfile } from "./profiles";

export type CreateClubInput = {
  name: string;
  description?: string | null;
  createdBy: string;
  creatorDisplayName?: string | null;
};

export type JoinClubInput = {
  clubId: string;
  userId: string;
  role?: ClubMemberRole;
};

export type CreatedClub = {
  club: Row<"clubs">;
  membership: Row<"club_members">;
};

export type ClubWithRole = Row<"clubs"> & {
  role: ClubMemberRole;
};

export async function listClubsForUser(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<ServiceResult<ClubWithRole[]>> {
  const { data: memberships, error: membershipError } = await supabase
    .from("club_members")
    .select()
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });

  if (membershipError || !memberships) {
    return { data: null, error: fromPostgrestError(membershipError, "Could not load club memberships.") };
  }

  if (memberships.length === 0) {
    return ok([]);
  }

  const clubIds = memberships.map((membership) => membership.club_id);
  const rolesByClubId = new Map(memberships.map((membership) => [membership.club_id, membership.role]));
  const { data: clubs, error: clubsError } = await supabase.from("clubs").select().in("id", clubIds);

  if (clubsError || !clubs) {
    return { data: null, error: fromPostgrestError(clubsError, "Could not load clubs.") };
  }

  return ok(clubs.map((club) => ({ ...club, role: rolesByClubId.get(club.id) ?? "member" })));
}

export async function getClub(
  supabase: AppSupabaseClient,
  clubId: string,
): Promise<ServiceResult<Row<"clubs">>> {
  const { data, error } = await supabase.from("clubs").select().eq("id", clubId).single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not load club.") };
  }

  return ok(data);
}

export async function createClub(
  supabase: AppSupabaseClient,
  input: CreateClubInput,
): Promise<ServiceResult<CreatedClub>> {
  const profile = await ensureProfile(supabase, {
    userId: input.createdBy,
    displayName: input.creatorDisplayName,
  });

  if (profile.error) {
    return { data: null, error: profile.error };
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .insert({
      name: input.name,
      description: input.description ?? null,
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (clubError || !club) {
    return { data: null, error: fromPostgrestError(clubError, "Could not create club.") };
  }

  const membership = await joinClub(supabase, {
    clubId: club.id,
    userId: input.createdBy,
    role: "admin",
  });

  if (membership.error) {
    await supabase.from("clubs").delete().eq("id", club.id);
    return fail("Club was created but owner membership could not be created.", membership.error);
  }

  return ok({ club, membership: membership.data });
}

export async function joinClub(
  supabase: AppSupabaseClient,
  input: JoinClubInput,
): Promise<ServiceResult<Row<"club_members">>> {
  const { data, error } = await supabase
    .from("club_members")
    .upsert(
      {
        club_id: input.clubId,
        user_id: input.userId,
        role: input.role ?? "member",
      },
      { onConflict: "club_id,user_id" },
    )
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Could not join club.") };
  }

  return ok(data);
}
