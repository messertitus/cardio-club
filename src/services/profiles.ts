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
  const existing = await supabase.from("profiles").select().eq("id", input.userId).maybeSingle();

  if (existing.data && !requestedDisplayName) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        email: input.email ?? existing.data.email,
        phone: input.phone ?? existing.data.phone,
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
        phone: input.phone ?? null,
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
