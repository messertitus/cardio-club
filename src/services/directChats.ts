import type { Row } from "./database.types";
import { fail, fromPostgrestError, ok, type ServiceResult } from "./result";
import type { AppSupabaseClient } from "./supabaseClient";

export type DirectChatWithNames = Row<"direct_chats"> & {
  requesterName: string;
  adminName: string;
};

export type DirectChatMessageWithAuthor = Row<"direct_chat_messages"> & {
  author_name: string;
};

export async function getOrCreateDirectChat(
  supabase: AppSupabaseClient,
  input: { requesterId: string; adminId: string },
): Promise<ServiceResult<Row<"direct_chats">>> {
  if (input.requesterId === input.adminId) {
    return fail("Du kannst dich nicht selbst als Admin kontaktieren.");
  }

  const existing = await supabase
    .from("direct_chats")
    .select()
    .eq("requester_id", input.requesterId)
    .eq("admin_id", input.adminId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: fromPostgrestError(existing.error, "Direktchat konnte nicht geprüft werden.") };
  }

  if (existing.data) {
    return ok(existing.data);
  }

  const { data, error } = await supabase
    .from("direct_chats")
    .insert({
      requester_id: input.requesterId,
      admin_id: input.adminId,
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Direktchat konnte nicht erstellt werden.") };
  }

  return ok(data);
}

export async function listDirectChats(
  supabase: AppSupabaseClient,
): Promise<ServiceResult<DirectChatWithNames[]>> {
  const { data, error } = await supabase
    .from("direct_chats")
    .select()
    .order("status", { ascending: true })
    .order("last_message_at", { ascending: false });

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Direktchats konnten nicht geladen werden.") };
  }

  const userIds = [...new Set(data.flatMap((chat) => [chat.requester_id, chat.admin_id]))];
  const profilesResult = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name">>, error: null };

  if (profilesResult.error || !profilesResult.data) {
    return { data: null, error: fromPostgrestError(profilesResult.error, "Direktchat-Namen konnten nicht geladen werden.") };
  }

  const names = new Map(profilesResult.data.map((profile) => [profile.id, profile.display_name]));

  return ok(
    data.map((chat) => ({
      ...chat,
      requesterName: names.get(chat.requester_id) ?? "Mitglied",
      adminName: names.get(chat.admin_id) ?? "Admin",
    })),
  );
}

export async function listDirectChatMessages(
  supabase: AppSupabaseClient,
  chatId: string,
): Promise<ServiceResult<DirectChatMessageWithAuthor[]>> {
  const { data, error } = await supabase
    .from("direct_chat_messages")
    .select()
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(120);

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Direktnachrichten konnten nicht geladen werden.") };
  }

  const userIds = [...new Set(data.map((message) => message.user_id))];
  const profilesResult = userIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
    : { data: [] as Array<Pick<Row<"profiles">, "id" | "display_name">>, error: null };
  const names = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name]));

  return ok(data.map((message) => ({ ...message, author_name: names.get(message.user_id) ?? "Mitglied" })));
}

export async function sendDirectChatMessage(
  supabase: AppSupabaseClient,
  input: { chatId: string; userId: string; body: string },
): Promise<ServiceResult<Row<"direct_chat_messages">>> {
  const body = input.body.trim();
  if (!body) {
    return fail("Bitte gib eine Nachricht ein.");
  }

  const { data, error } = await supabase
    .from("direct_chat_messages")
    .insert({
      chat_id: input.chatId,
      user_id: input.userId,
      body,
    })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Direktnachricht konnte nicht gesendet werden.") };
  }

  return ok(data);
}

export async function closeDirectChat(
  supabase: AppSupabaseClient,
  input: { chatId: string; adminId: string },
): Promise<ServiceResult<Row<"direct_chats">>> {
  const { data, error } = await supabase
    .from("direct_chats")
    .update({
      status: "closed",
      closed_by: input.adminId,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.chatId)
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: fromPostgrestError(error, "Direktchat konnte nicht geschlossen werden.") };
  }

  return ok(data);
}
