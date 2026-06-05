import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { PageHeader } from "../src/components/PageHeader";
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
  listMccMembers,
  sendChatMessage,
  sendDirectChatMessage,
  type DirectChatWithNames,
  type MccEventState,
  type MccMember,
} from "../src/services";

type ChatMessage = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

type EventChatChannel = {
  id: string;
  kind: "event";
  label: string;
  sportId: string | null;
};

type DirectChatChannel = {
  id: string;
  kind: "direct";
  label: string;
  personName: string;
  roleLabel: string;
  directChat: DirectChatWithNames;
};

type ChatChannel = EventChatChannel | DirectChatChannel;

export default function ChatScreen() {
  const { directChatId } = useLocalSearchParams<{ directChatId?: string }>();
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [members, setMembers] = useState<MccMember[]>([]);
  const [directChats, setDirectChats] = useState<DirectChatWithNames[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(directChatId ? `direct:${directChatId}` : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messagesBusy, setMessagesBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [adminChatsOpen, setAdminChatsOpen] = useState(Boolean(directChatId));
  const [now, setNow] = useState(Date.now());
  const scale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  const eventChatOpen = isEventChatOpen(state, now);
  const eventChannels = useMemo(() => (eventChatOpen ? buildEventChannels(state) : []), [eventChatOpen, state]);
  const directChannels = useMemo(() => buildDirectChannels(directChats, user?.id ?? null), [directChats, user?.id]);
  const channels = useMemo(() => [...eventChannels, ...directChannels], [directChannels, eventChannels]);
  const activeChannel = activeChannelId ? channels.find((channel) => channel.id === activeChannelId) ?? eventChannels[0] ?? null : eventChannels[0] ?? null;
  const activeDirectChat = activeChannel?.kind === "direct" ? activeChannel.directChat : null;
  const inputLocked = !activeChannel || (activeChannel.kind === "event" && !eventChatOpen) || activeDirectChat?.status === "closed";
  const eventMembers = useMemo(() => buildEventMembers(activeChannel, state, members), [activeChannel, members, state]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadInitial() {
      if (!user) return;
      setBusy(true);
      const [nextState, directResult] = await Promise.all([getMccEventState(supabase, user.id), listDirectChats(supabase)]);
      if (nextState.error || directResult.error) {
        setNotice(nextState.error?.message ?? directResult.error?.message ?? "Chat konnte nicht geladen werden.");
        setBusy(false);
        return;
      }

      const membersResult = await listMccMembers(supabase, { clubId: nextState.data.clubId });
      if (membersResult.error) {
        setNotice(membersResult.error.message);
        setBusy(false);
        return;
      }

      const nextEventChatOpen = isEventChatOpen(nextState.data, Date.now());
      const nextEventChannels = nextEventChatOpen ? buildEventChannels(nextState.data) : [];
      const nextDirectChannels = buildDirectChannels(directResult.data, user.id);
      const nextChannels = [...nextEventChannels, ...nextDirectChannels];
      const requestedChannelId = directChatId ? `direct:${directChatId}` : null;
      const nextActive =
        (requestedChannelId && nextChannels.some((channel) => channel.id === requestedChannelId) ? requestedChannelId : null) ??
        nextEventChannels[0]?.id ??
        null;
      const nextActiveChannel = nextChannels.find((channel) => channel.id === nextActive) ?? null;

      setState(nextState.data);
      setMembers(membersResult.data);
      setDirectChats(directResult.data);
      setActiveChannelId(nextActive);
      setNotice(null);
      setBusy(false);
      await loadMessagesForChannel(nextActiveChannel, nextState.data);
    }

    void loadInitial();
  }, [directChatId, user]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  useEffect(() => {
    if (eventChatOpen && activeChannel?.kind === "event") {
      void loadMessagesForChannel(activeChannel);
    }
  }, [activeChannel?.id, eventChatOpen]);

  async function loadMessagesForChannel(channel: ChatChannel | null, nextState: MccEventState | null = state) {
    if (!channel) {
      setMessages([]);
      return;
    }

    setMessagesBusy(true);
    if (channel.kind === "event") {
      if (!nextState || !isEventChatOpen(nextState, Date.now())) {
        setMessages([]);
        setMessagesBusy(false);
        return;
      }

      const result = await listChatMessages(supabase, {
        clubId: nextState.clubId,
        eventId: nextState.event.id,
        sportId: channel.sportId,
      });
      setMessagesBusy(false);
      if (result.error) {
        setNotice(result.error.message);
        return;
      }
      setMessages(result.data);
      return;
    }

    const result = await listDirectChatMessages(supabase, channel.directChat.id);
    setMessagesBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    setMessages(result.data);
  }

  async function switchChannel(channel: ChatChannel) {
    setActiveChannelId(channel.id);
    setMembersOpen(false);
    await loadMessagesForChannel(channel);
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
    await loadMessagesForChannel(activeChannel);
  }

  async function closeActiveDirectChat() {
    if (!user || !activeDirectChat || activeDirectChat.admin_id !== user.id || activeDirectChat.status === "closed") return;
    const result = await closeDirectChat(supabase, { chatId: activeDirectChat.id, adminId: user.id });
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    const refreshed = await listDirectChats(supabase);
    if (refreshed.data) setDirectChats(refreshed.data);
    await loadMessagesForChannel(activeChannel);
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.content}>
          <PageHeader
            title="Chat"
            showBack={false}
            showTheme
            actions={
              directChannels.length > 0 ? (
                <ContactMenuButton count={directChannels.length} open={adminChatsOpen} onPress={() => setAdminChatsOpen((open) => !open)} />
              ) : null
            }
          />
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {busy ? <LoadingState /> : null}

          {adminChatsOpen && directChannels.length > 0 ? (
            <View style={[styles.contactPanel, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.channelSectionTitle, { color: theme.muted }]}>Kontakt aufnehmen</Text>
              {directChannels.map((channel) => (
                <Pressable
                  key={channel.id}
                  style={[styles.contactPanelRow, { borderTopColor: theme.border }]}
                  onPress={() => {
                    setAdminChatsOpen(false);
                    void switchChannel(channel);
                  }}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: activeChannel?.id === channel.id ? theme.button : theme.surface }]}>
                    <MaterialCommunityIcons name="account-question" size={18} color={activeChannel?.id === channel.id ? theme.inverse : theme.text} />
                  </View>
                  <View style={styles.directInfoText}>
                    <Text style={[styles.memberName, { color: theme.text }]}>{channel.personName}</Text>
                    <Text style={[styles.membersMeta, { color: theme.muted }]}>{channel.roleLabel}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {eventChatOpen && eventChannels.length > 0 ? (
            <View style={styles.channelBlock}>
              <Text style={[styles.channelSectionTitle, { color: theme.muted }]}>Event & Gruppen</Text>
              <View style={styles.channelRow}>
                {eventChannels.map((channel) => (
                  <ChannelChip key={channel.id} channel={channel} active={activeChannel?.id === channel.id} onPress={() => void switchChannel(channel)} />
                ))}
              </View>
            </View>
          ) : null}

          {activeChannel?.kind === "event" && eventChatOpen ? (
            <View style={[styles.membersPanel, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Pressable style={styles.membersHeader} onPress={() => setMembersOpen((open) => !open)}>
                <View>
                  <Text style={[styles.membersTitle, { color: theme.text }]}>Mitspieler</Text>
                  <Text style={[styles.membersMeta, { color: theme.muted }]}>{eventMembers.length} im aktuellen Chat</Text>
                </View>
                <Text style={[styles.itemArrow, { color: theme.muted }]}>{membersOpen ? "×" : "+"}</Text>
              </Pressable>
              {membersOpen ? (
                <View style={styles.membersList}>
                  {eventMembers.length === 0 ? <Text style={[styles.emptySmall, { color: theme.muted }]}>Noch keine Zusagen.</Text> : null}
                  {eventMembers.map((member) => (
                    <View key={member.userId} style={[styles.memberRow, { borderTopColor: theme.border }]}>
                      <Text style={[styles.memberName, { color: theme.text }]}>{member.displayName}</Text>
                      {member.meta ? <Text style={[styles.memberMeta, { color: theme.accent }]}>{member.meta}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {state && !eventChatOpen ? (
            <View style={[styles.lockedPanel, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.lockedTitle, { color: theme.text }]}>Noch geschlossen</Text>
              <Text style={[styles.lockedText, { color: theme.muted }]}>Event- und Gruppen-Chats öffnen erst, wenn das Event startet.</Text>
            </View>
          ) : null}

          {activeDirectChat ? (
            <View style={[styles.directInfo, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <View style={styles.directInfoText}>
                <Text style={[styles.directTitle, { color: theme.text }]}>{activeChannel?.label}</Text>
                <Text style={[styles.directMeta, { color: theme.muted }]}>
                  {activeDirectChat.status === "closed" ? "geschlossen" : "offen"} · Kontakt: {activeDirectChat.adminName}
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
            {messagesBusy && messages.length === 0 ? <LoadingState /> : null}
            {messages.length === 0 && !messagesBusy ? <Text style={[styles.empty, { color: theme.muted }]}>Noch keine Nachrichten.</Text> : null}
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

function ChannelChip({ channel, active, onPress }: { channel: ChatChannel; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.channelChip,
        { borderColor: theme.border, backgroundColor: theme.softSurface },
        active && { backgroundColor: theme.button },
      ]}
    >
      <Text style={[styles.channelText, { color: active ? theme.inverse : theme.text }]} numberOfLines={1}>{channel.label}</Text>
    </Pressable>
  );
}

function buildDirectChannels(directChats: DirectChatWithNames[], userId: string | null): DirectChatChannel[] {
  return directChats.map((chat) => {
    const userIsAdmin = userId === chat.admin_id;
    const personName = userIsAdmin ? chat.requesterName : chat.adminName;
    return {
      id: `direct:${chat.id}`,
      kind: "direct",
      label: personName,
      personName,
      roleLabel: userIsAdmin ? "Anfrage" : "Admin",
      directChat: chat,
    };
  });
}

function ContactMenuButton({ count, open, onPress }: { count: number; open: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={[styles.contactButton, { borderColor: theme.border, backgroundColor: open ? theme.button : theme.softSurface }]} onPress={onPress}>
      <MaterialCommunityIcons name={open ? "close" : "account-question"} size={19} color={open ? theme.inverse : theme.text} />
      {count > 0 ? (
        <View style={[styles.contactBadge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.contactBadgeText, { color: theme.inverse }]}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function buildEventChannels(state: MccEventState | null): EventChatChannel[] {
  if (!state) return [];

  const eventChannel: EventChatChannel = { id: "event", kind: "event", sportId: null, label: "Event" };
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

  const activityChannels = activities.map<EventChatChannel>((activity, index) => {
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

function isEventChatOpen(state: MccEventState | null, now = Date.now()): boolean {
  if (!state) return false;
  if (state.event.status === "completed") return true;
  if (state.event.status !== "decided") return false;
  if (!state.event.starts_at) return false;
  return new Date(state.event.starts_at).getTime() <= now;
}

function buildEventMembers(
  channel: ChatChannel | null,
  state: MccEventState | null,
  members: MccMember[],
): Array<MccMember & { meta?: string }> {
  if (!state || channel?.kind !== "event") return [];

  const activity = state.eventActivities.find((entry) => entry.id === channel.id || (channel.sportId && entry.sport_id === channel.sportId));
  const memberIds =
    activity?.assigned_user_ids && activity.assigned_user_ids.length > 0
      ? new Set(activity.assigned_user_ids)
      : new Set(state.attendance.filter((entry) => entry.status === "going" || entry.status === "maybe").map((entry) => entry.user_id));
  const attendanceByUserId = new Map(state.attendance.map((entry) => [entry.user_id, entry.status]));

  return members
    .filter((member) => memberIds.has(member.userId))
    .map((member) => ({
      ...member,
      meta: [
        activity?.activity_contact_id === member.userId ? "AP" : null,
        attendanceByUserId.get(member.userId) === "maybe" ? "vielleicht" : null,
      ].filter(Boolean).join(" · "),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
  channelBlock: { gap: 8 },
  channelSectionTitle: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  channelRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  channelChip: {
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  channelText: { color: "#d9ecff", fontSize: 13, fontWeight: "900" },
  membersPanel: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 12 },
  membersHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  membersTitle: { fontSize: 15, fontWeight: "900" },
  membersMeta: { fontSize: 12, fontWeight: "800" },
  membersList: { gap: 6 },
  memberRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingTop: 8 },
  memberName: { flex: 1, fontSize: 13, fontWeight: "900" },
  memberMeta: { fontSize: 12, fontWeight: "900" },
  itemArrow: { fontSize: 20, fontWeight: "900" },
  lockedPanel: {
    gap: 10,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
  },
  lockedTitle: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  lockedText: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
  directInfo: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 12 },
  directInfoText: { flex: 1, minWidth: 0, gap: 2 },
  directTitle: { fontSize: 16, fontWeight: "900" },
  directMeta: { fontSize: 12, fontWeight: "800" },
  closeButton: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  closeButtonText: { fontSize: 12, fontWeight: "900" },
  messages: { flexGrow: 1, gap: 10, paddingVertical: 8 },
  empty: { color: "#9aa7b8", fontSize: 15, lineHeight: 22, textAlign: "center", paddingTop: 40 },
  emptySmall: { fontSize: 13, fontWeight: "800" },
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
  contactButton: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 40, justifyContent: "center", position: "relative", width: 40 },
  contactBadge: { alignItems: "center", borderRadius: 999, minWidth: 17, paddingHorizontal: 4, position: "absolute", right: -4, top: -5 },
  contactBadgeText: { fontSize: 10, fontWeight: "900", lineHeight: 15 },
  contactPanel: { alignSelf: "flex-end", borderRadius: 18, borderWidth: 1, gap: 8, maxWidth: 360, padding: 12, width: "100%" },
  contactPanelRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 8 },
  contactAvatar: { alignItems: "center", borderRadius: 999, height: 34, justifyContent: "center", width: 34 },
});
