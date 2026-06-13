import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, KeyboardAvoidingView, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { MotionBackground, ScreenLoader } from "../src/components/MccDesign";
import { MainHeader } from "../src/components/PageHeader";
import { Reveal } from "../src/components/Motion";
import {
  directChatNotificationId,
  isNotificationUnread,
  loadReadNotifications,
  markNotificationRead,
  type ReadNotificationMap,
} from "../src/lib/adminNotifications";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { decisionReleasedNow, eventDayTitle, formatEventDayDate, getEventDate, getWeekStartDate } from "../src/services/date";
import { readLocalCache, writeLocalCache } from "../src/services/localCache";
import { supabase } from "../src/lib/supabase";
import {
  closeDirectChat,
  getEventStateById,
  getMccWeekEvents,
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
  reply_to_message_id?: string | null;
  reply_to?: {
    id: string;
    author_name: string;
    body: string;
  } | null;
};

type EventChatChannel = {
  id: string;
  kind: "event";
  label: string;
  sportId: string | null;
  eventId: string;
  clubId: string;
  activityId: string | null;
  dayLabel: string;
  dateLabel: string;
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
  const [eventStates, setEventStates] = useState<MccEventState[]>([]);
  const [members, setMembers] = useState<MccMember[]>([]);
  const [directChats, setDirectChats] = useState<DirectChatWithNames[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(directChatId ? `direct:${directChatId}` : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [messagesBusy, setMessagesBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [adminChatsOpen, setAdminChatsOpen] = useState(Boolean(directChatId));
  const [readMap, setReadMap] = useState<ReadNotificationMap>({});
  const [now, setNow] = useState(Date.now());
  const scale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView | null>(null);

  const openEventStates = useMemo(() => eventStates.filter((entry) => isEventChatOpen(entry, now)), [eventStates, now]);
  const hasReadyButClosed = useMemo(() => eventStates.some((entry) => eventDecisionReady(entry) && now > eventChatClosesAt(entry)), [eventStates, now]);
  const eventChannels = useMemo(() => buildEventChannels(openEventStates), [openEventStates]);
  const directChannels = useMemo(() => buildDirectChannels(directChats, user?.id ?? null), [directChats, user?.id]);
  const unreadDirectCount = useMemo(
    () => directChats.filter((chat) => chat.status === "open" && chat.admin_id === user?.id && isNotificationUnread(directChatNotificationId(chat), readMap)).length,
    [directChats, readMap, user?.id],
  );
  const channels = useMemo(() => [...eventChannels, ...directChannels], [directChannels, eventChannels]);
  const activeChannel = activeChannelId ? channels.find((channel) => channel.id === activeChannelId) ?? eventChannels[0] ?? null : eventChannels[0] ?? null;
  const activeDirectChat = activeChannel?.kind === "direct" ? activeChannel.directChat : null;
  const inputLocked = !activeChannel || activeDirectChat?.status === "closed";
  const activeEventState = activeChannel?.kind === "event" ? eventStates.find((entry) => entry.event.id === activeChannel.eventId) ?? null : null;
  const eventMembers = useMemo(() => buildEventMembers(activeChannel, activeEventState, members), [activeChannel, activeEventState, members]);
  // Group the open events so Saturday and Sunday appear under their own heading.
  const channelGroups = useMemo(
    () =>
      openEventStates.map((entry) => ({
        key: entry.event.id,
        title: `${eventDayTitle(entry.event.event_day)} · ${formatEventDayDate(entry.event.week_start_date, entry.event.event_day)}`,
        channels: eventChannels.filter((channel) => channel.eventId === entry.event.id),
      })),
    [eventChannels, openEventStates],
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadInitial() {
      if (!user) return;
      const cacheKey = `mcc.chat.${user.id}`;
      const cached = await readLocalCache<{ eventStates: MccEventState[]; members: MccMember[]; directChats: DirectChatWithNames[] }>(cacheKey, 15 * 60 * 1000);
      if (cached) {
        setEventStates(cached.eventStates);
        setMembers(cached.members);
        setDirectChats(cached.directChats);
        setBusy(false);
      } else {
        setBusy(true);
      }
      const [weekResult, directResult] = await Promise.all([getMccWeekEvents(supabase), listDirectChats(supabase)]);
      if (weekResult.error || directResult.error) {
        if (!cached) setNotice(weekResult.error?.message ?? directResult.error?.message ?? "Chat konnte nicht geladen werden.");
        setBusy(false);
        return;
      }

      const membersResult = await listMccMembers(supabase, { clubId: weekResult.data.clubId });
      if (membersResult.error) {
        if (!cached) setNotice(membersResult.error.message);
        setBusy(false);
        return;
      }

      // Load full state for this week's Cardiotage (Saturday + Sunday). Each gets
      // its own chat once the decision is released; cancelled events are already
      // excluded by getMccWeekEvents.
      const currentWeek = getWeekStartDate();
      const weekRows = weekResult.data.events.filter((row) => row.week_start_date === currentWeek);
      const stateResults = await Promise.all(weekRows.map((row) => getEventStateById(supabase, user.id, row.id)));
      const loadedStates = stateResults.flatMap((result) => (result.data ? [result.data] : []));
      // Local chats: the user's own city plus any event they joined elsewhere.
      const myCity = membersResult.data.find((member) => member.userId === user.id)?.city ?? null;
      const nextEventStates = loadedStates.filter((entry) => !myCity || entry.event.city === myCity || entry.myAttendance != null);

      void writeLocalCache(cacheKey, { eventStates: nextEventStates, members: membersResult.data, directChats: directResult.data });

      const nextEventChannels = buildEventChannels(nextEventStates.filter((entry) => isEventChatOpen(entry, Date.now())));
      const nextDirectChannels = buildDirectChannels(directResult.data, user.id);
      const nextChannels = [...nextEventChannels, ...nextDirectChannels];
      const requestedChannelId = directChatId ? `direct:${directChatId}` : null;
      const nextActive =
        (requestedChannelId && nextChannels.some((channel) => channel.id === requestedChannelId) ? requestedChannelId : null) ??
        nextEventChannels[0]?.id ??
        null;
      const nextActiveChannel = nextChannels.find((channel) => channel.id === nextActive) ?? null;

      setEventStates(nextEventStates);
      setMembers(membersResult.data);
      setDirectChats(directResult.data);
      setActiveChannelId(nextActive);
      setNotice(null);
      setBusy(false);

      let map = await loadReadNotifications(user.id);
      const openedDirect = nextActiveChannel?.kind === "direct" ? nextActiveChannel.directChat : null;
      if (openedDirect) map = await markNotificationRead(user.id, directChatNotificationId(openedDirect));
      setReadMap(map);

      await loadMessagesForChannel(nextActiveChannel);
    }

    void loadInitial();
  }, [directChatId, user]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  useEffect(() => {
    if (activeChannel?.kind === "event") {
      void loadMessagesForChannel(activeChannel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id]);

  async function loadMessagesForChannel(channel: ChatChannel | null) {
    if (!channel) {
      setMessages([]);
      return;
    }

    setMessagesBusy(true);
    if (channel.kind === "event") {
      const result = await listChatMessages(supabase, {
        clubId: channel.clubId,
        eventId: channel.eventId,
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
    setReplyTo(null);
    if (channel.kind === "direct" && user) {
      setReadMap(await markNotificationRead(user.id, directChatNotificationId(channel.directChat)));
    }
    await loadMessagesForChannel(channel);
  }

  async function send() {
    if (!draft.trim() || !user || !activeChannel || inputLocked) return;
    const body = draft.trim();
    const pendingReply = replyTo;
    const optimisticMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      user_id: user.id,
      body,
      created_at: new Date().toISOString(),
      author_name: "Du",
      reply_to_message_id: pendingReply?.id ?? null,
      reply_to: pendingReply ? { id: pendingReply.id, author_name: pendingReply.user_id === user.id ? "Du" : pendingReply.author_name, body: pendingReply.body } : null,
    };
    setDraft("");
    setReplyTo(null);
    setMessages((current) => [...current, optimisticMessage]);
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const result =
      activeChannel.kind === "event"
        ? await sendChatMessage(supabase, {
            clubId: activeChannel.clubId,
            eventId: activeChannel.eventId,
            sportId: activeChannel.sportId,
            userId: user.id,
            body,
            replyToMessageId: optimisticMessage.reply_to_message_id,
          })
        : await sendDirectChatMessage(supabase, {
            chatId: activeChannel.directChat.id,
            userId: user.id,
            body,
            replyToMessageId: optimisticMessage.reply_to_message_id,
          });

    if (result.error) {
      setNotice(result.error.message);
      setDraft(body);
      setReplyTo(pendingReply);
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

  if (loading) return <ScreenLoader />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.content}>
          <MainHeader
            title="Chat"
            actions={
              directChannels.length > 0 ? (
                <ContactMenuButton count={unreadDirectCount} open={adminChatsOpen} onPress={() => setAdminChatsOpen((open) => !open)} />
              ) : null
            }
          />
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {busy ? <ScreenLoader /> : null}

          {adminChatsOpen && directChannels.length > 0 ? (
            <View style={[styles.contactPanel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.channelSectionTitle, { color: theme.mcc.textSecondary }]}>Kontakt aufnehmen</Text>
              {directChannels.map((channel) => (
                <Pressable
                  key={channel.id}
                  style={[styles.contactPanelRow, { borderTopColor: theme.mcc.line }]}
                  onPress={() => {
                    setAdminChatsOpen(false);
                    void switchChannel(channel);
                  }}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: activeChannel?.id === channel.id ? theme.mcc.accentDeep : theme.mcc.surface }]}>
                    <MaterialCommunityIcons name="account-question" size={18} color={activeChannel?.id === channel.id ? "#FFFFFF" : theme.mcc.textPrimary} />
                  </View>
                  <View style={styles.directInfoText}>
                    <Text style={[styles.memberName, { color: theme.mcc.textPrimary }]}>{channel.personName}</Text>
                    <Text style={[styles.membersMeta, { color: theme.mcc.textSecondary }]}>{channel.roleLabel}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {eventChannels.length > 0 ? (
            <Reveal index={0} style={styles.channelBlock}>
              {channelGroups.map((group) => (
                <View key={group.key} style={styles.channelGroup}>
                  <Text style={[styles.channelSectionTitle, { color: theme.mcc.textSecondary }]}>{group.title}</Text>
                  <View style={styles.channelRow}>
                    {group.channels.map((channel) => (
                      <ChannelChip key={channel.id} channel={channel} active={activeChannel?.id === channel.id} onPress={() => void switchChannel(channel)} />
                    ))}
                  </View>
                </View>
              ))}
            </Reveal>
          ) : null}

          {activeChannel?.kind === "event" ? (
            <Reveal index={1} style={[styles.membersPanel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Pressable style={styles.membersHeader} onPress={() => setMembersOpen((open) => !open)}>
                <View>
                  <Text style={[styles.membersTitle, { color: theme.mcc.textPrimary }]}>Mitspieler</Text>
                  <Text style={[styles.membersMeta, { color: theme.mcc.textSecondary }]}>
                    {eventMembers.length} · {activeChannel.dayLabel}
                    {activeChannel.sportId ? ` · ${activeChannel.label}` : ""}
                  </Text>
                </View>
                <Text style={[styles.itemArrow, { color: theme.mcc.textSecondary }]}>{membersOpen ? "×" : "+"}</Text>
              </Pressable>
              {membersOpen ? (
                <View style={styles.membersList}>
                  {eventMembers.length === 0 ? <Text style={[styles.emptySmall, { color: theme.mcc.textSecondary }]}>Noch keine Zusagen.</Text> : null}
                  {eventMembers.map((member) => (
                    <View key={member.userId} style={[styles.memberRow, { borderTopColor: theme.mcc.line }]}>
                      <Text style={[styles.memberName, { color: theme.mcc.textPrimary }]}>{member.displayName}</Text>
                      {member.meta ? <Text style={[styles.memberMeta, { color: theme.mcc.accent }]}>{member.meta}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </Reveal>
          ) : null}

          {eventChannels.length === 0 && !activeDirectChat ? (
            <View style={[styles.lockedPanel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.lockedTitle, { color: theme.mcc.textPrimary }]}>{hasReadyButClosed ? "Event-Chat geschlossen" : "Noch kein Chat offen"}</Text>
              <Text style={[styles.lockedText, { color: theme.mcc.textSecondary }]}>
                {hasReadyButClosed
                  ? "Dieser Event-Chat wurde einen Tag nach dem Cardiotag geschlossen. Frühere Nachrichten findest du im Verlauf."
                  : "Der Event- und Gruppen-Chat öffnet automatisch, sobald die Entscheidung für einen Cardiotag steht. Bis dahin gibt es hier noch keinen Chat."}
              </Text>
            </View>
          ) : null}

          {activeDirectChat ? (
            <View style={[styles.directInfo, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <View style={styles.directInfoText}>
                <Text style={[styles.directTitle, { color: theme.mcc.textPrimary }]}>{activeChannel?.label}</Text>
                <Text style={[styles.directMeta, { color: theme.mcc.textSecondary }]}>
                  {activeDirectChat.status === "closed" ? "geschlossen" : "offen"} · Kontakt: {activeDirectChat.adminName}
                </Text>
              </View>
              {activeDirectChat.admin_id === user.id && activeDirectChat.status === "open" ? (
                <Pressable style={[styles.closeButton, { backgroundColor: theme.mcc.surface }]} onPress={() => void closeActiveDirectChat()}>
                  <Text style={[styles.closeButtonText, { color: theme.mcc.textPrimary }]}>Schließen</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <ScrollView ref={scrollRef} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {messagesBusy && messages.length === 0 ? <ScreenLoader /> : null}
            {messages.length === 0 && !messagesBusy && activeChannel ? <Text style={[styles.empty, { color: theme.mcc.textSecondary }]}>Noch keine Nachrichten.</Text> : null}
            {messages.map((message) => {
              const mine = message.user_id === user.id;
              return (
                <Reveal key={message.id} index={0}>
                <SwipeReplyBubble mine={mine} onReply={() => setReplyTo(message)}>
                  <View
                    style={[
                      styles.bubble,
                      { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft },
                      mine && { borderColor: theme.mcc.accent, backgroundColor: theme.mcc.surface, alignSelf: "flex-end" },
                    ]}
                  >
                    {message.reply_to ? <ReplyPreview reply={message.reply_to} /> : null}
                    <Text style={[styles.meta, { color: theme.mcc.textSecondary }]}>
                      {mine ? "Du" : message.author_name} · {formatTime(message.created_at)}
                    </Text>
                    <Text style={[styles.body, { color: theme.mcc.textPrimary }]}>{message.body}</Text>
                  </View>
                </SwipeReplyBubble>
                </Reveal>
              );
            })}
          </ScrollView>

          {replyTo ? (
            <View style={[styles.replyComposer, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <View style={styles.replyComposerText}>
                <Text style={[styles.replyTitle, { color: theme.mcc.accent }]}>{replyTo.user_id === user.id ? "Du" : replyTo.author_name}</Text>
                <Text style={[styles.replyBody, { color: theme.mcc.textSecondary }]} numberOfLines={1}>
                  {replyTo.body}
                </Text>
              </View>
              <Pressable style={styles.replyClose} onPress={() => setReplyTo(null)}>
                <MaterialCommunityIcons name="close" size={18} color={theme.mcc.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <Animated.View style={[styles.inputRow, { transform: [{ scale }] }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={inputLocked ? "Chat ist geschlossen" : "Nachricht..."}
              placeholderTextColor={theme.mcc.textSecondary}
              style={[styles.input, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={send}
              editable={!inputLocked}
            />
            <Pressable style={[styles.sendButton, { backgroundColor: theme.mcc.accentDeep }, (!draft.trim() || inputLocked) && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim() || inputLocked}>
              <Text style={[styles.sendText, { color: "#FFFFFF" }]}>Senden</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
        <BottomNav active="chat" />
      </View>
    </SafeAreaView>
  );
}

function SwipeReplyBubble({ children, mine, onReply }: { children: ReactNode; mine: boolean; onReply: () => void }) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(Math.min(72, Math.max(0, gesture.dx)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 48) onReply();
          Animated.spring(translateX, { toValue: 0, damping: 16, stiffness: 220, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, damping: 16, stiffness: 220, useNativeDriver: true }).start();
        },
      }),
    [onReply, translateX],
  );

  // The reply icon stays hidden at rest and fades + scales in on the left as the
  // bubble is pushed right, so it never sits on top of the message.
  const iconOpacity = translateX.interpolate({ inputRange: [0, 22, 52], outputRange: [0, 0, 1], extrapolate: "clamp" });
  const iconScale = translateX.interpolate({ inputRange: [0, 52], outputRange: [0.6, 1], extrapolate: "clamp" });

  return (
    <View style={[styles.swipeWrap, mine && styles.swipeWrapMine]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.replySwipeIcon, { backgroundColor: theme.mcc.accentFaint, opacity: iconOpacity, transform: [{ scale: iconScale }] }]}
      >
        <MaterialCommunityIcons name="reply" size={18} color={theme.mcc.accent} />
      </Animated.View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

function ReplyPreview({ reply }: { reply: NonNullable<ChatMessage["reply_to"]> }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.replyPreview, { borderLeftColor: theme.mcc.accent, backgroundColor: theme.mcc.accentFaint }]}>
      <Text style={[styles.replyTitle, { color: theme.mcc.accent }]} numberOfLines={1}>
        {reply.author_name}
      </Text>
      <Text style={[styles.replyBody, { color: theme.mcc.textSecondary }]} numberOfLines={2}>
        {reply.body}
      </Text>
    </View>
  );
}

function ChannelChip({ channel, active, onPress }: { channel: ChatChannel; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.channelChip,
        { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft },
        active && { backgroundColor: theme.mcc.accentDeep },
      ]}
    >
      <Text style={[styles.channelText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]} numberOfLines={1}>{channel.label}</Text>
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
    <Pressable style={[styles.contactButton, { borderColor: theme.mcc.line, backgroundColor: open ? theme.mcc.accentDeep : theme.mcc.surfaceSoft }]} onPress={onPress}>
      <MaterialCommunityIcons name={open ? "close" : "account-question"} size={19} color={open ? "#FFFFFF" : theme.mcc.textPrimary} />
      {count > 0 ? (
        <View style={[styles.contactBadge, { backgroundColor: theme.mcc.accent }]}>
          <Text style={[styles.contactBadgeText, { color: "#FFFFFF" }]}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function buildEventChannels(states: MccEventState[]): EventChatChannel[] {
  const channels: EventChatChannel[] = [];

  for (const state of states) {
    const dayLabel = eventDayTitle(state.event.event_day);
    const dateLabel = formatEventDayDate(state.event.week_start_date, state.event.event_day);
    const base = { eventId: state.event.id, clubId: state.clubId, dayLabel, dateLabel } as const;

    // Main event channel, labelled by the day so Saturday and Sunday are clearly
    // distinguishable for members who join on both days.
    channels.push({ id: `event:${state.event.id}`, kind: "event", sportId: null, activityId: null, label: dayLabel, ...base });

    const activities = (state.eventActivities ?? []).length > 0
      ? state.eventActivities
      : state.decision.activities.map((activity) => ({ id: activity.profileId, sport_id: activity.sportId, title: activity.profileName }));

    if (activities.length < 2) continue;

    for (const [index, activity] of activities.entries()) {
      const sport = state.sports.find((entry) => entry.id === activity.sport_id);
      // Sub-channels show only the sport, not "Sport · Standort".
      channels.push({
        id: `event:${state.event.id}:${activity.id}`,
        kind: "event",
        sportId: activity.sport_id,
        activityId: activity.id,
        label: sport?.name ?? `Gruppe ${index + 1}`,
        ...base,
      });
    }
  }

  return channels;
}

const CHAT_CLOSE_AFTER_EVENT_MS = 2 * 24 * 60 * 60 * 1000; // through the day after the event

function eventDecisionReady(state: MccEventState): boolean {
  // Skipped (too few voters) events never get an event chat.
  if (state.event.status === "cancelled") return false;
  // A completed (already played + reviewed) event keeps its chat for the close-out window.
  if (state.event.status === "completed") return true;
  // An event with fewer than two distinct voters is treated as skipped (mirrors
  // cancel_underused_events) — no chat, even before the server cancel job runs.
  const voterCount = new Set(state.votes.map((vote) => vote.user_id)).size;
  if (voterCount < 2) return false;
  return state.event.status === "decided" || decisionReleasedNow(state.event.starts_at, state.event.week_start_date, state.event.event_day);
}

function eventChatClosesAt(state: MccEventState): number {
  return getEventDate(state.event.week_start_date, state.event.event_day).getTime() + CHAT_CLOSE_AFTER_EVENT_MS;
}

// The event chat opens once the decision is ready and closes one day after the
// event. Returns the phase so the UI can explain why it is locked.
function eventChatPhase(state: MccEventState | null, now = Date.now()): "before" | "open" | "closed" {
  if (!state) return "before";
  if (!eventDecisionReady(state)) return "before";
  return now > eventChatClosesAt(state) ? "closed" : "open";
}

function isEventChatOpen(state: MccEventState | null, now = Date.now()): boolean {
  return eventChatPhase(state, now) === "open";
}

function buildEventMembers(
  channel: ChatChannel | null,
  state: MccEventState | null,
  members: MccMember[],
): Array<MccMember & { meta?: string }> {
  if (!state || channel?.kind !== "event") return [];

  const activity = state.eventActivities.find((entry) => entry.id === channel.activityId || (channel.sportId && entry.sport_id === channel.sportId));
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
  channelBlock: { gap: 12 },
  channelGroup: { gap: 8 },
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
  swipeWrap: { alignSelf: "flex-start", justifyContent: "center", maxWidth: "100%", position: "relative" },
  swipeWrapMine: { alignSelf: "flex-end" },
  replySwipeIcon: { alignItems: "center", borderRadius: 999, height: 34, justifyContent: "center", left: 4, position: "absolute", width: 34 },
  replyPreview: { borderLeftWidth: 3, borderRadius: 12, gap: 2, marginBottom: 3, paddingHorizontal: 9, paddingVertical: 7 },
  replyComposer: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  replyComposerText: { flex: 1, minWidth: 0 },
  replyTitle: { fontSize: 12, fontWeight: "900" },
  replyBody: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  replyClose: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
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
