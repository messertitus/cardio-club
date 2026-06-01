import { Redirect } from "expo-router";
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
import { getMccEventState, listChatMessages, sendChatMessage, type ChatMessageWithAuthor, type MccEventState } from "../src/services";

type ChatChannel = {
  id: string;
  label: string;
  sportId: string | null;
};

export default function ChatScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  const isDecided = state?.event.status === "decided" || state?.event.status === "completed";
  const channels = useMemo(() => buildChannels(state), [state]);
  const activeChannel = channels.find((channel) => channel.id === activeChannelId) ?? channels[0] ?? null;

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const nextState = await getMccEventState(supabase, user.id);
    if (nextState.error) {
      setNotice(nextState.error.message);
      setBusy(false);
      return;
    }

    setState(nextState.data);
    const nextChannels = buildChannels(nextState.data);
    const nextActive = activeChannelId && nextChannels.some((channel) => channel.id === activeChannelId) ? activeChannelId : nextChannels[0]?.id ?? null;
    setActiveChannelId(nextActive);

    const isEventDecided = nextState.data.event.status === "decided" || nextState.data.event.status === "completed";
    if (!isEventDecided || !nextActive) {
      setMessages([]);
      setBusy(false);
      return;
    }

    const channel = nextChannels.find((candidate) => candidate.id === nextActive) ?? nextChannels[0];
    const result = await listChatMessages(supabase, {
      clubId: nextState.data.clubId,
      eventId: nextState.data.event.id,
      sportId: channel?.sportId ?? null,
    });
    setBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setNotice(null);
    setMessages(result.data);
  }, [activeChannelId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  async function switchChannel(channel: ChatChannel) {
    if (!state || !isDecided) return;
    setActiveChannelId(channel.id);
    setBusy(true);
    const result = await listChatMessages(supabase, {
      clubId: state.clubId,
      eventId: state.event.id,
      sportId: channel.sportId,
    });
    setBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setMessages(result.data);
  }

  async function send() {
    if (!draft.trim() || !user || !state || !isDecided || !activeChannel) return;
    const body = draft.trim();
    const optimisticMessage: ChatMessageWithAuthor = {
      id: `optimistic-${Date.now()}`,
      club_id: state.clubId,
      event_id: state.event.id,
      sport_id: activeChannel.sportId,
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

    const result = await sendChatMessage(supabase, {
      clubId: state.clubId,
      eventId: state.event.id,
      sportId: activeChannel.sportId,
      userId: user.id,
      body,
    });
    if (result.error) {
      setNotice(result.error.message);
      setDraft(body);
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      return;
    }
    void switchChannel(activeChannel);
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

          {!isDecided ? (
            <View style={[styles.lockedPanel, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.lockedTitle, { color: theme.text }]}>Noch geschlossen</Text>
              <Text style={[styles.lockedText, { color: theme.muted }]}>Der Event-Chat öffnet, sobald die Sportart entschieden wurde.</Text>
            </View>
          ) : (
            <>
              {channels.length > 1 ? (
                <View style={styles.channelRow}>
                  {channels.map((channel) => (
                    <Pressable
                      key={channel.id}
                      onPress={() => switchChannel(channel)}
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
                        mine && { borderColor: theme.accent, backgroundColor: theme.surface },
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
                  placeholder="Nachricht..."
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { borderColor: theme.border, backgroundColor: theme.softSurface, color: theme.text }]}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={send}
                />
                <Pressable style={[styles.sendButton, { backgroundColor: theme.button }, !draft.trim() && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim()}>
                  <Text style={[styles.sendText, { color: theme.inverse }]}>Senden</Text>
                </Pressable>
              </Animated.View>
            </>
          )}
        </KeyboardAvoidingView>
        <BottomNav active="chat" />
      </View>
    </SafeAreaView>
  );
}

function buildChannels(state: MccEventState | null): ChatChannel[] {
  if (!state?.event.selected_sport_id) return [];
  const selected = state.sports.find((sport) => sport.id === state.event.selected_sport_id);
  const channels: ChatChannel[] = [
    { id: state.event.selected_sport_id, sportId: state.event.selected_sport_id, label: selected?.name ?? "Event" },
  ];

  if (state.event.secondary_sport_id) {
    const secondary = state.sports.find((sport) => sport.id === state.event.secondary_sport_id);
    channels.push({
      id: state.event.secondary_sport_id,
      sportId: state.event.secondary_sport_id,
      label: secondary?.name ?? "Gruppe 2",
    });
  }

  return channels;
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
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 18,
  },
  lockedTitle: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  lockedText: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
  channelRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  channelChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  channelChipActive: { backgroundColor: "#ffffff" },
  channelText: { color: "#d9ecff", fontSize: 13, fontWeight: "900" },
  channelTextActive: { color: "#05070b" },
  messages: { flexGrow: 1, gap: 10, paddingVertical: 8 },
  empty: { color: "#9aa7b8", fontSize: 15, lineHeight: 22, textAlign: "center", paddingTop: 40 },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 12,
  },
  myBubble: { alignSelf: "flex-end", borderColor: "rgba(77,163,255,0.64)", backgroundColor: "rgba(77,163,255,0.18)" },
  meta: { color: "#728197", fontSize: 12, fontWeight: "900" },
  body: { color: "#ffffff", fontSize: 15, lineHeight: 21 },
  inputRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 16,
    paddingHorizontal: 14,
    outlineStyle: "none",
  } as object,
  sendButton: { justifyContent: "center", borderRadius: 18, backgroundColor: "#ffffff", paddingHorizontal: 14, minHeight: 50 },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: "#05070b", fontWeight: "900" },
});
