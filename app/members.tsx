import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { SearchField } from "../src/components/FormControls";
import { MccBadge, MccScreen, ScreenLoader } from "../src/components/MccDesign";
import { MainHeader } from "../src/components/PageHeader";
import { Reveal } from "../src/components/Motion";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { readLocalCache, writeLocalCache } from "../src/services/localCache";
import { bootstrapMccWeek, getOrCreateDirectChat, listMccMembers, type MccMember } from "../src/services";

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
  const [selectedCity, setSelectedCity] = useState("Alle");
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
      const searchMatches = !query || [member.displayName, member.city, member.phone, roleLabels[member.role]].filter(Boolean).join(" ").toLowerCase().includes(query);
      return cityMatches && searchMatches;
    });
  }, [memberSearch, members, selectedCity]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const cacheKey = `mcc.members.${user.id}`;
      const cached = await readLocalCache<MccMember[]>(cacheKey, 15 * 60 * 1000);
      if (cached) setMembers((current) => (current.length ? current : cached));
      const boot = await bootstrapMccWeek(supabase);
      if (boot.error) {
        if (!cached) setMessage(boot.error.message);
        return;
      }
      const result = await listMccMembers(supabase, { clubId: boot.data.clubId });
      if (result.error) {
        if (!cached) setMessage(result.error.message);
        return;
      }
      setMembers(result.data);
      void writeLocalCache(cacheKey, result.data);
    }

    void load();
  }, [user]);

  if (loading)
    return (
      <MccScreen>
        <ScreenLoader />
      </MccScreen>
    );
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
    <View style={styles.shell}>
      <MccScreen bottomInset={96}>
        <MainHeader title="Mitglieder" actions={<HeaderIconButton open={locationFilterOpen} onPress={() => setLocationFilterOpen((open) => !open)} />} />
        <View style={styles.toolRow}>
          <Pressable accessibilityRole="button" onPress={() => setLocationFilterOpen((open) => !open)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <MccBadge icon="map-marker-outline" tone="accent">
              {selectedCity}
            </MccBadge>
          </Pressable>
          <MccBadge tone="neutral" icon="account-group-outline">{`${filteredMembers.length} Profile`}</MccBadge>
        </View>
        {message ? <Text style={[styles.notice, { color: theme.mcc.danger }]}>{message}</Text> : null}
        <SearchField value={memberSearch} onChangeText={setMemberSearch} placeholder="Mitglied, Stadt oder Rolle suchen" />
        {filteredMembers.length === 0 ? <Text style={[styles.detail, { color: theme.mcc.textSecondary }]}>Keine Mitglieder für diesen Filter.</Text> : null}
        {filteredMembers.map((member, memberIndex) => {
          const opened = openedUserId === member.userId;
          return (
            <Reveal key={member.userId} index={memberIndex}>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: opened ? theme.mcc.strongLine : theme.mcc.line,
                  backgroundColor: opened ? theme.mcc.surfaceRaised : theme.mcc.surface,
                  shadowColor: theme.mcc.shadow,
                },
                pressed && styles.pressed,
              ]}
              onPress={() => setOpenedUserId(opened ? null : member.userId)}
            >
              <View style={styles.previewRow}>
                <View style={styles.memberText}>
                  <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{member.displayName}</Text>
                  <Text style={[styles.detail, { color: theme.mcc.textSecondary }]}>{member.city ?? "Stadt noch offen"}</Text>
                </View>
                <View style={styles.badges}>
                  {member.role === "admin" && member.userId !== user.id ? (
                    <Pressable style={[styles.badgeStrong, { backgroundColor: theme.mcc.accentDeep }]} onPress={() => void contactAdmin(member)} disabled={startingChatUserId === member.userId}>
                      <Text style={styles.badgeStrongText}>{startingChatUserId === member.userId ? "..." : "Kontakt"}</Text>
                    </Pressable>
                  ) : null}
                  <Text style={[styles.badge, { backgroundColor: theme.mcc.surfaceSoft, borderColor: theme.mcc.line, color: theme.mcc.textPrimary }]}>{roleLabels[member.role]}</Text>
                </View>
              </View>
              {opened ? (
                <View style={[styles.detailPanel, { borderTopColor: theme.mcc.line }]}>
                  <ProfileLine label="Beigetreten" value={formatJoinedAt(member.joinedAt)} />
                  <ProfileLine label="Rolle" value={roleLabels[member.role]} />
                  <ProfileLine label="Lieblingssportarten" value={member.favoriteSports ?? "Noch offen"} />
                  <ProfileLine label="Alter" value={member.birthDate ? formatAge(member.birthDate) : "Noch offen"} />
                  <ProfileLine label="Sportprofil-Kontakt" value={formatContactSports(member.contactSports)} />
                  <ProfileLine label="Ideen" value={`${member.stats.ideasSuggested}`} />
                  <ProfileLine label="Teilnahmen" value={`${member.stats.plannedAttendances} geplant, ${member.stats.actualAttendances} bestätigt`} />
                  <ProfileLine label="Verlässlichkeit" value={member.stats.reliabilityPercent === null ? "Noch offen" : `${member.stats.reliabilityPercent}% (${member.stats.noShows} No-Shows)`} />
                  {member.role === "admin" && member.userId !== user.id ? (
                    <Pressable style={[styles.contactAdminButton, { backgroundColor: theme.mcc.accentDeep }]} onPress={() => void contactAdmin(member)} disabled={startingChatUserId === member.userId}>
                      <Text style={styles.contactAdminText}>{startingChatUserId === member.userId ? "Öffne Chat..." : "Admin kontaktieren"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
            </Reveal>
          );
        })}
      </MccScreen>
      {locationFilterOpen ? (
        <View style={[styles.filterPanel, { borderColor: theme.mcc.strongLine, backgroundColor: theme.mcc.surfaceRaised, shadowColor: theme.mcc.shadow }]}>
          <Text style={[styles.filterPanelTitle, { color: theme.mcc.textPrimary }]}>Standortfilter</Text>
          {cityOptions.map((city) => {
            const active = selectedCity === city;
            const cityMembers = membersForCity(members, city);
            return (
              <Pressable
                key={city}
                style={[styles.filterRow, { backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surfaceSoft }]}
                onPress={() => {
                  setSelectedCity(city);
                  setLocationFilterOpen(false);
                }}
              >
                <View style={styles.filterRowText}>
                  <Text style={[styles.filterCity, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{city}</Text>
                  <Text style={[styles.filterPreview, { color: active ? "#FFFFFF" : theme.mcc.textSecondary }]} numberOfLines={1}>
                    {cityMembers.length === 1 ? "1 Mitglied" : `${cityMembers.length} Mitglieder`}
                  </Text>
                </View>
                <Text style={[styles.filterCount, { color: active ? "#FFFFFF" : theme.mcc.textSecondary }]}>{cityMembers.length}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <BottomNav active="members" />
    </View>
  );
}

function HeaderIconButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={[styles.headerIconButton, { borderColor: open ? theme.mcc.accent : theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} onPress={onPress}>
      <MaterialCommunityIcons name={open ? "close" : "filter-variant"} size={22} color={open ? theme.mcc.accent : theme.mcc.textPrimary} />
    </Pressable>
  );
}

function membersForCity(members: MccMember[], city: string): MccMember[] {
  if (city === "Alle") return members;
  return members.filter((member) => (member.city ?? "Stadt noch offen") === city);
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.profileLine}>
      <Text style={[styles.profileLabel, { color: theme.mcc.textMuted }]}>{label}</Text>
      <Text style={[styles.profileValue, { color: theme.mcc.textPrimary }]}>{value}</Text>
    </View>
  );
}

function formatContactSports(labels: string[]): string {
  if (labels.length === 0) return "Kein Sportprofil";
  const visible = labels.slice(0, 4);
  const rest = labels.length - visible.length;
  return rest > 0 ? `${visible.join(", ")} + ${rest} weitere` : visible.join(", ");
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
  shell: { flex: 1 },
  toolRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  notice: { fontSize: 14, fontWeight: "800" },
  headerIconButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    position: "relative",
    width: 42,
  },
  filterPanel: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    maxWidth: 360,
    padding: 10,
    position: "absolute",
    right: 16,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    top: 96,
    width: "82%",
    zIndex: 20,
  },
  filterPanelTitle: { fontSize: 13, fontWeight: "900", paddingHorizontal: 4 },
  filterRow: { alignItems: "center", borderRadius: 16, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  filterRowText: { flex: 1, gap: 2, minWidth: 0 },
  filterCity: { fontSize: 14, fontWeight: "900" },
  filterPreview: { fontSize: 12, fontWeight: "700" },
  filterCount: { fontSize: 13, fontWeight: "900" },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  previewRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  memberText: { flex: 1, gap: 3, minWidth: 0 },
  name: { fontSize: 18, fontWeight: "900" },
  detail: { fontSize: 14, lineHeight: 20 },
  badges: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeStrong: {
    alignItems: "center",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeStrongText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  detailPanel: { borderTopWidth: 1, gap: 9, paddingTop: 11 },
  profileLine: { gap: 2 },
  profileLabel: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  profileValue: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  contactAdminButton: { alignItems: "center", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 },
  contactAdminText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.84 },
});
