import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { SearchField } from "../src/components/FormControls";
import { PageHeader } from "../src/components/PageHeader";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { getMccEventState, getOrCreateDirectChat, listMccMembers, type MccMember } from "../src/services";

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
  const [locationFilterOpen, setLocationFilterOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState("Konstanz");
  const [memberSearch, setMemberSearch] = useState("");
  const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const cityOptions = useMemo(() => {
    const cities = [...new Set(members.map((member) => member.city).filter((city): city is string => Boolean(city)))].sort((a, b) => a.localeCompare(b));
    return ["Alle", "Konstanz", ...cities.filter((city) => city !== "Konstanz")];
  }, [members]);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const cityMatches = selectedCity === "Alle" || (member.city ?? "Stadt noch offen") === selectedCity;
      const searchMatches = !query || [member.displayName, member.city, member.favoriteSports, member.contactSports.join(" ")].filter(Boolean).join(" ").toLowerCase().includes(query);
      return cityMatches && searchMatches;
    });
  }, [memberSearch, members, selectedCity]);

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

  async function contactAdmin(member: MccMember) {
    if (!user || member.role !== "admin" || member.userId === user.id) return;
    setStartingChatUserId(member.userId);
    const result = await getOrCreateDirectChat(supabase, { requesterId: user.id, adminId: member.userId });
    setStartingChatUserId(null);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    router.push(`/chat?directChatId=${result.data.id}`);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PageHeader
            title="Mitglieder"
            titleMeta={`${filteredMembers.length}`}
            showBack={false}
            showTheme
            actions={<HeaderIconButton label={locationFilterOpen ? "×" : "!"} open={locationFilterOpen} onPress={() => setLocationFilterOpen((open) => !open)} />}
          />
          {message ? <Text style={styles.notice}>{message}</Text> : null}
          <SearchField value={memberSearch} onChangeText={setMemberSearch} placeholder="Mitglied oder Sportart suchen" />
          {filteredMembers.length === 0 ? <Text style={[styles.detail, { color: theme.muted }]}>Keine Mitglieder für diesen Filter.</Text> : null}
          {filteredMembers.map((member) => {
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
                    <ProfileLine label="Ansprechpartner" value={member.contactSports.length > 0 ? member.contactSports.join(", ") : "Kein Sportprofil"} />
                    <ProfileLine label="Ideen" value={`${member.stats.ideasSuggested}`} />
                    <ProfileLine label="Teilnahmen" value={`${member.stats.plannedAttendances} geplant, ${member.stats.actualAttendances} bestätigt`} />
                    <ProfileLine label="Verlässlichkeit" value={member.stats.reliabilityPercent === null ? "Noch offen" : `${member.stats.reliabilityPercent}% (${member.stats.noShows} No-Shows)`} />
                    {member.role === "admin" && member.userId !== user.id ? (
                      <Pressable style={[styles.contactAdminButton, { backgroundColor: theme.button }]} onPress={() => void contactAdmin(member)} disabled={startingChatUserId === member.userId}>
                        <Text style={[styles.contactAdminText, { color: theme.inverse }]}>{startingChatUserId === member.userId ? "Öffne Chat..." : "Admin kontaktieren"}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        {locationFilterOpen ? (
          <View style={[styles.filterPanel, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
            <Text style={[styles.filterPanelTitle, { color: theme.text }]}>Standortfilter</Text>
            {cityOptions.map((city) => {
              const active = selectedCity === city;
              const cityMembers = membersForCity(members, city);
              const preview = cityMembers.slice(0, 3).map((member) => member.displayName).join(", ");
              return (
                <Pressable
                  key={city}
                  style={[styles.filterRow, { backgroundColor: active ? theme.button : theme.surface }]}
                  onPress={() => {
                    setSelectedCity(city);
                    setLocationFilterOpen(false);
                  }}
                >
                  <View style={styles.filterRowText}>
                    <Text style={[styles.filterCity, { color: active ? theme.inverse : theme.text }]}>{city}</Text>
                    <Text style={[styles.filterPreview, { color: active ? theme.inverse : theme.muted }]} numberOfLines={1}>
                      {preview || "Noch keine Mitglieder"}
                    </Text>
                  </View>
                  <Text style={[styles.filterCount, { color: active ? theme.inverse : theme.muted }]}>{cityMembers.length}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <BottomNav active="members" />
      </View>
    </SafeAreaView>
  );
}

function HeaderIconButton({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={[styles.headerIconButton, { borderColor: open ? theme.accent : theme.border, backgroundColor: theme.softSurface }]} onPress={onPress}>
      <Text style={[styles.headerIconText, { color: open ? theme.accent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function membersForCity(members: MccMember[], city: string): MccMember[] {
  if (city === "Alle") return members;
  return members.filter((member) => (member.city ?? "Stadt noch offen") === city);
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
  headerIconButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
    position: "relative",
  },
  headerIconText: { fontSize: 18, fontWeight: "900", lineHeight: 20 },
  filterPanel: { borderRadius: 22, borderWidth: 1, gap: 8, maxWidth: 360, padding: 10, position: "absolute", right: 16, top: 72, width: "82%", zIndex: 20 },
  filterPanelTitle: { fontSize: 13, fontWeight: "900", paddingHorizontal: 4 },
  filterRow: { alignItems: "center", borderRadius: 16, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  filterRowText: { flex: 1, minWidth: 0, gap: 2 },
  filterCity: { fontSize: 14, fontWeight: "900" },
  filterPreview: { fontSize: 12, fontWeight: "700" },
  filterCount: { fontSize: 13, fontWeight: "900" },
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
  contactAdminButton: { alignItems: "center", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 },
  contactAdminText: { fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.84 },
});
