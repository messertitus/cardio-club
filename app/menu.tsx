import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { MotionBackground } from "../src/components/MccDesign";
import { MotionPressable, Reveal } from "../src/components/Motion";
import { MainHeader } from "../src/components/PageHeader";
import { useTourTarget } from "../src/components/TourGuide";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { directChatNotificationId, isNotificationVisible, loadReadNotifications, saveReadNotifications } from "../src/lib/adminNotifications";
import { supabase } from "../src/lib/supabase";
import { isCurrentUserAdmin, listDirectChats, listProfileNameChangeRequests, listSportIdeas } from "../src/services";

type AdminNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
};

export default function MenuScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const ideasTarget = useTourTarget("menu-ideas");
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

      const [ideasResult, namesResult, directChatsResult] = await Promise.all([listSportIdeas(supabase), listProfileNameChangeRequests(supabase), listDirectChats(supabase)]);
      const pendingIdeas: AdminNotification[] =
        ideasResult.data
          ?.filter((idea) => idea.status === "pending")
          .map((idea) => ({
            id: `sport-idea:${idea.id}`,
            title: "Sportidee",
            body: idea.name ?? idea.profile_name ?? "Entwurf ohne Namen",
            href: "/ideas",
          })) ?? [];
      const pendingNames: AdminNotification[] =
        namesResult.data?.map((request) => ({
          id: `name-request:${request.id}`,
          title: "Namensänderung",
          body: request.requested_display_name,
          href: "/admin?section=nameRequests",
        })) ?? [];
      const openDirectChats: AdminNotification[] =
        directChatsResult.data
          ?.filter((chat) => chat.status === "open" && chat.admin_id === user.id)
          .map((chat) => ({
            id: directChatNotificationId(chat),
            title: "Kontaktanfrage",
            body: chat.requesterName,
            href: `/chat?directChatId=${chat.id}`,
          })) ?? [];

      setNotifications([...openDirectChats, ...pendingIdeas, ...pendingNames]);
    }

    void loadAdminState();
  }, [user]);

  async function openNotification(notification: AdminNotification) {
    if (!user) return;
    const nextRead = { ...readNotifications, [notification.id]: Date.now() };
    setReadNotifications(nextRead);
    setNotificationsOpen(false);
    await saveReadNotifications(user.id, nextRead);
    router.push(notification.href as never);
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
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      <View style={styles.shell}>
        <ScrollView style={styles.shell} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MainHeader
            title="Menü"
            actions={isAdmin ? <AdminNoticeButton count={unreadNotifications.length} open={notificationsOpen} onPress={() => setNotificationsOpen((open) => !open)} /> : null}
          />

          <Reveal index={0}>
            <MotionPressable
              style={[styles.inviteCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}
              pressedStyle={styles.itemPressed}
              onPress={() => router.push("/invites")}
            >
              <View style={styles.inviteText}>
                <Text style={[styles.inviteKicker, { color: theme.mcc.accent }]}>Exklusiver Zugang</Text>
                <Text style={[styles.inviteTitle, { color: theme.mcc.textPrimary }]}>Einladungscodes</Text>
                <Text style={[styles.inviteBody, { color: theme.mcc.textSecondary }]}>Codes erstellen, teilen und sehen, wer sie verwendet hat.</Text>
              </View>
              <View style={[styles.inviteArrow, { backgroundColor: theme.mcc.accentDeep }]}>
                <Text style={[styles.arrow, { color: "#FFFFFF" }]}>›</Text>
              </View>
            </MotionPressable>
          </Reveal>

          <View style={styles.grid}>
            <View ref={ideasTarget.ref} onLayout={ideasTarget.onLayout}>
              <MenuItem index={1} title="Sportarten und Standorte" body="Neue Aktivität vorschlagen" onPress={() => router.push("/ideas")} />
            </View>
            <MenuItem index={2} title="Profil" body="Name, Standort und Geburtstag" onPress={() => router.push("/profile")} />
            <MenuItem index={3} title="Einstellungen" body="PIN und Telefonnummer" onPress={() => router.push("/settings")} />
            <MenuItem index={4} title="App installieren" body="Zum Homescreen hinzufügen" onPress={() => router.push("/install")} />
            <MenuItem index={5} title="Push" body="Benachrichtigungen verwalten" onPress={() => router.push("/push")} />
            {isAdmin ? <MenuItem index={6} title="Admin" body="Mitglieder und Rechte verwalten" onPress={() => router.push("/admin")} /> : null}
          </View>

          <Pressable style={({ pressed }) => [styles.signOut, { borderColor: theme.mcc.line }, pressed && styles.itemPressed]} onPress={signOut}>
            <Text style={[styles.signOutText, { color: theme.mcc.textSecondary }]}>Abmelden</Text>
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
      style={({ pressed }) => [styles.noticeButton, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }, pressed && styles.itemPressed]}
      onPress={onPress}
    >
      <Text style={[styles.noticeIcon, { color: theme.mcc.textPrimary }]}>{open ? "×" : "!"}</Text>
      {count > 0 ? (
        <View style={[styles.noticeBadge, { backgroundColor: theme.mcc.accent }]}>
          <Text style={[styles.noticeBadgeText, { color: "#FFFFFF" }]}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
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
    <View style={[styles.notificationPanel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
      <Text style={[styles.notificationTitle, { color: theme.mcc.textPrimary }]}>Anfragen</Text>
      {notifications.length === 0 ? <Text style={[styles.notificationEmpty, { color: theme.mcc.textSecondary }]}>Keine neuen Meldungen.</Text> : null}
      {notifications.map((notification) => {
        const readAt = readNotifications[notification.id];
        return (
          <View key={notification.id} style={[styles.notificationRow, { borderTopColor: theme.mcc.line }]}>
            <View style={[styles.notificationDot, readAt ? styles.notificationDotRead : null]} />
            <Pressable style={styles.notificationText} onPress={() => onSelect(notification)}>
              <Text style={[styles.notificationKicker, { color: readAt ? theme.mcc.textSecondary : theme.mcc.accent }]}>{readAt ? "Gelesen" : notification.title}</Text>
              <Text style={[styles.notificationBody, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
                {notification.body}
              </Text>
            </Pressable>
            {readAt ? (
              <Pressable style={[styles.markUnreadButton, { backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => onMarkUnread(notification)}>
                <Text style={[styles.markUnreadText, { color: theme.mcc.textPrimary }]}>Ungelesen</Text>
              </Pressable>
            ) : (
              <Text style={[styles.itemArrow, { color: theme.mcc.textSecondary }]}>›</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function MenuItem({ title, body, onPress, index }: { title: string; body: string; onPress: () => void; index: number }) {
  const { theme } = useTheme();

  return (
    <Reveal index={index}>
      <MotionPressable style={[styles.item, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} pressedStyle={styles.itemPressed} onPress={onPress}>
        <View style={styles.itemText}>
          <Text style={[styles.itemTitle, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.itemBody, { color: theme.mcc.textSecondary }]} numberOfLines={2}>
            {body}
          </Text>
        </View>
        <Text style={[styles.itemArrow, { color: theme.mcc.textSecondary }]}>›</Text>
      </MotionPressable>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: {
    width: "100%",
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 30,
  },
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
    marginTop: 4,
  },
  signOutText: { fontSize: 15, fontWeight: "900" },
});
