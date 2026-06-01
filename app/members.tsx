import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { getMccEventState, listMccMembers, type MccMember } from "../src/services";

const roleLabels = {
  admin: "Admin",
  mod: "Moderator",
  member: "Mitglied",
};

export default function MembersScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [members, setMembers] = useState<MccMember[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const state = await getMccEventState(supabase, user.id);
      if (state.error) {
        setMessage(state.error.message);
        return;
      }
      const result = await listMccMembers(supabase, {
        clubId: state.data.clubId,
        activityContactId:
          state.data.event.status === "decided" || state.data.event.status === "completed" ? state.data.event.activity_contact_id : null,
      });
      if (result.error) {
        setMessage(result.error.message);
        return;
      }
      setMembers(result.data);
    }

    void load();
  }, [user]);

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Mitglieder</Text>
            <ThemeToggle />
          </View>
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {members.map((member) => (
            <View key={member.userId} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <View style={styles.memberText}>
                <Text style={[styles.name, { color: theme.text }]}>{member.displayName}</Text>
                <Text style={[styles.detail, { color: theme.muted }]}>{member.city ?? "Stadt noch offen"}</Text>
                <Text style={[styles.joined, { color: theme.muted }]}>Beigetreten {formatJoinedAt(member.joinedAt)}</Text>
                <Text style={[styles.detail, { color: theme.muted }]}>{member.isActivityContact ? "Ansprechpartner für diese Aktivität" : "Clubmitglied"}</Text>
              </View>
              <View style={styles.badges}>
                <Text style={[styles.badge, { backgroundColor: theme.surface, color: theme.text }]}>{roleLabels[member.role]}</Text>
                {member.isActivityContact ? <Text style={[styles.badgeStrong, { backgroundColor: theme.button, color: theme.inverse }]}>Kontakt</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
        <BottomNav active="members" />
      </View>
    </SafeAreaView>
  );
}

function formatJoinedAt(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  title: { color: "#ffffff", fontSize: 32, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb4a8", fontSize: 14, fontWeight: "800" },
  card: {
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 14,
  },
  memberText: { gap: 3 },
  name: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  detail: { color: "#9aa7b8", fontSize: 14, lineHeight: 20 },
  joined: { color: "#9aa7b8", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#d9ecff",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeStrong: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#4da3ff",
    color: "#05070b",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
