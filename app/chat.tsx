import { Redirect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import { bootstrapMccWeek, listChatMessages, sendChatMessage, type ChatMessageWithAuthor } from "../src/services";

export default function ChatScreen() {
  const { loading, user } = useAuth();
  const [clubId, setClubId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const bootstrap = await bootstrapMccWeek(supabase);
    if (bootstrap.error) {
      setNotice(bootstrap.error.message);
      setBusy(false);
      return;
    }

    setClubId(bootstrap.data.clubId);
    setEventId(bootstrap.data.eventId);
    const result = await listChatMessages(supabase, bootstrap.data.clubId);
    setBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setMessages(result.data);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!draft.trim() || !user || !clubId) return;
    const body = draft.trim();
    const optimisticMessage: ChatMessageWithAuthor = {
      id: `optimistic-${Date.now()}`,
      club_id: clubId,
      event_id: eventId,
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

    const result = await sendChatMessage(supabase, { clubId, eventId, userId: user.id, body });
    if (result.error) {
      setNotice(result.error.message);
      setDraft(body);
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      return;
    }
    void load();
  }

  if (loading) {
    return <LoadingState />;
  }

  if (!user) {
    return <Redirect href="/auth" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandBackground />
      <View style={styles.shell}>
        <View style={styles.content}>
          <Text style={styles.title}>Chat</Text>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <ScrollView contentContainerStyle={styles.messages}>
            {busy && messages.length === 0 ? <LoadingState /> : null}
            {messages.length === 0 && !busy ? <Text style={styles.empty}>Noch keine Nachrichten.</Text> : null}
            {messages.map((message) => {
              const mine = message.user_id === user.id;
              return (
                <View key={message.id} style={[styles.bubble, mine && styles.myBubble]}>
                  <Text style={styles.meta}>
                    {mine ? "Du" : message.author_name} · {formatTime(message.created_at)}
                  </Text>
                  <Text style={[styles.body, mine && styles.myBody]}>{message.body}</Text>
                </View>
              );
            })}
          </ScrollView>
          <Animated.View style={[styles.inputRow, { transform: [{ scale }] }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Nachricht..."
              placeholderTextColor="#728197"
              style={styles.input}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={send}
            />
            <Pressable style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim()}>
              <Text style={styles.sendText}>Senden</Text>
            </Pressable>
          </Animated.View>
        </View>
        <BottomNav active="chat" />
      </View>
    </SafeAreaView>
  );
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { flex: 1, gap: 12, padding: 18 },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "800" },
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
  myBody: { color: "#ffffff" },
  inputRow: { flexDirection: "row", gap: 8 },
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
  sendButton: { justifyContent: "center", borderRadius: 18, backgroundColor: "#ffffff", paddingHorizontal: 14 },
  sendButtonDisabled: { opacity: 0.4 },
  sendText: { color: "#05070b", fontWeight: "900" },
});
