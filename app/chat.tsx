import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import {
  closeDirectChat,
  getMccEventState,
  listChatMessages,
  listDirectChatMessages,
  listDirectChats,
  sendChatMessage,
  sendDirectChatMessage,
  type DirectChatWithNames,
  type MccEventState,
} from "../src/services";

type ChatMessage = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

type ChatChannel =
  | {
      id: string;
      kind: "event";
      label: string;
      sportId: string | null;
    }
  | {
      id: string;
      kind: "direct";
      label: string;
      directChat: DirectChatWithNames;
    };

export default function ChatScreen() {
  const { directChatId } = useLocalSearchParams<{ directChatId?: string }>();
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [directChats, setDirectChats] = useState<DirectChatWithNames[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(directChatId ? `direct:${directChatId}` : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  const isDecided = state?.event.status === "decided" || state?.event.status === "completed";
  const channels = useMemo(() => buildChannels(state, directChats, user?.id ?? null), [directChats, state, user?.id]);
  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? channels[0] ?? null;
  const activeDirectChat = activeChannel?.kind === "direct" ? activeChannel.directChat : null;
  const inputLocked = !activeChannel || (activeChannel.kind === "event" && !isDecided) || activeDirectChat?.status === "closed";

  const loadMessagesForChannel = useCallback(
    async (channel: ChatChannel | null, nextState: MccEventState | null = state) => {
      if (!channel) {
        setMessages([]);
        return;
      }

      if (channel.kind === "event") {
        if (!nextState || !(nextState.event.status === "decided" || nextState.event.status === "completed")) {
          setMessages([]);
          return;
        }

        const result = await listChatMessages(supabase, {
          clubId: nextState.clubId,
          eventId: nextState.event.id,
          sportId: channel.sportId,
        });
        if (result.error) {
          setNotice(result.error.message);
          return;
        }
        setMessages(result.data);
        return;
      }

      const result = await listDirectChatMessages(supabase, channel.directChat.id);
      if (result.error) {
        setNotice(result.error.message);
        return;
      }
      setMessages(result.data);
    },
    [state],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [nextState, directResult] = await Promise.all([getMccEventState(supabase, user.id), listDirectChats(supabase)]);
    setBusy(false);

    if (nextState.error || directResult.error) {
      setNotice(nextState.error?.message ?? directResult.error?.message ?? "Chat konnte nicht geladen werden.");
      return;
    }

    setState(nextState.data);
    setDirectChats(directResult.data);
    const nextChannels = buildChannels(nextState.data, directResult.data, user.id);
    const requestedChannelId = directChatId ? `direct:${directChatId}` : null;
    const nextActive =
      (requestedChannelId && nextChannels.some((channel) => channel.id === requestedChannelId) ? requestedChannelId : null) ??
      (activeChannelId && nextChannels.some((channel) => channel.id === activeChannelId) ? activeChannelId : null) ??
      nextChannels[0]?.id ??
      null;
    setActiveChannelId(nextActive);

    const channel = nextChannels.find((candidate) => candidate.id === nextActive) ?? nextChannels[0] ?? null;
    setNotice(null);
    await loadMessagesForChannel(channel, nextState.data);
  }, [activeChannelId, directChatId, loadMessagesForChannel, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  async function switchChannel(channel: ChatChannel) {
    setActiveChannelId(channel.id);
    setBusy(true);
    await loadMessagesForChannel(channel);
    setBusy(false);
  }

  async function send() {
    if (!draft.trim() || !user || !activeChannel || inputLocked) return;
    const body = draft.trim();
    const optimisticMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
      author_name: "Du",
    };
    setDraft("");
    setMessages((current) => [...current, optimisticMessage]);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const result =
      activeChannel.kind === "event"
        ? state
          ? await sendChatMessage(supabase, {
              clubId: state.clubId,
              eventId: state.event.id,
              sportId: activeChannel.sportId,
              userId: user.id,
              body,
            })
          : { data: null, error: { message: "Event konnte nicht geladen werden." } }
        : await sendDirectChatMessage(supabase, {
            chatId: activeChannel.directChat.id,
            userId: user.id,
            body,
          });

    if (result.error) {
      setNotice(result.error.message);
      setDraft(body);
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      return;
    }
    await switchChannel(activeChannel);
  }

  async function closeActiveDirectChat() {
    if (!user || !activeDirectChat || activeDirectChat.admin_id !== user.id || activeDirectChat.status === "closed") return;
    const result = await closeDirectChat(supabase, { chatId: activeDirectChat.id, adminId: user.id });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    await load();
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Chat</Text>
            <ThemeToggle />
          </View>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {channels.length > 1 ? (
            <View style={styles.channelRow}>
              {channels.map((channel) => (
                <Pressable
                  key={channel.id}
                  onPress={() => void switchChannel(channel)}
                  style={[
                    styles.channelChip,
                    { borderColor: theme.border, backgroundColor: theme.softSurface },
                    activeChannel?.id === channel.id && { backgroundColor: theme.button },
                  ]}
                >
                  <Text style={[styles.channelText, { color: activeChannel?.id === channel.id ? theme.inverse : theme.text }]}>{channel.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {activeChannel?.kind === "event" && !isDecided ? (
            <View style={[styles.lockedPanel, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.lockedTitle, { color: theme.text }]}>Noch geschlossen</Text>
              <Text style={[styles.lockedText, { color: theme.muted }]}>Der Event-Chat öffnet, sobald die Sportart entschieden wurde.</Text>
            </View>
          ) : null}

          {activeDirectChat ? (
            <View style={[styles.directInfo, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <View style={styles.directInfoText}>
                <Text style={[styles.directTitle, { color: theme.text }]}>{activeChannel?.label}</Text>
                <Text style={[styles.directMeta, { color: theme.muted }]}>
                  {activeDirectChat.status === "closed" ? "geschlossen" : "offen"} · Admin: {activeDirectChat.adminName}
                </Text>
              </View>
              {activeDirectChat.admin_id === user.id && activeDirectChat.status === "open" ? (
                <Pressable style={[styles.closeButton, { backgroundColor: theme.surface }]} onPress={() => void closeActiveDirectChat()}>
                  <Text style={[styles.closeButtonText, { color: theme.text }]}>Schließen</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {busy && messages.length === 0 ? <LoadingState /> : null}
            {messages.length === 0 && !busy ? <Text style={[styles.empty, { color: theme.muted }]}>Noch keine Nachrichten.</Text> : null}
            {messages.map((message) => {
              const mine = message.user_id === user.id;
              return (
                <View
                  key={message.id}
                  style={[
                    styles.bubble,
                    { borderColor: theme.border, backgroundColor: theme.softSurface },
                    mine && { borderColor: theme.accent, backgroundColor: theme.surface, alignSelf: "flex-end" },
                  ]}
                >
                  <Text style={[styles.meta, { color: theme.muted }]}>
                    {mine ? "Du" : message.author_name} · {formatTime(message.created_at)}
                  </Text>
                  <Text style={[styles.body, { color: theme.text }]}>{message.body}</Text>
                </View>
              );
            })}
          </ScrollView>

          <Animated.View style={[styles.inputRow, { transform: [{ scale }] }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={inputLocked ? "Chat ist geschlossen" : "Nachricht..."}
              placeholderTextColor={theme.muted}
              style={[styles.input, { borderColor: theme.border, backgroundColor: theme.softSurface, color: theme.text }]}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={send}
              editable={!inputLocked}
            />
            <Pressable style={[styles.sendButton, { backgroundColor: theme.button }, (!draft.trim() || inputLocked) && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim() || inputLocked}>
              <Text style={[styles.sendText, { color: theme.inverse }]}>Senden</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
        <BottomNav active="chat" />
      </View>
    </SafeAreaView>
  );
}

function buildChannels(state: MccEventState | null, directChats: DirectChatWithNames[], userId: string | null): ChatChannel[] {
  const eventChannels = buildEventChannels(state);
  const directChannels: ChatChannel[] = directChats.map((chat) => ({
    id: `direct:${chat.id}`,
    kind: "direct",
    label: userId === chat.admin_id ? `Admin · ${chat.requesterName}` : `Admin · ${chat.adminName}`,
    directChat: chat,
  }));

  return [...eventChannels, ...directChannels];
}

function buildEventChannels(state: MccEventState | null): ChatChannel[] {
  if (!state) return [];

  const eventChannel: ChatChannel = { id: "event", kind: "event", sportId: null, label: "Event" };
  const activities = (state.eventActivities ?? []).length > 0
    ? state.eventActivities
    : state.decision.activities.map((activity) => ({
        id: activity.profileId,
        sport_id: activity.sportId,
        title: activity.profileName,
      }));

  if (activities.length < 2) {
    return [eventChannel];
  }

  const activityChannels = activities.map<ChatChannel>((activity, index) => {
    const sport = state.sports.find((entry) => entry.id === activity.sport_id);
    return {
      id: activity.id,
      kind: "event",
      sportId: activity.sport_id,
      label: activity.title || sport?.name || `Gruppe ${index + 1}`,
    };
  });

  return [eventChannel, ...activityChannels];
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { flex: 1, gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  title: { color: "#ffffff", fontSize: 32, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "800" },
  lockedPanel: {
    gap: 10,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
  },
  lockedTitle: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  lockedText: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
  channelRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  channelChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  channelText: { color: "#d9ecff", fontSize: 13, fontWeight: "900" },
  directInfo: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 12 },
  directInfoText: { flex: 1, minWidth: 0, gap: 2 },
  directTitle: { fontSize: 16, fontWeight: "900" },
  directMeta: { fontSize: 12, fontWeight: "800" },
  closeButton: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  closeButtonText: { fontSize: 12, fontWeight: "900" },
  messages: { flexGrow: 1, gap: 10, paddingVertical: 8 },
  empty: { color: "#9aa7b8", fontSize: 15, lineHeight: 22, textAlign: "center", paddingTop: 40 },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
  },
  meta: { color: "#728197", fontSize: 12, fontWeight: "900" },
  body: { color: "#ffffff", fontSize: 15, lineHeight: 21 },
  inputRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    outlineStyle: "none",
  } as object,
  sendButton: { justifyContent: "center", borderRadius: 18, paddingHorizontal: 14, minHeight: 50 },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: "#05070b", fontWeight: "900" },
});
