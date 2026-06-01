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
import { isCurrentUserAdmin } from "../src/services";

const darkLogo = require("../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../assets/mcc-logo-color-symbol.png");

export default function MenuScreen() {
  const { user } = useAuth();
  const { mode, theme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    isCurrentUserAdmin(supabase, user.id).then((result) => setIsAdmin(result.data ?? false));
  }, [user]);

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
            <ThemeToggle />
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
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
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
