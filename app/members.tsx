import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import { getMccEventState, listMccMembers, type MccMember } from "../src/services";

const roleLabels = {
  owner: "Admin",
  admin: "Admin",
  member: "Mitglied",
};

export default function MembersScreen() {
  const { loading, user } = useAuth();
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
        activityContactId: state.data.event.activity_contact_id,
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.content}>
          <Text style={styles.title}>Mitglieder</Text>
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {members.map((member) => (
            <View key={member.userId} style={styles.card}>
              <View style={styles.memberText}>
                <Text style={styles.name}>{member.displayName}</Text>
                <Text style={styles.detail}>{member.phone ?? "Keine Nummer hinterlegt"}</Text>
                <Text style={styles.detail}>{member.isActivityContact ? "Ansprechpartner für diese Aktivität" : "Clubmitglied"}</Text>
              </View>
              <View style={styles.badges}>
                <Text style={styles.badge}>{roleLabels[member.role]}</Text>
                {member.isActivityContact ? <Text style={styles.badgeStrong}>Kontakt</Text> : null}
              </View>
            </View>
          ))}
        </View>
        <BottomNav active="members" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { flex: 1, gap: 12, padding: 18 },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "900", letterSpacing: 0 },
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
