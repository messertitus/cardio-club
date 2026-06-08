import type { Row } from "./database.types";
import { fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type ChatMessageWithAuthor = Row<"chat_messages"> & {
  author_name: string;
  reply_to?: {
    id: string;
    author_name: string;
    body: string;
  } | null;
};

export async function listChatMessages(
  supabase: AppSupabaseClient,
  input: { clubId: string; eventId: string; sportId?: string | null },
): Promise<ServiceResult<ChatMessageWithAuthor[]>> {
  const query = supabase
    .from("chat_messages")
    .select()
    .eq("club_id", input.clubId)
    .eq("event_id", input.eventId)
    .order("created_at", { ascending: true })
    .limit(80);
  const { data, error } = input.sportId ? await query.eq("sport_id", input.sportId) : await query.is("sport_id", null);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Chat konnte nicht geladen werden.") };
  }

  const userIds = [...new Set(data.map((message) => message.user_id))];
  const profilesResult = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name">>, error: null };
  const profiles = profilesResult.data ?? [];
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  const messagesById = new Map(data.map((message) => [message.id, message]));

  return ok(
    data.map((message) => {
      const replied = message.reply_to_message_id ? messagesById.get(message.reply_to_message_id) : null;
      return {
        ...message,
        author_name: names.get(message.user_id) ?? "Mitglied",
        reply_to: replied ? { id: replied.id, author_name: names.get(replied.user_id) ?? "Mitglied", body: replied.body } : null,
      };
    }),
  );
}

export async function sendChatMessage(
  supabase: AppSupabaseClient,
  input: { clubId: string; eventId: string; sportId?: string | null; userId: string; body: string; replyToMessageId?: string | null },
): Promise<ServiceResult<Row<"chat_messages">>> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      club_id: input.clubId,
      event_id: input.eventId,
      sport_id: input.sportId ?? null,
      user_id: input.userId,
      body: input.body.trim(),
      reply_to_message_id: input.replyToMessageId ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Nachricht konnte nicht gesendet werden.") };
  }

  return ok(data);
}
