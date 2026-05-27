import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type ChatMessageWithAuthor = Row<"chat_messages"> & {
  author_name: string;
};

export async function listChatMessages(
  supabase: AppSupabaseClient,
  clubId: string,
): Promise<ServiceResult<ChatMessageWithAuthor[]>> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select()
    .eq("club_id", clubId)
    .order("created_at", { ascending: true })
    .limit(80);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Chat konnte nicht geladen werden.") };
  }

  const userIds = [...new Set(data.map((message) => message.user_id))];
  const profilesResult = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name">>, error: null };
  const profiles = profilesResult.data ?? [];
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  return ok(data.map((message) => ({ ...message, author_name: names.get(message.user_id) ?? "Mitglied" })));
}

export async function sendChatMessage(
  supabase: AppSupabaseClient,
  input: { clubId: string; eventId?: string | null; userId: string; body: string },
): Promise<ServiceResult<Row<"chat_messages">>> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      club_id: input.clubId,
      event_id: input.eventId ?? null,
      user_id: input.userId,
      body: input.body.trim(),
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Nachricht konnte nicht gesendet werden.") };
  }

  return ok(data);
}

export async function clearMccTestChat(supabase: AppSupabaseClient): Promise<ServiceResult<{ deleted: number }>> {
  const { data, error } = await supabase.rpc("clear_mcc_test_chat", {});

  if (error || typeof data !== "number") {
    return { data: null, error: fromPostgrestError(error, "Chat konnte nicht geleert werden.") };
  }

  return ok({ deleted: data });
}
