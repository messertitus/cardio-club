import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { PageHeader } from "../src/components/PageHeader";
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
  const [openedUserId, setOpenedUserId] = useState<string | null>(null);
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
          <PageHeader title="Mitglieder" showBack={false} showTheme />
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {members.map((member) => {
            const opened = openedUserId === member.userId;
            return (
              <Pressable
                key={member.userId}
                style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }, pressed && styles.pressed]}
                onPress={() => setOpenedUserId(opened ? null : member.userId)}
              >
                <View style={styles.previewRow}>
                  <View style={styles.memberText}>
                    <Text style={[styles.name, { color: theme.text }]}>{member.displayName}</Text>
                    <Text style={[styles.detail, { color: theme.muted }]}>{member.city ?? "Stadt noch offen"}</Text>
                  </View>
                  <View style={styles.badges}>
                    <Text style={[styles.badge, { backgroundColor: theme.surface, color: theme.text }]}>{roleLabels[member.role]}</Text>
                    {member.contactSports.length > 0 ? <Text style={[styles.badgeStrong, { backgroundColor: theme.button, color: theme.inverse }]}>AP</Text> : null}
                  </View>
                </View>
                {opened ? (
                  <View style={[styles.detailPanel, { borderTopColor: theme.border }]}>
                    <ProfileLine label="Beigetreten" value={formatJoinedAt(member.joinedAt)} />
                    <ProfileLine label="Rolle" value={roleLabels[member.role]} />
                    <ProfileLine label="Lieblingssportarten" value={member.favoriteSports ?? "Noch offen"} />
                    <ProfileLine label="Alter" value={member.birthDate ? formatAge(member.birthDate) : "Noch offen"} />
                    <ProfileLine label="Ansprechpartner" value={member.contactSports.length > 0 ? member.contactSports.join(", ") : "Keine Sportart"} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <BottomNav active="members" />
      </View>
    </SafeAreaView>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileLine}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

function formatJoinedAt(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAge(value: string): string {
  const birthDate = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "Noch offen";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (today < birthdayThisYear) age -= 1;

  return `${age} Jahre`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: { gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  title: { fontSize: 32, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb4a8", fontSize: 14, fontWeight: "800" },
  card: {
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  previewRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  memberText: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 18, fontWeight: "900" },
  detail: { fontSize: 14, lineHeight: 20 },
  badges: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    overflow: "hidden",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeStrong: {
    overflow: "hidden",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailPanel: { gap: 9, borderTopWidth: 1, paddingTop: 11 },
  profileLine: { gap: 2 },
  profileLabel: { color: "#728197", fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  profileValue: { color: "#d9ecff", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  pressed: { opacity: 0.84 },
});
