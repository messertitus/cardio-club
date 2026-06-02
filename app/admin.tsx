import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { PageHeader } from "../src/components/PageHeader";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import {
  deactivateMccMember,
  deleteMccSportContact,
  deleteMccSport,
  getMccEventState,
  isCurrentUserAdmin,
  listMccMembers,
  listMccSports,
  listMccSportContacts,
  listProfileNameChangeRequests,
  reviewProfileNameChangeRequest,
  updateMccMemberRole,
  upsertMccSportContact,
  upsertMccSport,
  type ClubMemberRole,
  type MccEventState,
  type MccMember,
  type MccSportContact,
  type Row,
  type SportIntensityLevel,
  type SportLocationType,
} from "../src/services";

const roles: ClubMemberRole[] = ["member", "mod", "admin"];
const intensityOptions: SportIntensityLevel[] = ["low", "medium", "high"];
const locationOptions: SportLocationType[] = ["indoor", "outdoor", "water", "field", "flexible"];

type AdminSection = "overview" | "contacts" | "sports" | "members" | "nameRequests";

type SportDraft = {
  name: string;
  description: string;
  locationDescription: string;
  category: string;
  intensityLevel: SportIntensityLevel;
  locationType: SportLocationType;
  combinableTags: string;
};

const emptySportDraft: SportDraft = {
  name: "",
  description: "",
  locationDescription: "",
  category: "cardio",
  intensityLevel: "medium",
  locationType: "flexible",
  combinableTags: "",
};

export default function AdminScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [members, setMembers] = useState<MccMember[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportContacts, setSportContacts] = useState<MccSportContact[]>([]);
  const [nameRequests, setNameRequests] = useState<Row<"profile_change_requests">[]>([]);
  const [sportDraft, setSportDraft] = useState<SportDraft>(emptySportDraft);
  const [editingSportId, setEditingSportId] = useState<string | null>(null);
  const [contactSportId, setContactSportId] = useState<string | null>(null);
  const [contactUserId, setContactUserId] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const contactsBySport = useMemo(() => {
    const map = new Map<string, MccSportContact[]>();
    for (const contact of sportContacts) {
      const next = map.get(contact.sport_id) ?? [];
      next.push(contact);
      map.set(contact.sport_id, next);
    }
    return map;
  }, [sportContacts]);

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

    const [membersResult, sportsResult, contactsResult, nameRequestsResult] = await Promise.all([
      listMccMembers(supabase, {
        clubId: eventResult.data.clubId,
      }),
      listMccSports(supabase),
      listMccSportContacts(supabase),
      listProfileNameChangeRequests(supabase),
    ]);
    setBusy(false);

    if (membersResult.error || sportsResult.error || contactsResult.error || nameRequestsResult.error) {
      setMessage(membersResult.error?.message ?? sportsResult.error?.message ?? contactsResult.error?.message ?? nameRequestsResult.error?.message ?? "Adminbereich konnte nicht geladen werden.");
      return;
    }

    setMessage(null);
    setMembers(membersResult.data);
    setSports(sportsResult.data);
    setSportContacts(contactsResult.data);
    setNameRequests(nameRequestsResult.data);
    setContactSportId((current) => current ?? sportsResult.data[0]?.id ?? null);
    setContactUserId((current) => current ?? membersResult.data[0]?.userId ?? null);
  }

  useEffect(() => {
    void load();
  }, [user]);

  useEffect(() => {
    if (params.section && isAdminSection(params.section)) {
      setActiveSection(params.section);
    }
  }, [params.section]);

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

  async function saveSportContact() {
    if (!contactSportId || !contactUserId) {
      setMessage("Bitte Sportart und Mitglied auswählen.");
      return;
    }
    const result = await upsertMccSportContact(supabase, {
      sportId: contactSportId,
      userId: contactUserId,
      note: contactNote,
      isPrimary: true,
    });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setContactNote("");
    await load();
  }

  async function removeSportContact(contact: MccSportContact) {
    const result = await deleteMccSportContact(supabase, { sportId: contact.sport_id, userId: contact.user_id });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  async function deactivateMember(member: MccMember) {
    if (member.userId === user?.id) return;
    const result = await deactivateMccMember(supabase, { userId: member.userId });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  function editSport(sport: Row<"sports">) {
    setEditingSportId(sport.id);
    setSportDraft({
      name: sport.name,
      description: sport.description ?? "",
      locationDescription: sport.location_description ?? "",
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
      description: sportDraft.description,
      locationDescription: sportDraft.locationDescription,
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

  async function reviewNameRequest(request: Row<"profile_change_requests">, status: "approved" | "rejected") {
    const result = await reviewProfileNameChangeRequest(supabase, { requestId: request.id, status });
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
          <PageHeader kicker="Admin" title={sectionTitle(activeSection)} onBack={activeSection === "overview" ? undefined : () => setActiveSection("overview")} />

          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {busy ? <LoadingState /> : null}
          {!busy && !isAdmin ? <Text style={[styles.body, { color: theme.muted }]}>Dieser Bereich ist nur für Admins sichtbar.</Text> : null}

          {isAdmin && activeSection === "overview" ? (
            <View style={styles.adminGrid}>
              <AdminMenuCard title="Sport-APs" body="Ansprechpartner pro Sportart verwalten" onPress={() => setActiveSection("contacts")} />
              <AdminMenuCard title="Sportarten" body="Anlegen, ändern und löschen" onPress={() => setActiveSection("sports")} />
              <AdminMenuCard title="Mitglieder" body="Rechte und Deaktivierung" onPress={() => setActiveSection("members")} />
              <AdminMenuCard title="Namensanfragen" body={`${nameRequests.length} offene Freigaben`} onPress={() => setActiveSection("nameRequests")} />
            </View>
          ) : null}

          {isAdmin && activeSection === "contacts" ? (
            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Ansprechpartner pro Sportart</Text>
              <Text style={[styles.body, { color: theme.muted }]}>Jede Sportart kann einen primären Ansprechpartner haben. Ideal ist die Person, die die Idee eingebracht hat oder die Aktivität organisiert.</Text>
              <PickerGroup
                label="Sportart"
                items={sports.map((sport) => ({ id: sport.id, label: sport.name }))}
                selectedId={contactSportId}
                onSelect={setContactSportId}
              />
              <PickerGroup
                label="Mitglied"
                items={members.map((member) => ({ id: member.userId, label: member.displayName }))}
                selectedId={contactUserId}
                onSelect={setContactUserId}
              />
              <AdminInput value={contactNote} onChangeText={setContactNote} placeholder="Optionaler Hinweis, z. B. Treffpunkt-Erfahrung" />
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.button, alignSelf: "flex-start" }]}
                onPress={() =>
                  confirmAdminAction("Ansprechpartner speichern?", "Diese Person wird primärer Ansprechpartner für die gewählte Sportart.", () => void saveSportContact())
                }
              >
                <Text style={[styles.primaryText, { color: theme.inverse }]}>Ansprechpartner setzen</Text>
              </Pressable>
              {sports.map((sport) => (
                <View key={sport.id} style={[styles.memberCard, { borderTopColor: theme.border }]}>
                  <Text style={[styles.name, { color: theme.text }]}>{sport.name}</Text>
                  {(contactsBySport.get(sport.id) ?? []).length === 0 ? <Text style={[styles.muted, { color: theme.muted }]}>Noch kein Ansprechpartner</Text> : null}
                  {(contactsBySport.get(sport.id) ?? []).map((contact) => (
                    <View key={contact.id} style={styles.contactRow}>
                      <View style={styles.memberText}>
                        <Text style={[styles.muted, { color: theme.text }]}>
                          {contact.displayName} {contact.is_primary ? "· primär" : ""}
                        </Text>
                        {contact.note ? <Text style={[styles.muted, { color: theme.muted }]}>{contact.note}</Text> : null}
                      </View>
                      <Pressable
                        style={[styles.roleButton, styles.dangerButton]}
                        onPress={() => confirmAdminAction("Ansprechpartner entfernen?", `${contact.displayName} wird für ${sport.name} entfernt.`, () => void removeSportContact(contact))}
                      >
                        <Text style={styles.dangerText}>Entfernen</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {isAdmin && activeSection === "sports" ? (
            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Sportarten verwalten</Text>
              <View style={styles.formGrid}>
                <AdminInput value={sportDraft.name} onChangeText={(name) => setSportDraft((draft) => ({ ...draft, name }))} placeholder="Name" />
                <AdminInput value={sportDraft.description} onChangeText={(description) => setSportDraft((draft) => ({ ...draft, description }))} placeholder="Beschreibung" multiline />
                <AdminInput
                  value={sportDraft.locationDescription}
                  onChangeText={(locationDescription) => setSportDraft((draft) => ({ ...draft, locationDescription }))}
                  placeholder="Bestmögliche Standortbeschreibung"
                  multiline
                />
                <AdminInput value={sportDraft.category} onChangeText={(category) => setSportDraft((draft) => ({ ...draft, category }))} placeholder="Kategorie" />
                <AdminInput
                  value={sportDraft.combinableTags}
                  onChangeText={(combinableTags) => setSportDraft((draft) => ({ ...draft, combinableTags }))}
                  placeholder="Tags, getrennt mit Komma"
                />
              </View>
              <ChipGroup label="Schwierigkeit" options={intensityOptions} selected={sportDraft.intensityLevel} onSelect={(intensityLevel) => setSportDraft((draft) => ({ ...draft, intensityLevel }))} />
              <ChipGroup label="Art" options={locationOptions} selected={sportDraft.locationType} onSelect={(locationType) => setSportDraft((draft) => ({ ...draft, locationType }))} />
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
                    {sport.description ? <Text style={[styles.muted, { color: theme.muted }]}>{sport.description}</Text> : null}
                    {sport.location_description ? <Text style={[styles.muted, { color: theme.accent }]}>Standort: {sport.location_description}</Text> : null}
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
          ) : null}

          {isAdmin && activeSection === "members" ? (
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
                        onPress={() => confirmAdminAction("Rechte ändern?", `${member.displayName} wird auf ${roleLabel(role)} gesetzt.`, () => void changeRole(member, role))}
                      >
                        <Text style={[styles.roleText, { color: member.role === role ? theme.inverse : theme.text }]}>{roleLabel(role)}</Text>
                      </Pressable>
                    ))}
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
          ) : null}

          {isAdmin && activeSection === "nameRequests" ? (
            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Namensanfragen</Text>
              {nameRequests.length === 0 ? <Text style={[styles.muted, { color: theme.muted }]}>Keine offenen Anfragen.</Text> : null}
              {nameRequests.map((request) => {
                const member = members.find((entry) => entry.userId === request.user_id);
                return (
                  <View key={request.id} style={[styles.memberCard, { borderTopColor: theme.border }]}>
                    <View>
                      <Text style={[styles.name, { color: theme.text }]}>{member?.displayName ?? "Mitglied"}</Text>
                      <Text style={[styles.muted, { color: theme.muted }]}>möchte heißen: {request.requested_display_name}</Text>
                    </View>
                    <View style={styles.roleRow}>
                      <Pressable
                        style={[styles.roleButton, { backgroundColor: theme.button }]}
                        onPress={() =>
                          confirmAdminAction("Namen freigeben?", `${member?.displayName ?? "Mitglied"} wird zu ${request.requested_display_name}.`, () =>
                            void reviewNameRequest(request, "approved"),
                          )
                        }
                      >
                        <Text style={[styles.roleText, { color: theme.inverse }]}>Freigeben</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.roleButton, styles.dangerButton]}
                        onPress={() =>
                          confirmAdminAction("Namensanfrage ablehnen?", `Die Anfrage für ${request.requested_display_name} wird abgelehnt.`, () => void reviewNameRequest(request, "rejected"))
                        }
                      >
                        <Text style={styles.dangerText}>Ablehnen</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function AdminInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return <TextInput placeholderTextColor={theme.muted} style={[styles.input, props.multiline && styles.textArea, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]} {...props} />;
}

function AdminMenuCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.menuCard, { borderColor: theme.border, backgroundColor: theme.softSurface }, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.memberText}>
        <Text style={[styles.name, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.muted, { color: theme.muted }]}>{body}</Text>
      </View>
      <Text style={[styles.itemArrow, { color: theme.muted }]}>›</Text>
    </Pressable>
  );
}

function PickerGroup({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: Array<{ id: string; label: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.chipGroup}>
      <Text style={[styles.muted, { color: theme.muted }]}>{label}</Text>
      <View style={styles.roleRow}>
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <Pressable key={item.id} style={[styles.roleButton, { backgroundColor: active ? theme.button : theme.surface }]} onPress={() => onSelect(item.id)}>
              <Text style={[styles.roleText, { color: active ? theme.inverse : theme.text }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function sectionTitle(section: AdminSection): string {
  if (section === "contacts") return "Sport-APs";
  if (section === "sports") return "Sportarten";
  if (section === "members") return "Mitglieder";
  if (section === "nameRequests") return "Namensanfragen";
  return "Club steuern";
}

function isAdminSection(value: string): value is AdminSection {
  return value === "overview" || value === "contacts" || value === "sports" || value === "members" || value === "nameRequests";
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
              <Text style={[styles.roleText, { color: active ? theme.inverse : theme.text }]}>{isIntensity(option) ? intensityLabel(option) : locationLabel(option)}</Text>
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
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 22 },
  muted: { fontSize: 13, lineHeight: 19 },
  adminGrid: { gap: 10 },
  menuCard: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  itemArrow: { fontSize: 24, fontWeight: "700", lineHeight: 26 },
  formGrid: { gap: 10 },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    outlineStyle: "none",
  } as object,
  textArea: { minHeight: 82, textAlignVertical: "top" },
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
  contactRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
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
  pressed: { opacity: 0.82 },
});
