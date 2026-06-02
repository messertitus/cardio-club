import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { MotionPressable, Reveal } from "../src/components/Motion";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { isCurrentUserAdmin, listProfileNameChangeRequests, listSportIdeas } from "../src/services";

const darkLogo = require("../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../assets/mcc-logo-color-symbol.png");
const READ_NOTIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AdminNotification = {
  id: string;
  title: string;
  body: string;
  href: "/ideas" | "/admin?section=nameRequests";
};

export default function MenuScreen() {
  const { user } = useAuth();
  const { mode, theme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readNotifications, setReadNotifications] = useState<Record<string, number>>({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const visibleNotifications = notifications.filter((notification) => isNotificationVisible(notification.id, readNotifications));
  const unreadNotifications = visibleNotifications.filter((notification) => !readNotifications[notification.id]);

  useEffect(() => {
    if (!user) return;
    async function loadAdminState() {
      if (!user) return;
      const readMap = await loadReadNotifications(user.id);
      setReadNotifications(readMap);
      const adminResult = await isCurrentUserAdmin(supabase, user.id);
      const nextIsAdmin = adminResult.data ?? false;
      setIsAdmin(nextIsAdmin);
      if (!nextIsAdmin) {
        setNotifications([]);
        return;
      }

      const [ideasResult, namesResult] = await Promise.all([listSportIdeas(supabase), listProfileNameChangeRequests(supabase)]);
      const pendingIdeas: AdminNotification[] =
        ideasResult.data
          ?.filter((idea) => idea.status === "pending")
          .map((idea) => ({
            id: `sport-idea:${idea.id}`,
            title: "Sportidee",
            body: idea.name,
            href: "/ideas",
          })) ?? [];
      const pendingNames: AdminNotification[] =
        namesResult.data?.map((request) => ({
          id: `name-request:${request.id}`,
          title: "Namensänderung",
          body: request.requested_display_name,
          href: "/admin?section=nameRequests",
        })) ?? [];

      setNotifications([...pendingIdeas, ...pendingNames]);
    }

    void loadAdminState();
  }, [user]);

  async function openNotification(notification: AdminNotification) {
    if (!user) return;
    const nextRead = { ...readNotifications, [notification.id]: Date.now() };
    setReadNotifications(nextRead);
    setNotificationsOpen(false);
    await saveReadNotifications(user.id, nextRead);
    router.push(notification.href);
  }

  async function markNotificationUnread(notification: AdminNotification) {
    if (!user) return;
    const nextRead = { ...readNotifications };
    delete nextRead[notification.id];
    setReadNotifications(nextRead);
    await saveReadNotifications(user.id, nextRead);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerBrand}>
              <Image source={mode === "dark" ? darkLogo : lightLogo} style={styles.logo} resizeMode="contain" />
              <View style={styles.headerText}>
                <Text style={[styles.kicker, { color: theme.muted }]}>Messers Cardio Club</Text>
                <Text style={[styles.title, { color: theme.text }]}>Menü</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              {isAdmin ? <AdminNoticeButton count={unreadNotifications.length} open={notificationsOpen} onPress={() => setNotificationsOpen((open) => !open)} /> : null}
              <ThemeToggle />
            </View>
          </View>

          <Reveal index={0}>
            <MotionPressable
              style={[styles.inviteCard, { borderColor: theme.border, backgroundColor: theme.surface }]}
              pressedStyle={styles.itemPressed}
              onPress={() => router.push("/invites")}
            >
              <View style={styles.inviteText}>
                <Text style={[styles.inviteKicker, { color: theme.accent }]}>Exklusiver Zugang</Text>
                <Text style={[styles.inviteTitle, { color: theme.text }]}>Einladungscodes</Text>
                <Text style={[styles.inviteBody, { color: theme.muted }]}>Codes erstellen, teilen und sehen, wer sie verwendet hat.</Text>
              </View>
              <View style={[styles.inviteArrow, { backgroundColor: theme.button }]}>
                <Text style={[styles.arrow, { color: theme.inverse }]}>›</Text>
              </View>
            </MotionPressable>
          </Reveal>

          <View style={styles.grid}>
            <MenuItem index={1} title="Sportideen" body="Neue Aktivität vorschlagen" onPress={() => router.push("/ideas")} />
            <MenuItem index={2} title="PIN" body="App-PIN ändern" onPress={() => router.push("/pin")} />
            <MenuItem index={3} title="Push" body="Benachrichtigungen verwalten" onPress={() => router.push("/push")} />
            <MenuItem index={4} title="Profil" body="Name, Stadt und Telefonnummer" onPress={() => router.push("/profile")} />
            {isAdmin ? <MenuItem index={5} title="Admin" body="Mitglieder und Rechte verwalten" onPress={() => router.push("/admin")} /> : null}
          </View>

          <Pressable style={({ pressed }) => [styles.signOut, { borderColor: theme.border }, pressed && styles.itemPressed]} onPress={signOut}>
            <Text style={[styles.signOutText, { color: theme.muted }]}>Abmelden</Text>
          </Pressable>
        </ScrollView>
        {isAdmin && notificationsOpen ? (
          <NotificationPreviewPanel notifications={visibleNotifications} readNotifications={readNotifications} onSelect={openNotification} onMarkUnread={markNotificationUnread} />
        ) : null}
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function AdminNoticeButton({ count, open, onPress }: { count: number; open: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.noticeButton, { borderColor: theme.border, backgroundColor: theme.softSurface }, pressed && styles.itemPressed]}
      onPress={onPress}
    >
      <Text style={[styles.noticeIcon, { color: theme.text }]}>{open ? "×" : "!"}</Text>
      {count > 0 ? (
        <View style={[styles.noticeBadge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.noticeBadgeText, { color: theme.inverse }]}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function NotificationPreview({ notifications, onSelect }: { notifications: AdminNotification[]; onSelect: (notification: AdminNotification) => void }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.notificationPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[styles.notificationTitle, { color: theme.text }]}>Anfragen</Text>
      {notifications.length === 0 ? <Text style={[styles.notificationEmpty, { color: theme.muted }]}>Keine neuen Meldungen.</Text> : null}
      {notifications.map((notification) => (
        <Pressable key={notification.id} style={[styles.notificationRow, { borderTopColor: theme.border }]} onPress={() => onSelect(notification)}>
          <View style={styles.notificationDot} />
          <View style={styles.notificationText}>
            <Text style={[styles.notificationKicker, { color: theme.accent }]}>{notification.title}</Text>
            <Text style={[styles.notificationBody, { color: theme.text }]} numberOfLines={1}>
              {notification.body}
            </Text>
          </View>
          <Text style={[styles.itemArrow, { color: theme.muted }]}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NotificationPreviewPanel({
  notifications,
  readNotifications,
  onSelect,
  onMarkUnread,
}: {
  notifications: AdminNotification[];
  readNotifications: Record<string, number>;
  onSelect: (notification: AdminNotification) => void;
  onMarkUnread: (notification: AdminNotification) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.notificationPanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <Text style={[styles.notificationTitle, { color: theme.text }]}>Anfragen</Text>
      {notifications.length === 0 ? <Text style={[styles.notificationEmpty, { color: theme.muted }]}>Keine neuen Meldungen.</Text> : null}
      {notifications.map((notification) => {
        const readAt = readNotifications[notification.id];
        return (
          <View key={notification.id} style={[styles.notificationRow, { borderTopColor: theme.border }]}>
            <View style={[styles.notificationDot, readAt ? styles.notificationDotRead : null]} />
            <Pressable style={styles.notificationText} onPress={() => onSelect(notification)}>
              <Text style={[styles.notificationKicker, { color: readAt ? theme.muted : theme.accent }]}>{readAt ? "Gelesen" : notification.title}</Text>
              <Text style={[styles.notificationBody, { color: theme.text }]} numberOfLines={1}>
                {notification.body}
              </Text>
            </Pressable>
            {readAt ? (
              <Pressable style={[styles.markUnreadButton, { backgroundColor: theme.softSurface }]} onPress={() => onMarkUnread(notification)}>
                <Text style={[styles.markUnreadText, { color: theme.text }]}>Ungelesen</Text>
              </Pressable>
            ) : (
              <Text style={[styles.itemArrow, { color: theme.muted }]}>›</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

async function loadReadNotificationIds(userId: string): Promise<Set<string>> {
  const value = await AsyncStorage.getItem(readNotificationsKey(userId));
  if (!value) return new Set();
  try {
    return new Set(JSON.parse(value) as string[]);
  } catch {
    return new Set();
  }
}

async function saveReadNotificationIds(userId: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(readNotificationsKey(userId), JSON.stringify([...ids]));
}

async function loadReadNotifications(userId: string): Promise<Record<string, number>> {
  const value = await AsyncStorage.getItem(readNotificationsKey(userId));
  if (!value) return {};
  try {
    return pruneReadNotifications(JSON.parse(value) as Record<string, number>);
  } catch {
    return {};
  }
}

async function saveReadNotifications(userId: string, readNotifications: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(readNotificationsKey(userId), JSON.stringify(pruneReadNotifications(readNotifications)));
}

function readNotificationsKey(userId: string): string {
  return `mcc:admin-notifications-read:${userId}`;
}

function isNotificationVisible(id: string, readNotifications: Record<string, number>): boolean {
  const readAt = readNotifications[id];
  return !readAt || Date.now() - readAt < READ_NOTIFICATION_TTL_MS;
}

function pruneReadNotifications(readNotifications: Record<string, number>): Record<string, number> {
  const now = Date.now();
  return Object.fromEntries(Object.entries(readNotifications).filter(([, readAt]) => now - readAt < READ_NOTIFICATION_TTL_MS));
}

function MenuItem({ title, body, onPress, index }: { title: string; body: string; onPress: () => void; index: number }) {
  const { theme } = useTheme();

  return (
    <Reveal index={index}>
      <MotionPressable style={[styles.item, { borderColor: theme.border, backgroundColor: theme.softSurface }]} pressedStyle={styles.itemPressed} onPress={onPress}>
        <View style={styles.itemText}>
          <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.itemBody, { color: theme.muted }]} numberOfLines={2}>
            {body}
          </Text>
        </View>
        <Text style={[styles.itemArrow, { color: theme.muted }]}>›</Text>
      </MotionPressable>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: {
    width: "100%",
    gap: 16,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 30,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  headerBrand: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  logo: { width: 42, height: 42 },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  noticeButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  noticeIcon: { fontSize: 18, fontWeight: "900", lineHeight: 22 },
  noticeBadge: {
    alignItems: "center",
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    paddingHorizontal: 5,
    position: "absolute",
    right: -3,
    top: -4,
  },
  noticeBadgeText: { fontSize: 10, fontWeight: "900", lineHeight: 12 },
  notificationPanel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    maxWidth: 360,
    padding: 12,
    position: "absolute",
    right: 18,
    top: 72,
    width: "100%",
    zIndex: 20,
    elevation: 20,
  },
  notificationTitle: { fontSize: 16, fontWeight: "900" },
  notificationEmpty: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  notificationRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 10 },
  notificationDot: { backgroundColor: "#4da3ff", borderRadius: 999, height: 8, width: 8 },
  notificationDotRead: { opacity: 0.28 },
  notificationText: { flex: 1, minWidth: 0 },
  notificationKicker: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  notificationBody: { fontSize: 14, fontWeight: "900", lineHeight: 19 },
  markUnreadButton: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  markUnreadText: { fontSize: 11, fontWeight: "900" },
  kicker: { fontSize: 12, fontWeight: "800", lineHeight: 16 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: 0, lineHeight: 36 },
  inviteCard: {
    minHeight: 132,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  },
  inviteText: { flex: 1, minWidth: 0, gap: 4 },
  inviteKicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  inviteTitle: { fontSize: 26, fontWeight: "900", lineHeight: 30 },
  inviteBody: { fontSize: 14, lineHeight: 20 },
  inviteArrow: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { fontSize: 30, fontWeight: "700", lineHeight: 32 },
  grid: { gap: 9 },
  item: {
    minHeight: 70,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemPressed: { opacity: 0.82 },
  itemText: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { fontSize: 17, fontWeight: "900", lineHeight: 21 },
  itemBody: { fontSize: 13, lineHeight: 18 },
  itemArrow: { fontSize: 24, fontWeight: "700", lineHeight: 26 },
  signOut: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
  },
  signOutText: { fontSize: 15, fontWeight: "900" },
});
