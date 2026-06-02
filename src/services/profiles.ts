import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type EnsureProfileInput = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
};

export async function ensureProfile(
  supabase: AppSupabaseClient,
  input: EnsureProfileInput,
): Promise<ServiceResult<Row<"profiles">>> {
  const requestedDisplayName = input.displayName?.trim();
  const normalizedPhone = input.phone ? normalizePhone(input.phone) : null;
  const existing = await supabase.from("profiles").select().eq("id", input.userId).maybeSingle();

  if (existing.data && !requestedDisplayName) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        email: input.email ?? existing.data.email,
        phone: normalizedPhone ?? existing.data.phone,
        postal_code: input.postalCode ?? existing.data.postal_code,
        city: input.city ?? existing.data.city,
        avatar_url: input.avatarUrl ?? existing.data.avatar_url,
      })
      .eq("id", input.userId)
      .select()
      .single();

    if (isMissingProfileColumnError(error)) {
      return ok(existing.data);
    }

    if (error || !data) {
      return { data: null, error: fromPostgrestError(error, "Profil konnte nicht aktualisiert werden.") };
    }

    return ok(data);
  }

  const displayName = requestedDisplayName || "Cardio-Mitglied";
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: input.userId,
        display_name: displayName,
        email: input.email ?? null,
        phone: normalizedPhone,
        postal_code: input.postalCode ?? null,
        city: input.city ?? null,
        avatar_url: input.avatarUrl ?? null,
      },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (isMissingProfileColumnError(error)) {
    const fallback = await supabase
      .from("profiles")
      .upsert(
        {
          id: input.userId,
          display_name: displayName,
          avatar_url: input.avatarUrl ?? null,
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (fallback.error || !fallback.data) {
      return { data: null, error: fromPostgrestError(fallback.error, "Profil konnte nicht angelegt werden.") };
    }

    return ok(fallback.data);
  }

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Profil konnte nicht angelegt werden.") };
  }

  return ok(data);
}

export async function getMyProfile(supabase: AppSupabaseClient, userId: string): Promise<ServiceResult<Row<"profiles">>> {
  const { data, error } = await supabase.from("profiles").select().eq("id", userId).maybeSingle();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Profil konnte nicht geladen werden.") };
  }

  return ok(data);
}

export async function updateProfileCity(
  supabase: AppSupabaseClient,
  input: { userId: string; postalCode: string; city: string },
): Promise<ServiceResult<Row<"profiles">>> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ postal_code: input.postalCode.trim(), city: input.city.trim() })
    .eq("id", input.userId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Stadt konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function updateProfileDetails(
  supabase: AppSupabaseClient,
  input: { userId: string; favoriteSports: string; birthDate: string | null },
): Promise<ServiceResult<Row<"profiles">>> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      favorite_sports: input.favoriteSports.trim() || null,
      birth_date: input.birthDate || null,
    })
    .eq("id", input.userId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Profil konnte nicht gespeichert werden.") };
  }

  return ok(data);
}

export async function requestProfileDisplayNameChange(
  supabase: AppSupabaseClient,
  input: { userId: string; requestedDisplayName: string },
): Promise<ServiceResult<Row<"profile_change_requests">>> {
  const requestedDisplayName = input.requestedDisplayName.trim();
  if (requestedDisplayName.length < 2) {
    return { data: null, error: { message: "Bitte gib einen Namen mit mindestens 2 Zeichen ein." } };
  }

  const { data, error } = await supabase
    .from("profile_change_requests")
    .insert({ user_id: input.userId, requested_display_name: requestedDisplayName })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Namensänderung konnte nicht eingereicht werden.") };
  }

  return ok(data);
}

export async function listProfileNameChangeRequests(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<Row<"profile_change_requests">[]>> {
  const { data, error } = await supabase
    .from("profile_change_requests")
    .select()
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Namensanfragen konnten nicht geladen werden.") };
  }

  return ok(data);
}

export async function reviewProfileNameChangeRequest(
  supabase: AppSupabaseClient,
  input: { requestId: string; status: "approved" | "rejected" },
): Promise<ServiceResult<Row<"profile_change_requests">>> {
  const { data, error } = await supabase.rpc("review_profile_name_change", {
    request_id: input.requestId,
    next_status: input.status,
  });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Namensanfrage konnte nicht bearbeitet werden.") };
  }

  return ok(data);
}

function isMissingProfileColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" &&
    (message.includes("'email' column") || message.includes("'role' column") || message.includes("'postal_code' column") || message.includes("'city' column"))
  );
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("49")) return `+${compact}`;
  if (compact.startsWith("0")) return `+49${compact.slice(1)}`;
  if (/^[1-9]\d{5,11}$/.test(compact)) return `+49${compact}`;
  return compact ? `+${compact}` : "";
}
