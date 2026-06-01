import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import {
  deactivateMccMember,
  deleteMccSport,
  getMccEventState,
  isCurrentUserAdmin,
  listMccMembers,
  listMccSports,
  setMccActivityContact,
  updateMccMemberRole,
  upsertMccSport,
  type ClubMemberRole,
  type MccEventState,
  type MccMember,
  type Row,
  type SportIntensityLevel,
  type SportLocationType,
} from "../src/services";

const roles: ClubMemberRole[] = ["member", "mod", "admin"];
const intensityOptions: SportIntensityLevel[] = ["low", "medium", "high"];
const locationOptions: SportLocationType[] = ["indoor", "outdoor", "water", "field", "flexible"];

type SportDraft = {
  name: string;
  category: string;
  intensityLevel: SportIntensityLevel;
  locationType: SportLocationType;
  combinableTags: string;
};

const emptySportDraft: SportDraft = {
  name: "",
  category: "cardio",
  intensityLevel: "medium",
  locationType: "flexible",
  combinableTags: "",
};

export default function AdminScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [members, setMembers] = useState<MccMember[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportDraft, setSportDraft] = useState<SportDraft>(emptySportDraft);
  const [editingSportId, setEditingSportId] = useState<string | null>(null);
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

    const [membersResult, sportsResult] = await Promise.all([
      listMccMembers(supabase, {
        clubId: eventResult.data.clubId,
        activityContactId: eventResult.data.event.activity_contact_id,
      }),
      listMccSports(supabase),
    ]);
    setBusy(false);
    if (membersResult.error) {
      setMessage(membersResult.error.message);
      return;
    }
    if (sportsResult.error) {
      setMessage(sportsResult.error.message);
      return;
    }
    setMessage(null);
    setMembers(membersResult.data);
    setSports(sportsResult.data);
  }

  useEffect(() => {
    void load();
  }, [user]);

  function confirmAdminAction(title: string, detail: string, onConfirm: () => void) {
    Alert.alert(title, detail, [
      { text: "Abbrechen", style: "cancel" },
      { text: "Bestätigen", style: "destructive", onPress: onConfirm },
    ]);
  }

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

  async function deactivateMember(member: MccMember) {
    if (!state || member.userId === user?.id) return;
    const result = await deactivateMccMember(supabase, { userId: member.userId });
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

  function editSport(sport: Row<"sports">) {
    setEditingSportId(sport.id);
    setSportDraft({
      name: sport.name,
      category: sport.category,
      intensityLevel: sport.intensity_level,
      locationType: sport.location_type,
      combinableTags: sport.combinable_tags.join(", "),
    });
  }

  function resetSportDraft() {
    setEditingSportId(null);
    setSportDraft(emptySportDraft);
  }

  async function saveSport() {
    const result = await upsertMccSport(supabase, {
      sportId: editingSportId,
      name: sportDraft.name,
      category: sportDraft.category,
      intensityLevel: sportDraft.intensityLevel,
      locationType: sportDraft.locationType,
      combinableTags: sportDraft.combinableTags.split(","),
    });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    resetSportDraft();
    await load();
  }

  async function deleteSport(sport: Row<"sports">) {
    const result = await deleteMccSport(supabase, sport.id);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
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
                  <Pressable
                    key={member.userId}
                    style={[styles.row, { borderTopColor: theme.border }]}
                    onPress={() =>
                      confirmAdminAction("Ansprechpartner setzen?", `${member.displayName} wird Ansprechpartner für das nächste Event.`, () => void chooseContact(member))
                    }
                  >
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
                <Text style={[styles.cardTitle, { color: theme.text }]}>Sportarten verwalten</Text>
                <View style={styles.formGrid}>
                  <TextInput
                    value={sportDraft.name}
                    onChangeText={(name) => setSportDraft((draft) => ({ ...draft, name }))}
                    placeholder="Name"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
                  />
                  <TextInput
                    value={sportDraft.category}
                    onChangeText={(category) => setSportDraft((draft) => ({ ...draft, category }))}
                    placeholder="Kategorie"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
                  />
                  <TextInput
                    value={sportDraft.combinableTags}
                    onChangeText={(combinableTags) => setSportDraft((draft) => ({ ...draft, combinableTags }))}
                    placeholder="Tags, getrennt mit Komma"
                    placeholderTextColor={theme.muted}
                    style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
                  />
                </View>
                <ChipGroup
                  label="Intensität"
                  options={intensityOptions}
                  selected={sportDraft.intensityLevel}
                  onSelect={(intensityLevel) => setSportDraft((draft) => ({ ...draft, intensityLevel }))}
                />
                <ChipGroup
                  label="Ort"
                  options={locationOptions}
                  selected={sportDraft.locationType}
                  onSelect={(locationType) => setSportDraft((draft) => ({ ...draft, locationType }))}
                />
                <View style={styles.roleRow}>
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: theme.button }]}
                    onPress={() =>
                      confirmAdminAction(
                        editingSportId ? "Sportart speichern?" : "Sportart anlegen?",
                        editingSportId ? `${sportDraft.name} wird geändert.` : `${sportDraft.name || "Neue Sportart"} wird hinzugefügt.`,
                        () => void saveSport(),
                      )
                    }
                  >
                    <Text style={[styles.primaryText, { color: theme.inverse }]}>{editingSportId ? "Speichern" : "Anlegen"}</Text>
                  </Pressable>
                  {editingSportId ? (
                    <Pressable style={[styles.roleButton, { backgroundColor: theme.surface }]} onPress={resetSportDraft}>
                      <Text style={[styles.roleText, { color: theme.text }]}>Abbrechen</Text>
                    </Pressable>
                  ) : null}
                </View>

                {sports.map((sport) => (
                  <View key={sport.id} style={[styles.memberCard, { borderTopColor: theme.border }]}>
                    <View>
                      <Text style={[styles.name, { color: theme.text }]}>{sport.name}</Text>
                      <Text style={[styles.muted, { color: theme.muted }]}>
                        {sport.category} · {intensityLabel(sport.intensity_level)} · {locationLabel(sport.location_type)}
                      </Text>
                    </View>
                    <View style={styles.roleRow}>
                      <Pressable style={[styles.roleButton, { backgroundColor: theme.surface }]} onPress={() => editSport(sport)}>
                        <Text style={[styles.roleText, { color: theme.text }]}>Bearbeiten</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleButton, styles.dangerButton]}
                        onPress={() =>
                          confirmAdminAction(
                            "Sportart löschen?",
                            `${sport.name} wird dauerhaft entfernt. Wenn sie bereits in Events genutzt wird, blockt die Datenbank das Löschen.`,
                            () => void deleteSport(sport),
                          )
                        }
                      >
                        <Text style={styles.dangerText}>Löschen</Text>
                      </Pressable>
                    </View>
                  </View>
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
                          onPress={() =>
                            confirmAdminAction("Rechte ändern?", `${member.displayName} wird auf ${roleLabel(role)} gesetzt.`, () => void changeRole(member, role))
                          }
                        >
                          <Text style={[styles.roleText, { color: member.role === role ? theme.inverse : theme.text }]}>{roleLabel(role)}</Text>
                        </Pressable>
                      ))}
                      <Pressable
                        style={[styles.roleButton, { backgroundColor: theme.surface }]}
                        onPress={() =>
                          confirmAdminAction("PIN-SMS senden?", `${member.displayName} bekommt eine SMS mit Hinweis zum PIN-Reset.`, () => void sendPinReset(member))
                        }
                      >
                        <Text style={[styles.roleText, { color: theme.text }]}>PIN-SMS</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleButton, styles.dangerButton]}
                        onPress={() =>
                          confirmAdminAction(
                            "Mitglied deaktivieren?",
                            `${member.displayName} kann sich danach nicht mehr anmelden und sieht beim Login einen Hinweis.`,
                            () => void deactivateMember(member),
                          )
                        }
                      >
                        <Text style={styles.dangerText}>Deaktivieren</Text>
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

function intensityLabel(value: SportIntensityLevel): string {
  if (value === "low") return "leicht";
  if (value === "high") return "hoch";
  return "mittel";
}

function locationLabel(value: SportLocationType): string {
  if (value === "indoor") return "Indoor";
  if (value === "outdoor") return "Outdoor";
  if (value === "water") return "Wasser";
  if (value === "field") return "Feld";
  return "flexibel";
}

function ChipGroup<T extends SportIntensityLevel | SportLocationType>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.chipGroup}>
      <Text style={[styles.muted, { color: theme.muted }]}>{label}</Text>
      <View style={styles.roleRow}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable key={option} style={[styles.roleButton, { backgroundColor: active ? theme.button : theme.surface }]} onPress={() => onSelect(option)}>
              <Text style={[styles.roleText, { color: active ? theme.inverse : theme.text }]}>
                {isIntensity(option) ? intensityLabel(option) : locationLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function isIntensity(value: SportIntensityLevel | SportLocationType): value is SportIntensityLevel {
  return value === "low" || value === "medium" || value === "high";
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
  formGrid: { gap: 10 },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
  },
  chipGroup: { gap: 8 },
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
  primaryButton: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  primaryText: { fontSize: 13, fontWeight: "900" },
  dangerButton: { backgroundColor: "rgba(255,126,106,0.16)" },
  dangerText: { color: "#ff8d7a", fontSize: 12, fontWeight: "900" },
});
