import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import {
  getMccEventState,
  isCurrentUserAdmin,
  listMccMembers,
  removeMccMemberFromClub,
  setMccActivityContact,
  updateMccMemberRole,
  type ClubMemberRole,
  type MccEventState,
  type MccMember,
} from "../src/services";

const roles: ClubMemberRole[] = ["member", "mod", "admin"];

export default function AdminScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [members, setMembers] = useState<MccMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supporterIds = useMemo(() => {
    if (!state?.event.selected_sport_id) return new Set<string>();
    return new Set(state.votes.filter((vote) => vote.sport_id === state.event.selected_sport_id).map((vote) => vote.user_id));
  }, [state]);
  const supporters = members.filter((member) => supporterIds.has(member.userId));

  async function load() {
    if (!user) return;
    setBusy(true);
    const [adminResult, eventResult] = await Promise.all([isCurrentUserAdmin(supabase, user.id), getMccEventState(supabase, user.id)]);
    if (adminResult.error || eventResult.error) {
      setMessage(adminResult.error?.message ?? eventResult.error?.message ?? "Adminbereich konnte nicht geladen werden.");
      setBusy(false);
      return;
    }

    setIsAdmin(adminResult.data);
    setState(eventResult.data);
    if (!adminResult.data) {
      setBusy(false);
      return;
    }

    const membersResult = await listMccMembers(supabase, {
      clubId: eventResult.data.clubId,
      activityContactId: eventResult.data.event.activity_contact_id,
    });
    setBusy(false);
    if (membersResult.error) {
      setMessage(membersResult.error.message);
      return;
    }
    setMessage(null);
    setMembers(membersResult.data);
  }

  useEffect(() => {
    void load();
  }, [user]);

  async function changeRole(member: MccMember, role: ClubMemberRole) {
    if (!state) return;
    const result = await updateMccMemberRole(supabase, { clubId: state.clubId, userId: member.userId, role });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  async function chooseContact(member: MccMember) {
    if (!state) return;
    const result = await setMccActivityContact(supabase, { eventId: state.event.id, userId: member.userId });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  async function removeMember(member: MccMember) {
    if (!state || member.userId === user?.id) return;
    const result = await removeMccMemberFromClub(supabase, { clubId: state.clubId, userId: member.userId });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  async function sendPinReset(member: MccMember) {
    if (!member.phone) {
      setMessage("Für dieses Mitglied ist keine Telefonnummer hinterlegt.");
      return;
    }
    const body = encodeURIComponent("Messers Cardio Club: Bitte öffne die App und erstelle im Bereich PIN eine neue App-PIN.");
    await Linking.openURL(`sms:${member.phone}?body=${body}`);
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.kicker, { color: theme.accent }]}>Admin</Text>
          <Text style={[styles.title, { color: theme.text }]}>Club steuern</Text>
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {busy ? <LoadingState /> : null}
          {!busy && !isAdmin ? <Text style={[styles.body, { color: theme.muted }]}>Dieser Bereich ist nur für Admins sichtbar.</Text> : null}

          {isAdmin ? (
            <>
              <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Ansprechpartner</Text>
                <Text style={[styles.body, { color: theme.muted }]}>
                  Nach der Entscheidung kann der Ansprechpartner aus den Unterstützern der gewählten Sportart gesetzt werden.
                </Text>
                {supporters.length === 0 ? <Text style={[styles.muted, { color: theme.muted }]}>Noch keine Unterstützer für die finale Sportart.</Text> : null}
                {supporters.map((member) => (
                  <Pressable key={member.userId} style={[styles.row, { borderTopColor: theme.border }]} onPress={() => chooseContact(member)}>
                    <View style={styles.memberText}>
                      <Text style={[styles.name, { color: theme.text }]}>{member.displayName}</Text>
                      <Text style={[styles.muted, { color: theme.muted }]}>{member.city ?? member.phone ?? "Keine Stadt"}</Text>
                    </View>
                    <Text style={[styles.badge, { backgroundColor: member.isActivityContact ? theme.button : theme.surface, color: member.isActivityContact ? theme.inverse : theme.text }]}>
                      {member.isActivityContact ? "AP" : "setzen"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Mitglieder & Rechte</Text>
                {members.map((member) => (
                  <View key={member.userId} style={[styles.memberCard, { borderTopColor: theme.border }]}>
                    <View>
                      <Text style={[styles.name, { color: theme.text }]}>{member.displayName}</Text>
                      <Text style={[styles.muted, { color: theme.muted }]}>
                        {member.city ?? "Stadt offen"} · {member.phone ?? "Keine Nummer"} · {roleLabel(member.role)}
                      </Text>
                    </View>
                    <View style={styles.roleRow}>
                      {roles.map((role) => (
                        <Pressable
                          key={role}
                          style={[styles.roleButton, { backgroundColor: member.role === role ? theme.button : theme.surface }]}
                          onPress={() => changeRole(member, role)}
                        >
                          <Text style={[styles.roleText, { color: member.role === role ? theme.inverse : theme.text }]}>{roleLabel(role)}</Text>
                        </Pressable>
                      ))}
                      <Pressable style={[styles.roleButton, { backgroundColor: theme.surface }]} onPress={() => sendPinReset(member)}>
                        <Text style={[styles.roleText, { color: theme.text }]}>PIN-SMS</Text>
                      </Pressable>
                      <Pressable style={[styles.roleButton, styles.dangerButton]} onPress={() => removeMember(member)}>
                        <Text style={styles.dangerText}>Entfernen</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function roleLabel(role: ClubMemberRole): string {
  if (role === "admin") return "Admin";
  if (role === "mod") return "Moderator";
  return "Mitglied";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 22 },
  muted: { fontSize: 13, lineHeight: 19 },
  card: {
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: { fontSize: 21, fontWeight: "900" },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  memberText: { flex: 1, minWidth: 0 },
  memberCard: { gap: 10, borderTopWidth: 1, paddingTop: 12 },
  name: { fontSize: 16, fontWeight: "900" },
  badge: {
    overflow: "hidden",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleButton: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  roleText: { fontSize: 12, fontWeight: "900" },
  dangerButton: { backgroundColor: "rgba(255,126,106,0.16)" },
  dangerText: { color: "#ff8d7a", fontSize: 12, fontWeight: "900" },
});
