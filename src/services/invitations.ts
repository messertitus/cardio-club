import type { Row } from "./database.types";
import { trackAppEvent } from "./analytics";
import { COMMUNITY_EVENTS } from "../lib/analyticsEvents";
import { fail, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type InvitationCodeWithUsage = Row<"invitation_codes"> & {
  usedByName: string | null;
  usedByPhone: string | null;
};

export type InvitationTreeEntry = Row<"invitation_codes"> & {
  createdByName: string | null;
  usedByName: string | null;
  usedByCity: string | null;
};

export async function validateInvitationCode(
  supabase: AppSupabaseClient,
  code: string,
): Promise<ServiceResult<{ valid: boolean }>> {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return ok({ valid: false });
  }

  const { data, error } = await supabase.rpc("validate_invitation_code", {
    input_code: normalizedCode,
  });

  if (error) {
    return fail("Einladungscode konnte nicht geprüft werden.", error);
  }

  return ok({ valid: Boolean(data) });
}

export async function consumeInvitationCode(
  supabase: AppSupabaseClient,
  code: string,
): Promise<ServiceResult<{ consumed: boolean }>> {
  const normalizedCode = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc("consume_invitation_code", {
    input_code: normalizedCode,
  });

  if (error) {
    // TEMP DIAGNOSTIC: surface the raw RPC error (message + code) so we can see
    // the real reason (e.g. "Not authenticated", "permission denied", schema cache).
    const code = (error as { code?: string }).code;
    return fail(`${error.message}${code ? ` [${code}]` : ""}`, error);
  }

  return ok({ consumed: Boolean(data) });
}

export async function createInvitationCode(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<{ code: string }>> {
  const { data, error } = await supabase.rpc("create_invitation_code", {});

  if (error || !data) {
    return fail(inviteErrorMessage(error), error);
  }

  void trackAppEvent(supabase, COMMUNITY_EVENTS.inviteCreated);

  return ok({ code: data });
}

export async function listInvitationCodes(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<ServiceResult<InvitationCodeWithUsage[]>> {
  const { data, error } = await supabase
    .from("invitation_codes")
    .select()
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return fail("Einladungscodes konnten nicht geladen werden.", error);
  }

  const usedIds = [...new Set(data.map((code) => code.used_by).filter((id): id is string => Boolean(id)))];
  const profilesResult = usedIds.length
    ? await supabase.from("profiles").select("id, display_name, phone").in("id", usedIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name" | "phone">>, error: null };

  if (profilesResult.error || !profilesResult.data) {
    return fail("Verwendete Codes konnten nicht zugeordnet werden.", profilesResult.error);
  }

  const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  return ok(
    data.map((code) => {
      const profile = code.used_by ? profiles.get(code.used_by) : null;
      return {
        ...code,
        usedByName: profile?.display_name ?? null,
        usedByPhone: profile?.phone ?? null,
      };
    }),
  );
}

export async function listInvitationTree(supabase: AppSupabaseClient): Promise<ServiceResult<InvitationTreeEntry[]>> {
  const { data, error } = await supabase
    .from("invitation_codes")
    .select()
    .order("created_at", { ascending: true });

  if (error || !data) {
    return fail("Einladungsbaum konnte nicht geladen werden.", error);
  }

  const profileIds = [
    ...new Set(
      data
        .flatMap((code) => [code.created_by, code.used_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const profilesResult = profileIds.length
    ? await supabase.from("profiles").select("id, display_name, city").in("id", profileIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name" | "city">>, error: null };

  if (profilesResult.error || !profilesResult.data) {
    return fail("Einladungsbaum konnte nicht zugeordnet werden.", profilesResult.error);
  }

  const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  return ok(
    data.map((code) => ({
      ...code,
      createdByName: code.created_by ? profiles.get(code.created_by)?.display_name ?? "Mitglied" : null,
      usedByName: code.used_by ? profiles.get(code.used_by)?.display_name ?? "Mitglied" : null,
      usedByCity: code.used_by ? profiles.get(code.used_by)?.city ?? null : null,
    })),
  );
}

function inviteErrorMessage(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  const lower = message.toLowerCase();

  if (lower.includes("invite limit")) {
    return "Du hast deine 3 Einladungscodes bereits erstellt.";
  }

  if (lower.includes("not authenticated")) {
    return "Bitte melde dich neu an, um Codes zu erstellen.";
  }

  if (lower.includes("gen_random_bytes")) {
    return "Bitte führe die neue Supabase-Migration für Einladungscodes aus.";
  }

  return message || "Einladungscode konnte nicht erstellt werden.";
}
