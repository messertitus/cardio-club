import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { MapLocationPicker, SearchField } from "../src/components/FormControls";
import { MapRouteButton } from "../src/components/MapRouteButton";
import { MccBadge, MccBody, MccCardTitle, MotionBackground, ScreenLoader } from "../src/components/MccDesign";
import { PageHeader } from "../src/components/PageHeader";
import { SPORT_ICON_OPTIONS, SportIconBadge } from "../src/components/SportIcon";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { WEEKDAY_LABELS, WEEKDAY_ORDER, type EventDay } from "../src/services/date";
import {
  deactivateMccMember,
  deleteSportProfile,
  deleteMccSport,
  getMccEventDays,
  getMccEventState,
  isCurrentUserAdmin,
  isValidTime,
  listMemberCities,
  setActiveCities,
  setMccEventDays,
  listInvitationTree,
  listMccMembers,
  listMccSports,
  listSportProfileSportLinks,
  listProfileNameChangeRequests,
  listSportProfiles,
  reviewProfileNameChangeRequest,
  setMccSportActive,
  setSportProfileActive,
  updateMccMemberDisplayName,
  updateMccMemberRole,
  upsertMccSport,
  upsertSportProfile,
  type ClubMemberRole,
  type MemberCity,
  type InvitationTreeEntry,
  type MccEventState,
  type MccMember,
  type ApRequirementLevel,
  type Row,
  type SportIntensityLevel,
  type SportLocationType,
} from "../src/services";

const roles: ClubMemberRole[] = ["member", "mod", "admin"];
const intensityOptions: SportIntensityLevel[] = ["low", "medium", "high"];
const locationOptions: SportLocationType[] = ["indoor", "outdoor", "water", "field", "flexible"];
const apRequirementOptions: ApRequirementLevel[] = ["none", "required", "critical"];
const defaultSportCategoryOptions = [
  "ballsport",
  "ausdauer",
  "kraftsport",
  "kampfsport",
  "wassersport",
  "wintersport",
  "rueckschlagspiel",
  "teamsport",
  "individualsport",
  "tanz",
  "fitness",
  "mobility",
  "unbekannt",
];

type AdminSection = "overview" | "sports" | "profiles" | "members" | "inviteTree" | "nameRequests" | "schedule" | "cities";

type DayRow = { weekday: EventDay; enabled: boolean; time: string };

function defaultDayRows(): DayRow[] {
  return WEEKDAY_ORDER.map((weekday) => ({ weekday, enabled: false, time: weekday === "sunday" ? "15:00" : "14:00" }));
}
type PendingConfirm = { title: string; detail: string; onConfirm: () => void } | null;
type InvitationTreeNode = {
  id: string;
  label: string;
  meta: string;
  accent?: string | null;
  children: InvitationTreeNode[];
};

type SportDraft = {
  name: string;
  description: string;
  category: string;
  iconName: string;
  intensityLevel: SportIntensityLevel;
  isActive: boolean;
};

const emptySportDraft: SportDraft = {
  name: "",
  description: "",
  category: "unbekannt",
  iconName: "",
  intensityLevel: "medium",
  isActive: true,
};

type ProfileDraft = {
  sportIds: string[];
  name: string;
  locationName: string;
  mapUrl: string;
  postalCode: string;
  locationCity: string;
  latitude: string;
  longitude: string;
  locationType: SportLocationType;
  minimumGroupSize: string;
  maximumGroupSize: string;
  requiredEquipment: string;
  availableEquipment: string;
  costRequired: boolean;
  costPerPerson: string;
  costCurrency: string;
  costNote: string;
  openingNotes: string;
  transitNotes: string;
  amenityNotes: string;
  safetyNotes: string;
  locationRules: string;
  apRequired: boolean;
  apRequirementLevel: ApRequirementLevel;
  apContactId: string;
  reservationRequired: boolean;
  lightingAvailable: boolean;
  requiresDry: boolean;
  rainSensitive: boolean;
  heatSensitive: boolean;
  coldSensitive: boolean;
  thunderstormUnsafe: boolean;
  windSensitive: boolean;
  maxPrecipitationMm: string;
  maxWindKmh: string;
  minTemperatureC: string;
  maxTemperatureC: string;
};

const emptyProfileDraft: ProfileDraft = {
  sportIds: [],
  name: "",
  locationName: "",
  mapUrl: "",
  postalCode: "",
  locationCity: "",
  latitude: "",
  longitude: "",
  locationType: "flexible",
  minimumGroupSize: "",
  maximumGroupSize: "",
  requiredEquipment: "",
  availableEquipment: "",
  costRequired: false,
  costPerPerson: "",
  costCurrency: "EUR",
  costNote: "",
  openingNotes: "",
  transitNotes: "",
  amenityNotes: "",
  safetyNotes: "",
  locationRules: "",
  apRequired: false,
  apRequirementLevel: "none",
  apContactId: "",
  reservationRequired: false,
  lightingAvailable: false,
  requiresDry: false,
  rainSensitive: false,
  heatSensitive: false,
  coldSensitive: false,
  thunderstormUnsafe: true,
  windSensitive: false,
  maxPrecipitationMm: "",
  maxWindKmh: "",
  minTemperatureC: "",
  maxTemperatureC: "",
};

export default function AdminScreen() {
  const params = useLocalSearchParams<{ section?: string }>();
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [members, setMembers] = useState<MccMember[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [sportProfileLinks, setSportProfileLinks] = useState<Row<"sport_profile_sports">[]>([]);
  const [invitationTree, setInvitationTree] = useState<InvitationTreeEntry[]>([]);
  const [nameRequests, setNameRequests] = useState<Row<"profile_change_requests">[]>([]);
  const [sportDraft, setSportDraft] = useState<SportDraft>(emptySportDraft);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfileDraft);
  const [editingSportId, setEditingSportId] = useState<string | null>(null);
  const [customCategoryOpen, setCustomCategoryOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileCostOpen, setProfileCostOpen] = useState(false);
  const [profileSearch, setProfileSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [editingMemberNameId, setEditingMemberNameId] = useState<string | null>(null);
  const [memberNameDraft, setMemberNameDraft] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [eventDays, setEventDays] = useState<DayRow[]>(() => defaultDayRows());
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [memberCities, setMemberCities] = useState<MemberCity[]>([]);
  const [activeCitySet, setActiveCitySet] = useState<Set<string>>(new Set());
  const [citiesBusy, setCitiesBusy] = useState(false);

  const profilesBySport = useMemo(() => {
    const query = profileSearch.trim().toLowerCase();
    const map = new Map<string, Row<"sport_profiles">[]>();
    for (const profile of sportProfiles) {
      const linkedSportIds = sportIdsForProfile(profile, sportProfileLinks);
      const sportNames = linkedSportIds.map((sportId) => sports.find((entry) => entry.id === sportId)?.name).filter(Boolean);
      const haystack = [profile.name, profile.location_name, profile.location_city, profile.postal_code, ...sportNames].filter(Boolean).join(" ").toLowerCase();
      if (query && !haystack.includes(query)) continue;
      for (const sportId of linkedSportIds) {
        const next = map.get(sportId) ?? [];
        next.push(profile);
        map.set(sportId, next);
      }
    }
    return map;
  }, [profileSearch, sportProfileLinks, sportProfiles, sports]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => [member.displayName, member.city, member.phone, roleLabel(member.role)].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [memberSearch, members]);

  const invitationRoots = useMemo(() => buildInvitationTree(invitationTree), [invitationTree]);
  const sportCategoryOptions = useMemo(
    () => [...new Set([...defaultSportCategoryOptions, ...sports.map((sport) => sport.category).filter(Boolean)])],
    [sports],
  );

  useEffect(() => {
    if (profileDraft.costRequired || profileDraft.costNote.trim() || profileDraft.costPerPerson.trim()) setProfileCostOpen(true);
  }, [profileDraft.costNote, profileDraft.costPerPerson, profileDraft.costRequired]);

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

    const [membersResult, sportsResult, profilesResult, profileLinksResult, invitationTreeResult, nameRequestsResult] = await Promise.all([
      listMccMembers(supabase, {
        clubId: eventResult.data.clubId,
        bypassCache: true,
      }),
      listMccSports(supabase),
      listSportProfiles(supabase),
      listSportProfileSportLinks(supabase),
      listInvitationTree(supabase),
      listProfileNameChangeRequests(supabase),
    ]);
    setBusy(false);

    if (membersResult.error || sportsResult.error || profilesResult.error || profileLinksResult.error || invitationTreeResult.error || nameRequestsResult.error) {
      setMessage(
        membersResult.error?.message ??
          sportsResult.error?.message ??
          profilesResult.error?.message ??
          profileLinksResult.error?.message ??
          invitationTreeResult.error?.message ??
          nameRequestsResult.error?.message ??
          "Adminbereich konnte nicht geladen werden.",
      );
      return;
    }

    setMessage(null);
    setMembers(membersResult.data);
    setSports(sportsResult.data);
    setSportProfiles(profilesResult.data);
    setSportProfileLinks(profileLinksResult.data);
    setInvitationTree(invitationTreeResult.data);
    setNameRequests(nameRequestsResult.data);
    setProfileDraft((current) => ({
      ...current,
      sportIds: current.sportIds.length > 0 ? current.sportIds : sportsResult.data[0]?.id ? [sportsResult.data[0].id] : [],
    }));

    const daysResult = await getMccEventDays(supabase, eventResult.data.clubId);
    if (daysResult.data) {
      const byWeekday = new Map(daysResult.data.map((entry) => [entry.weekday, entry.time]));
      setEventDays(defaultDayRows().map((row) => (byWeekday.has(row.weekday) ? { ...row, enabled: true, time: byWeekday.get(row.weekday) ?? row.time } : row)));
    }

    const citiesResult = await listMemberCities(supabase);
    if (citiesResult.data) {
      setMemberCities(citiesResult.data);
      setActiveCitySet(new Set(citiesResult.data.filter((entry) => entry.active).map((entry) => entry.city)));
    }
  }

  function toggleActiveCity(cityName: string) {
    setActiveCitySet((current) => {
      const next = new Set(current);
      if (next.has(cityName)) next.delete(cityName);
      else next.add(cityName);
      return next;
    });
  }

  async function saveActiveCities() {
    setCitiesBusy(true);
    const result = await setActiveCities(supabase, [...activeCitySet]);
    setCitiesBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMemberCities((current) => current.map((entry) => ({ ...entry, active: activeCitySet.has(entry.city) })));
    setMessage("Aktive Städte gespeichert. Events werden ab der nächsten Bereitstellung pro aktiver Stadt erzeugt.");
  }

  function toggleEventDay(weekday: EventDay) {
    setEventDays((current) => current.map((row) => (row.weekday === weekday ? { ...row, enabled: !row.enabled } : row)));
  }

  function setEventDayTime(weekday: EventDay, time: string) {
    const sanitized = time.replace(/[^\d:]/g, "").slice(0, 5);
    setEventDays((current) => current.map((row) => (row.weekday === weekday ? { ...row, time: sanitized } : row)));
  }

  async function saveEventDays() {
    const enabled = eventDays.filter((row) => row.enabled);
    if (enabled.some((row) => !isValidTime(row.time))) {
      setMessage("Bitte gültige Uhrzeiten im Format HH:MM eingeben.");
      return;
    }
    setScheduleBusy(true);
    const result = await setMccEventDays(supabase, enabled.map((row) => ({ weekday: row.weekday, time: row.time })));
    setScheduleBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage("Eventtage gespeichert. Sie gelten ab der nächsten Bereitstellung.");
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
    setPendingConfirm({ title, detail, onConfirm });
  }

  function runConfirmedAction() {
    const action = pendingConfirm?.onConfirm;
    setPendingConfirm(null);
    action?.();
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
      category: sport.category,
      iconName: sport.icon_name ?? "",
      intensityLevel: sport.intensity_level,
      isActive: sport.is_active,
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
      category: sportDraft.category,
      iconName: sportDraft.iconName,
      intensityLevel: sportDraft.intensityLevel,
      combinableTags: [],
      isActive: sportDraft.isActive,
    });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    resetSportDraft();
    await load();
  }

  function editProfile(profile: Row<"sport_profiles">) {
    setEditingProfileId(profile.id);
    setProfileCostOpen(Boolean(profile.cost_required || profile.cost_note || profile.cost_per_person));
    setProfileDraft({
      sportIds: sportIdsForProfile(profile, sportProfileLinks),
      name: profile.name,
      locationName: profile.location_name ?? "",
      mapUrl: profile.map_url ?? "",
      postalCode: profile.postal_code ?? "",
      locationCity: profile.location_city ?? "",
      latitude: profile.latitude?.toString() ?? "",
      longitude: profile.longitude?.toString() ?? "",
      locationType: profile.location_type,
      minimumGroupSize: String(profile.minimum_participants ?? profile.minimum_group_size),
      maximumGroupSize: (profile.maximum_participants ?? profile.maximum_group_size)?.toString() ?? "",
      requiredEquipment: (profile.required_equipment ?? []).join(", "),
      availableEquipment: (profile.available_equipment ?? []).join(", "),
      costRequired: Boolean(profile.cost_required),
      costPerPerson: formatOptionalNumber(profile.cost_per_person),
      costCurrency: profile.cost_currency ?? "EUR",
      costNote: profile.cost_note ?? "",
      openingNotes: profile.opening_notes ?? "",
      transitNotes: profile.transit_notes ?? "",
      amenityNotes: profile.amenity_notes ?? "",
      safetyNotes: profile.safety_notes ?? "",
      locationRules: profile.location_rules ?? "",
      apRequired: profile.ap_required,
      apRequirementLevel: profile.ap_requirement_level ?? (profile.ap_required ? "required" : "none"),
      apContactId: profile.ap_contact_id ?? "",
      reservationRequired: Boolean(profile.reservation_required),
      lightingAvailable: Boolean(profile.lighting_available),
      requiresDry: weatherRuleBoolean(profile.weather_rules, "requiresDry"),
      rainSensitive: weatherRuleBoolean(profile.weather_rules, "rainSensitive"),
      heatSensitive: weatherRuleBoolean(profile.weather_rules, "heatSensitive"),
      coldSensitive: weatherRuleBoolean(profile.weather_rules, "coldSensitive"),
      thunderstormUnsafe: weatherRuleBoolean(profile.weather_rules, "thunderstormUnsafe", true),
      windSensitive: weatherRuleBoolean(profile.weather_rules, "windSensitive"),
      maxPrecipitationMm: formatOptionalNumber(weatherRuleNumber(profile.weather_rules, "maxPrecipitationMm")),
      maxWindKmh: formatOptionalNumber(weatherRuleNumber(profile.weather_rules, "maxWindKmh")),
      minTemperatureC: formatOptionalNumber(weatherRuleNumber(profile.weather_rules, "minTemperatureC")),
      maxTemperatureC: formatOptionalNumber(weatherRuleNumber(profile.weather_rules, "maxTemperatureC")),
    });
  }

  function resetProfileDraft() {
    setEditingProfileId(null);
    setProfileCostOpen(false);
    setProfileDraft({ ...emptyProfileDraft, sportIds: sports[0]?.id ? [sports[0].id] : [] });
  }

  async function saveProfile() {
    if (!user) return;
    const validationMessage = validateProfileDraft(profileDraft);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    const minimumParticipants = parseOptionalNumber(profileDraft.minimumGroupSize);
    const maximumParticipants = parseOptionalNumber(profileDraft.maximumGroupSize);
    const costPerPerson = parseOptionalNumber(profileDraft.costPerPerson);
    const costRequired = profileCostOpen || profileDraft.costRequired;
    const apRequirementLevel = profileDraft.apRequirementLevel;

    const result = await upsertSportProfile(supabase, {
      profileId: editingProfileId,
      sportIds: profileDraft.sportIds,
      name: profileDraft.name,
      locationName: profileDraft.locationName,
      mapUrl: profileDraft.mapUrl,
      postalCode: profileDraft.postalCode,
      locationCity: profileDraft.locationCity,
      latitude: parseOptionalNumber(profileDraft.latitude),
      longitude: parseOptionalNumber(profileDraft.longitude),
      locationType: profileDraft.locationType,
      isIndoor: profileDraft.locationType === "indoor",
      minimumGroupSize: minimumParticipants,
      maximumGroupSize: maximumParticipants,
      minimumParticipants,
      maximumParticipants,
      requiredEquipment: parseCsv(profileDraft.requiredEquipment),
      availableEquipment: parseCsv(profileDraft.availableEquipment),
      costRequired,
      costPerPerson: costRequired ? costPerPerson : null,
      costCurrency: profileDraft.costCurrency.trim().toUpperCase() || "EUR",
      costNote: profileDraft.costNote,
      openingNotes: profileDraft.openingNotes,
      transitNotes: profileDraft.transitNotes,
      amenityNotes: profileDraft.amenityNotes,
      safetyNotes: profileDraft.safetyNotes,
      locationRules: profileDraft.locationRules,
      apRequired: apRequirementLevel !== "none",
      apRequirementLevel,
      apContactId: profileDraft.apContactId || null,
      reservationRequired: profileDraft.reservationRequired,
      lightingAvailable: profileDraft.lightingAvailable,
      weatherRules: {
        requiresDry: profileDraft.locationType === "indoor" ? false : profileDraft.requiresDry,
        rainSensitive: profileDraft.locationType === "indoor" ? false : profileDraft.rainSensitive,
        heatSensitive: profileDraft.locationType === "indoor" ? false : profileDraft.heatSensitive,
        coldSensitive: profileDraft.locationType === "indoor" ? false : profileDraft.coldSensitive,
        thunderstormUnsafe: profileDraft.locationType !== "indoor",
        windSensitive: profileDraft.locationType === "indoor" ? false : profileDraft.windSensitive,
        maxPrecipitationMm: parseOptionalNumber(profileDraft.maxPrecipitationMm) ?? undefined,
        maxWindKmh: parseOptionalNumber(profileDraft.maxWindKmh) ?? undefined,
        minTemperatureC: parseOptionalNumber(profileDraft.minTemperatureC) ?? undefined,
        maxTemperatureC: parseOptionalNumber(profileDraft.maxTemperatureC) ?? undefined,
      },
      createdBy: user.id,
    });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    resetProfileDraft();
    await load();
  }

  async function toggleProfileActive(profile: Row<"sport_profiles">) {
    const result = await setSportProfileActive(supabase, { profileId: profile.id, isActive: !profile.is_active });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  async function removeProfile(profile: Row<"sport_profiles">) {
    const result = await deleteSportProfile(supabase, profile.id);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (editingProfileId === profile.id) resetProfileDraft();
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

  async function toggleSportActive(sport: Row<"sports">) {
    const result = await setMccSportActive(supabase, { sportId: sport.id, isActive: !sport.is_active });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await load();
  }

  function startRenameMember(member: MccMember) {
    setEditingMemberNameId(member.userId);
    setMemberNameDraft(member.displayName);
  }

  async function saveMemberName(member: MccMember) {
    const result = await updateMccMemberDisplayName(supabase, { userId: member.userId, displayName: memberNameDraft });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setEditingMemberNameId(null);
    setMemberNameDraft("");
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

  if (loading) return <ScreenLoader />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      <View style={styles.shell}>
        <ScrollView style={styles.shell} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <PageHeader kicker="Admin" title={sectionTitle(activeSection)} onBack={activeSection === "overview" ? undefined : () => setActiveSection("overview")} />

          {message ? <Text style={styles.notice}>{message}</Text> : null}
          {busy ? <ScreenLoader /> : null}
          {!busy && !isAdmin ? <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>Dieser Bereich ist nur für Admins sichtbar.</Text> : null}

          {isAdmin && activeSection === "overview" ? (
            <View style={styles.adminGrid}>
              <AdminMenuCard title="Sportarten" body="Abstrakte Sportarten anlegen, ändern und löschen" onPress={() => setActiveSection("sports")} />
              <AdminMenuCard title="Sportprofile" body="Orte, Profilkontakte, Wetter und Gruppengrößen pflegen" onPress={() => setActiveSection("profiles")} />
              <AdminMenuCard title="Eventtage" body="Wochentage und Uhrzeiten der Cardiotage" onPress={() => setActiveSection("schedule")} />
              <AdminMenuCard title="Aktive Städte" body="In welchen Städten Events laufen" onPress={() => setActiveSection("cities")} />
              <AdminMenuCard title="Mitglieder" body="Rechte und Deaktivierung" onPress={() => setActiveSection("members")} />
              <AdminMenuCard title="Einladungsbaum" body="Sehen, wer wen eingeladen hat" onPress={() => setActiveSection("inviteTree")} />
              <AdminMenuCard title="Namensanfragen" body={`${nameRequests.length} offene Freigaben`} onPress={() => setActiveSection("nameRequests")} />
            </View>
          ) : null}

          {isAdmin && activeSection === "sports" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Sportarten verwalten</Text>
              <View style={styles.formGrid}>
                <AdminInput value={sportDraft.name} onChangeText={(name) => setSportDraft((draft) => ({ ...draft, name }))} placeholder="Name" />
                <AdminInput value={sportDraft.description} onChangeText={(description) => setSportDraft((draft) => ({ ...draft, description }))} placeholder="Beschreibung" multiline />
              </View>
              <PickerGroup
                label="Kategorie"
                items={sportCategoryOptions.map((category) => ({ id: category, label: categoryLabel(category) }))}
                selectedId={sportDraft.category}
                onSelect={(category) => setSportDraft((draft) => ({ ...draft, category }))}
              />
              <View style={styles.roleRow}>
                <Pressable style={[styles.roleButton, { backgroundColor: customCategoryOpen ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setCustomCategoryOpen((open) => !open)}>
                  <Text style={[styles.roleText, { color: customCategoryOpen ? "#FFFFFF" : theme.mcc.textPrimary }]}>+ Kategorie</Text>
                </Pressable>
                <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface }]} onPress={() => setIconPickerOpen(true)}>
                  <View style={styles.inlineIconLabel}>
                    <SportIconBadge sport={{ name: sportDraft.name, category: sportDraft.category, intensity_level: sportDraft.intensityLevel, icon_name: sportDraft.iconName }} size={28} />
                    <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Icon wählen</Text>
                  </View>
                </Pressable>
              </View>
              {customCategoryOpen ? (
                <AdminInput value={sportDraft.category} onChangeText={(category) => setSportDraft((draft) => ({ ...draft, category }))} placeholder="Neue Kategorie, z. B. Praezisionssport" />
              ) : null}
              <ChipGroup label="Schwierigkeit" options={intensityOptions} selected={sportDraft.intensityLevel} onSelect={(intensityLevel) => setSportDraft((draft) => ({ ...draft, intensityLevel }))} />
              <Pressable style={[styles.roleButton, { backgroundColor: sportDraft.isActive ? theme.mcc.accentDeep : theme.mcc.surface, alignSelf: "flex-start" }]} onPress={() => setSportDraft((draft) => ({ ...draft, isActive: !draft.isActive }))}>
                <Text style={[styles.roleText, { color: sportDraft.isActive ? "#FFFFFF" : theme.mcc.textPrimary }]}>{sportDraft.isActive ? "Sportart aktiv" : "Sportart inaktiv"}</Text>
              </Pressable>
              <View style={styles.roleRow}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: theme.mcc.accentDeep }]}
                  onPress={() =>
                    confirmAdminAction(
                      editingSportId ? "Sportart speichern?" : "Sportart anlegen?",
                      editingSportId ? `${sportDraft.name} wird geändert.` : `${sportDraft.name || "Neue Sportart"} wird hinzugefügt.`,
                      () => void saveSport(),
                    )
                  }
                >
                  <Text style={[styles.primaryText, { color: "#FFFFFF" }]}>{editingSportId ? "Speichern" : "Anlegen"}</Text>
                </Pressable>
                {editingSportId ? (
                  <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface }]} onPress={resetSportDraft}>
                    <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Abbrechen</Text>
                  </Pressable>
                ) : null}
              </View>

              {sports.map((sport) => (
                <View key={sport.id} style={[styles.memberCard, { borderTopColor: theme.mcc.line }]}>
                  <View style={styles.sportTitleRow}>
                    <SportIconBadge sport={sport} size={34} />
                    <View style={styles.memberText}>
                    <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{sport.name}</Text>
                    {sport.description ? <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{sport.description}</Text> : null}
                    <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                      {categoryLabel(sport.category)} · {intensityLabel(sport.intensity_level)} · {sport.is_active ? "aktiv" : "inaktiv"}
                    </Text>
                  </View>
                  </View>
                  <View style={styles.roleRow}>
                    <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface }]} onPress={() => editSport(sport)}>
                      <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Bearbeiten</Text>
                    </Pressable>
                    <Pressable style={[styles.roleButton, sport.is_active ? styles.dangerButton : { backgroundColor: theme.mcc.surface }]} onPress={() => void toggleSportActive(sport)}>
                      <Text style={sport.is_active ? styles.dangerText : [styles.roleText, { color: theme.mcc.textPrimary }]}>{sport.is_active ? "Deaktivieren" : "Aktivieren"}</Text>
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

          {isAdmin && activeSection === "profiles" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Sportprofile verwalten</Text>
              <ProfileDraftPreview draft={profileDraft} members={members} editing={Boolean(editingProfileId)} />

              <AdminSectionHeading label="Standort" body="Ort, PLZ und Karte entscheiden später über Wege, Wetter und Kapazität." />
              <View style={styles.formGrid}>
                <MapLocationPicker
                  label="Standort"
                  required
                  location={profileDraft.locationName}
                  mapUrl={profileDraft.mapUrl}
                  latitude={parseOptionalNumber(profileDraft.latitude)}
                  longitude={parseOptionalNumber(profileDraft.longitude)}
                  onLocationChange={(locationName) => setProfileDraft((draft) => ({ ...draft, locationName }))}
                  onMapUrlChange={(mapUrl) => setProfileDraft((draft) => ({ ...draft, mapUrl }))}
                  onCoordinatesChange={({ latitude, longitude }) => setProfileDraft((draft) => ({ ...draft, latitude: latitude?.toString() ?? "", longitude: longitude?.toString() ?? "" }))}
                />
                <AdminInput value={profileDraft.locationCity} onChangeText={(locationCity) => setProfileDraft((draft) => ({ ...draft, locationCity }))} placeholder="Stadt optional, z. B. Konstanz" />
                <AdminInput value={profileDraft.postalCode} onChangeText={(postalCode) => setProfileDraft((draft) => ({ ...draft, postalCode: postalCode.replace(/\D/g, '').slice(0, 5) }))} placeholder="PLZ für Outdoor-Wetter, z. B. 78462" keyboardType="number-pad" inputMode="numeric" />
                <AdminInput value={profileDraft.name} onChangeText={(name) => setProfileDraft((draft) => ({ ...draft, name }))} placeholder="Anzeigename, z. B. Beachvolleyball: Hörnle" />
              </View>

              <AdminSectionHeading label="Basis" body="Sportarten, Profilart und sichtbarer Name." />
              <MultiPickerGroup
                label="Sportarten"
                items={sports.map((sport) => ({ id: sport.id, label: sport.name, inactive: !sport.is_active }))}
                selectedIds={profileDraft.sportIds}
                onToggle={(sportId) =>
                  setProfileDraft((draft) => ({
                    ...draft,
                    sportIds: draft.sportIds.includes(sportId) ? draft.sportIds.filter((id) => id !== sportId) : [...draft.sportIds, sportId],
                  }))
                }
              />

              <ChipGroup label="Profilart" options={locationOptions} selected={profileDraft.locationType} onSelect={(locationType) => setProfileDraft((draft) => ({ ...draft, locationType }))} />

              <AdminSectionHeading label="Kapazität" body="Gruppengröße, Obergrenzen und passende Event-Zuordnung." />
              <View style={styles.formGrid}>
                <AdminInput value={profileDraft.minimumGroupSize} onChangeText={(minimumGroupSize) => setProfileDraft((draft) => ({ ...draft, minimumGroupSize: minimumGroupSize.replace(/\D/g, '') }))} placeholder="Standort-Minimum, z. B. 4" keyboardType="number-pad" inputMode="numeric" />
                <AdminInput value={profileDraft.maximumGroupSize} onChangeText={(maximumGroupSize) => setProfileDraft((draft) => ({ ...draft, maximumGroupSize: maximumGroupSize.replace(/\D/g, '') }))} placeholder="Standort-Maximum, z. B. 12" keyboardType="number-pad" inputMode="numeric" />
              </View>

              <AdminSectionHeading label="Wetter" body="Nur Outdoor-Profile brauchen Wettergrenzen oder Ortsdaten." />
              {profileDraft.locationType === "indoor" ? (
                <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Indoor: Regen, Wind und Temperatur werden für die Entscheidung kaum gewichtet.</Text>
              ) : (
                <View style={styles.formGrid}>
                  {!draftHasWeatherLocation(profileDraft) ? <Text style={[styles.muted, { color: theme.mcc.accent }]}>Für Outdoor-Profile bitte Koordinaten oder PLZ hinterlegen.</Text> : null}
                  <View style={styles.roleRow}>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.requiresDry ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, requiresDry: !draft.requiresDry }))}>
                    <Text style={[styles.roleText, { color: profileDraft.requiresDry ? "#FFFFFF" : theme.mcc.textPrimary }]}>Trocken nötig</Text>
                  </Pressable>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.rainSensitive ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, rainSensitive: !draft.rainSensitive }))}>
                    <Text style={[styles.roleText, { color: profileDraft.rainSensitive ? "#FFFFFF" : theme.mcc.textPrimary }]}>Regen sensibel</Text>
                  </Pressable>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.heatSensitive ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, heatSensitive: !draft.heatSensitive }))}>
                    <Text style={[styles.roleText, { color: profileDraft.heatSensitive ? "#FFFFFF" : theme.mcc.textPrimary }]}>Soll eher kalt sein</Text>
                  </Pressable>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.coldSensitive ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, coldSensitive: !draft.coldSensitive }))}>
                    <Text style={[styles.roleText, { color: profileDraft.coldSensitive ? "#FFFFFF" : theme.mcc.textPrimary }]}>Soll eher warm sein</Text>
                  </Pressable>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.windSensitive ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, windSensitive: !draft.windSensitive }))}>
                    <Text style={[styles.roleText, { color: profileDraft.windSensitive ? "#FFFFFF" : theme.mcc.textPrimary }]}>Wind sensibel</Text>
                  </Pressable>
                  </View>
                  {profileDraft.windSensitive ? (
                    <AdminInput value={profileDraft.maxWindKmh} onChangeText={(maxWindKmh) => setProfileDraft((draft) => ({ ...draft, maxWindKmh: maxWindKmh.replace(/[^\d,.]/g, '') }))} placeholder="Max. Wind in km/h, z. B. 35" keyboardType="decimal-pad" inputMode="decimal" />
                  ) : null}
                </View>
              )}

              <AdminSectionHeading label="Ausstattung" body="Mitbringen, Material vor Ort und Lichtbedingungen." />
              <View style={styles.formGrid}>
                <AdminInput value={profileDraft.requiredEquipment} onChangeText={(requiredEquipment) => setProfileDraft((draft) => ({ ...draft, requiredEquipment }))} placeholder="z. B. Schläger, Matte, Trinkflasche" />
              </View>

              <View style={styles.formGrid}>
                <AdminInput value={profileDraft.availableEquipment} onChangeText={(availableEquipment) => setProfileDraft((draft) => ({ ...draft, availableEquipment }))} placeholder="z. B. Netz, Tore, Matten, Bälle" />
                <View style={styles.roleRow}>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.lightingAvailable ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, lightingAvailable: !draft.lightingAvailable }))}>
                    <Text style={[styles.roleText, { color: profileDraft.lightingAvailable ? "#FFFFFF" : theme.mcc.textPrimary }]}>Licht vorhanden</Text>
                  </Pressable>
                </View>
              </View>

              <AdminSectionHeading label="Kosten und Verfügbarkeit" body="Zeitfenster, Reservierung und Kosten für die Entscheidung." />
              <View style={styles.formGrid}>
                <AdminInput value={profileDraft.openingNotes} onChangeText={(openingNotes) => setProfileDraft((draft) => ({ ...draft, openingNotes }))} placeholder="Öffnungszeiten oder Zeitfenster, z. B. ab 18 Uhr frei" multiline />
                <View style={styles.roleRow}>
                  <Pressable style={[styles.roleButton, { backgroundColor: profileDraft.reservationRequired ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => setProfileDraft((draft) => ({ ...draft, reservationRequired: !draft.reservationRequired }))}>
                    <Text style={[styles.roleText, { color: profileDraft.reservationRequired ? "#FFFFFF" : theme.mcc.textPrimary }]}>Reservierung nötig</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.roleButton, { backgroundColor: profileCostOpen ? theme.mcc.accentDeep : theme.mcc.surface }]}
                    onPress={() => {
                      const nextOpen = !profileCostOpen;
                      setProfileCostOpen(nextOpen);
                      setProfileDraft((draft) => ({
                        ...draft,
                        costRequired: nextOpen,
                        costPerPerson: nextOpen ? draft.costPerPerson : "",
                        costCurrency: nextOpen ? draft.costCurrency || "EUR" : "EUR",
                        costNote: nextOpen ? draft.costNote : "",
                      }));
                    }}
                  >
                    <Text style={[styles.roleText, { color: profileCostOpen ? "#FFFFFF" : theme.mcc.textPrimary }]}>Kostenpflichtig</Text>
                  </Pressable>
                </View>
                {profileCostOpen ? (
                  <View style={styles.formGrid}>
                    <AdminInput value={profileDraft.costPerPerson} onChangeText={(costPerPerson) => setProfileDraft((draft) => ({ ...draft, costPerPerson: costPerPerson.replace(/[^\d,.]/g, '') }))} placeholder="Kosten pro Person, z. B. 5" keyboardType="decimal-pad" inputMode="decimal" />
                    <AdminInput value={profileDraft.costCurrency} onChangeText={(costCurrency) => setProfileDraft((draft) => ({ ...draft, costCurrency: costCurrency.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || "EUR" }))} placeholder="Währung, z. B. EUR" />
                    <AdminInput value={profileDraft.costNote} onChangeText={(costNote) => setProfileDraft((draft) => ({ ...draft, costNote }))} placeholder="Kostenhinweis, z. B. Hallenanteil oder Buchung" />
                  </View>
                ) : null}
              </View>

              <AdminSectionHeading label="Standortdetails" body="Anreise, Infrastruktur, Regeln und Sicherheit." />
              <View style={styles.formGrid}>
                <AdminInput value={profileDraft.transitNotes} onChangeText={(transitNotes) => setProfileDraft((draft) => ({ ...draft, transitNotes }))} placeholder="Anreise, z. B. Buslinie, Radweg, Parkplätze" multiline />
                <AdminInput value={profileDraft.amenityNotes} onChangeText={(amenityNotes) => setProfileDraft((draft) => ({ ...draft, amenityNotes }))} placeholder="Infrastruktur, z. B. Wasser, Toiletten, Umkleiden" multiline />
              </View>

              <AdminSectionHeading label="AP und Organisation" body="Ansprechperson, AP-Level und organisatorische Hinweise." />
              <PickerGroup
                label="Profil-AP"
                items={members.map((member) => ({ id: member.userId, label: member.displayName }))}
                selectedId={profileDraft.apContactId || null}
                onSelect={(apContactId) => setProfileDraft((draft) => ({ ...draft, apContactId }))}
              />
              {profileDraft.apContactId ? (
                <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface, alignSelf: "flex-start" }]} onPress={() => setProfileDraft((draft) => ({ ...draft, apContactId: "" }))}>
                  <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Kein Profil-AP</Text>
                </Pressable>
              ) : null}
              <PickerGroup
                label="AP-Pflicht"
                items={apRequirementOptions.map((level) => ({ id: level, label: apRequirementLabel(level) }))}
                selectedId={profileDraft.apRequirementLevel}
                onSelect={(apRequirementLevel) => setProfileDraft((draft) => ({ ...draft, apRequirementLevel: apRequirementLevel as ApRequirementLevel, apRequired: apRequirementLevel !== "none" }))}
              />
              <View style={styles.formGrid}>
                <AdminInput value={profileDraft.locationRules} onChangeText={(locationRules) => setProfileDraft((draft) => ({ ...draft, locationRules }))} placeholder="Standortregeln, z. B. Reservierung ab 6 Personen" multiline />
                <AdminInput value={profileDraft.safetyNotes} onChangeText={(safetyNotes) => setProfileDraft((draft) => ({ ...draft, safetyNotes }))} placeholder="Sicherheit, z. B. rutschig bei Nässe" multiline />
              </View>
              <View style={styles.roleRow}>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: theme.mcc.accentDeep }]}
                  onPress={() =>
                    confirmAdminAction(
                      editingProfileId ? "Sportprofil speichern?" : "Sportprofil anlegen?",
                      editingProfileId ? `${profileDraft.name} wird geändert.` : `${profileDraft.name || "Neues Profil"} wird hinzugefügt.`,
                      () => void saveProfile(),
                    )
                  }
                >
                  <Text style={[styles.primaryText, { color: "#FFFFFF" }]}>{editingProfileId ? "Speichern" : "Anlegen"}</Text>
                </Pressable>
                {editingProfileId ? (
                  <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface }]} onPress={resetProfileDraft}>
                    <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Abbrechen</Text>
                  </Pressable>
                ) : null}
              </View>

              <SearchField value={profileSearch} onChangeText={setProfileSearch} placeholder="Sportart oder Standort suchen" />
              {sports.map((sport) => {
                const profiles = profilesBySport.get(sport.id) ?? [];
                if (profileSearch.trim() && profiles.length === 0) return null;
                return (
                  <View key={sport.id} style={[styles.memberCard, { borderTopColor: theme.mcc.line }]}>
                    <View style={styles.sportTitleRow}>
                      <SportIconBadge sport={sport} size={34} />
                      <View style={styles.memberText}>
                        <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{sport.name}</Text>
                      </View>
                    </View>
                    <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Abstrakte Sportart - darunter liegen konkrete Profile.</Text>
                    {profiles.length === 0 ? <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Noch kein Sportprofil.</Text> : null}
                    {profiles.map((profile) => {
                      const apMember = members.find((member) => member.userId === profile.ap_contact_id);
                      const creatorMember = members.find((member) => member.userId === profile.created_by);
                      const requiredEquipment = profile.required_equipment ?? [];
                      const linkedSports = sportIdsForProfile(profile, sportProfileLinks).map((sportId) => sports.find((entry) => entry.id === sportId)?.name).filter(Boolean).join(", ");
                      const missingWeatherLocation = profileNeedsWeatherLocation(profile.location_type) && !profileHasWeatherLocation(profile);
                      const minimumParticipants = profile.minimum_participants ?? profile.minimum_group_size;
                      const maximumParticipants = profile.maximum_participants ?? profile.maximum_group_size;
                      return (
                        <View key={profile.id} style={[styles.profileChildCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
                          <View style={styles.profileHeaderRow}>
                          <View style={styles.profileText}>
                            <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{profile.name}</Text>
                            <Text style={[styles.muted, { color: theme.mcc.accent }]}>{linkedSports || "Keine Sportart verknüpft"}</Text>
                            <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                              {[profile.location_name ?? "Ort offen", profile.location_city, profile.postal_code].filter(Boolean).join(" - ")} - Standort min. {minimumParticipants}
                              {maximumParticipants ? ` - max. ${maximumParticipants}` : ""}
                            </Text>
                            {missingWeatherLocation ? <Text style={[styles.muted, { color: theme.mcc.accent }]}>Wetterdaten fehlen: bitte PLZ oder Koordinaten ergänzen.</Text> : null}
                            <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                              AP: {apRequirementLabel(profile.ap_requirement_level)} - Kosten: {costProfileSummary(profile)}
                            </Text>
                            <Text style={[styles.muted, { color: profile.is_active ? theme.mcc.accent : theme.mcc.textSecondary }]}>
                              {profile.is_active ? "aktiv" : "inaktiv"} - {locationLabel(profile.location_type)}
                              {creatorMember ? ` - Ersteller: ${creatorMember.displayName}` : " - Ersteller offen"}
                              {apMember && apMember.userId !== creatorMember?.userId ? ` - AP: ${apMember.displayName}` : ""}
                            </Text>
                            {requiredEquipment.length > 0 ? <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Mitbringen: {requiredEquipment.join(", ")}</Text> : null}
                            {profile.opening_notes || profile.transit_notes || profile.amenity_notes ? (
                              <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                                {[profile.opening_notes, profile.transit_notes, profile.amenity_notes].filter(Boolean).join(" - ")}
                              </Text>
                            ) : null}
                            {profile.location_rules || profile.safety_notes ? (
                              <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                                {[profile.location_rules, profile.safety_notes].filter(Boolean).join(" - ")}
                              </Text>
                            ) : null}
                          </View>
                          <MapRouteButton target={profileMapTarget(profile)} compact />
                          </View>
                          <View style={styles.roleRow}>
                            <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => editProfile(profile)}>
                              <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Bearbeiten</Text>
                            </Pressable>
                            <Pressable style={[styles.roleButton, profile.is_active ? styles.dangerButton : { backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => void toggleProfileActive(profile)}>
                              <Text style={profile.is_active ? styles.dangerText : [styles.roleText, { color: theme.mcc.textPrimary }]}>
                                {profile.is_active ? "Deaktivieren" : "Aktivieren"}
                              </Text>
                            </Pressable>
                            <Pressable
                              style={[styles.roleButton, styles.dangerButton]}
                              onPress={() =>
                                confirmAdminAction(
                                  "Sportprofil löschen?",
                                  `${profile.name} wird komplett entfernt. Bereits entschiedene Event-Aktivitäten behalten ihren Text, verlieren aber die Profilreferenz.`,
                                  () => void removeProfile(profile),
                                )
                              }
                            >
                              <Text style={styles.dangerText}>Löschen</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : null}

          {isAdmin && activeSection === "members" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Mitglieder & Rechte</Text>
              <SearchField value={memberSearch} onChangeText={setMemberSearch} placeholder="Mitglied, Stadt oder Rolle suchen" />
              {filteredMembers.map((member) => (
                <View key={member.userId} style={[styles.memberCard, { borderTopColor: theme.mcc.line }]}>
                  <View>
                    <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{member.displayName}</Text>
                    <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                      {member.city ?? "Stadt offen"} · {member.phone ?? "Keine Nummer"} · {roleLabel(member.role)}
                    </Text>
                  </View>
                  {editingMemberNameId === member.userId ? (
                    <View style={styles.formGrid}>
                      <AdminInput value={memberNameDraft} onChangeText={setMemberNameDraft} placeholder="Neuer Anzeigename" />
                      <View style={styles.roleRow}>
                        <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.accentDeep }]} onPress={() => void saveMemberName(member)}>
                          <Text style={[styles.roleText, { color: "#FFFFFF" }]}>Name speichern</Text>
                        </Pressable>
                        <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface }]} onPress={() => setEditingMemberNameId(null)}>
                          <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Abbrechen</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.roleRow}>
                    <Pressable style={[styles.roleButton, { backgroundColor: theme.mcc.surface }]} onPress={() => startRenameMember(member)}>
                      <Text style={[styles.roleText, { color: theme.mcc.textPrimary }]}>Name</Text>
                    </Pressable>
                    {roles.map((role) => (
                      <Pressable
                        key={role}
                        style={[styles.roleButton, { backgroundColor: member.role === role ? theme.mcc.accentDeep : theme.mcc.surface }]}
                        onPress={() => confirmAdminAction("Rechte ändern?", `${member.displayName} wird auf ${roleLabel(role)} gesetzt.`, () => void changeRole(member, role))}
                      >
                        <Text style={[styles.roleText, { color: member.role === role ? "#FFFFFF" : theme.mcc.textPrimary }]}>{roleLabel(role)}</Text>
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

          {isAdmin && activeSection === "inviteTree" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Einladungsbaum</Text>
              <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>Jeder Ast zeigt, welcher Code von wem erstellt wurde und welche weiteren Codes daraus entstanden sind.</Text>
              {invitationTree.length === 0 ? <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Noch keine Einladungscodes.</Text> : null}
              <InvitationTreeView nodes={invitationRoots} />
            </View>
          ) : null}

          {isAdmin && activeSection === "nameRequests" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Namensanfragen</Text>
              {nameRequests.length === 0 ? <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Keine offenen Anfragen.</Text> : null}
              {nameRequests.map((request) => {
                const member = members.find((entry) => entry.userId === request.user_id);
                return (
                  <View key={request.id} style={[styles.memberCard, { borderTopColor: theme.mcc.line }]}>
                    <View>
                      <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{member?.displayName ?? "Mitglied"}</Text>
                      <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>möchte heißen: {request.requested_display_name}</Text>
                    </View>
                    <View style={styles.roleRow}>
                      <Pressable
                        style={[styles.roleButton, { backgroundColor: theme.mcc.accentDeep }]}
                        onPress={() =>
                          confirmAdminAction("Namen freigeben?", `${member?.displayName ?? "Mitglied"} wird zu ${request.requested_display_name}.`, () =>
                            void reviewNameRequest(request, "approved"),
                          )
                        }
                      >
                        <Text style={[styles.roleText, { color: "#FFFFFF" }]}>Freigeben</Text>
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

          {isAdmin && activeSection === "schedule" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Eventtage</Text>
              <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>
                Wähle, an welchen Wochentagen Cardiotage stattfinden und wann sie starten. Gilt ab der nächsten Bereitstellung – der Algorithmus nutzt die Uhrzeit automatisch (Wetter zur Eventzeit). Die Abstimmung läuft bis 3 Tage vor dem Event.
              </Text>

              {eventDays.map((day) => (
                <View key={day.weekday} style={[styles.scheduleRow, { borderTopColor: theme.mcc.line }]}>
                  <View style={styles.scheduleInfo}>
                    <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{WEEKDAY_LABELS[day.weekday]}</Text>
                    <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{day.enabled ? "findet statt" : "deaktiviert"}</Text>
                  </View>
                  <TextInput
                    value={day.time}
                    onChangeText={(value) => setEventDayTime(day.weekday, value)}
                    placeholder="HH:MM"
                    placeholderTextColor={theme.mcc.textMuted}
                    editable={day.enabled}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    style={[styles.timeInput, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface, color: theme.mcc.textPrimary, opacity: day.enabled ? 1 : 0.4 }]}
                  />
                  <Pressable
                    style={[styles.roleButton, day.enabled ? { backgroundColor: theme.mcc.accentDeep } : { backgroundColor: theme.mcc.surface, borderWidth: 1, borderColor: theme.mcc.line }]}
                    onPress={() => toggleEventDay(day.weekday)}
                  >
                    <Text style={[styles.roleText, { color: day.enabled ? "#FFFFFF" : theme.mcc.textPrimary }]}>{day.enabled ? "Aktiv" : "Inaktiv"}</Text>
                  </Pressable>
                </View>
              ))}

              <Pressable style={[styles.roleButton, styles.scheduleSave, { backgroundColor: theme.mcc.accentDeep }, scheduleBusy && { opacity: 0.5 }]} disabled={scheduleBusy} onPress={() => void saveEventDays()}>
                <Text style={[styles.roleText, { color: "#FFFFFF" }]}>{scheduleBusy ? "Speichern…" : "Eventtage speichern"}</Text>
              </Pressable>
            </View>
          ) : null}

          {isAdmin && activeSection === "cities" ? (
            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Aktive Städte</Text>
              <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>
                Events laufen nur in aktiven Städten. In der Testphase ist das nur Konstanz. Hier siehst du alle Städte, aus denen es Mitglieder gibt – aktiviere eine Stadt, damit dort Cardiotage erzeugt werden.
              </Text>

              {memberCities.length === 0 ? (
                <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>Noch keine Städte hinterlegt.</Text>
              ) : null}

              {memberCities.map((entry) => {
                const active = activeCitySet.has(entry.city);
                return (
                  <View key={entry.city} style={[styles.scheduleRow, { borderTopColor: theme.mcc.line }]}>
                    <View style={styles.scheduleInfo}>
                      <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{entry.city}</Text>
                      <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>
                        {entry.memberCount} {entry.memberCount === 1 ? "Mitglied" : "Mitglieder"}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.roleButton, active ? { backgroundColor: theme.mcc.accentDeep } : { backgroundColor: theme.mcc.surface, borderWidth: 1, borderColor: theme.mcc.line }]}
                      onPress={() => toggleActiveCity(entry.city)}
                    >
                      <Text style={[styles.roleText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{active ? "Aktiv" : "Inaktiv"}</Text>
                    </Pressable>
                  </View>
                );
              })}

              <Pressable style={[styles.roleButton, styles.scheduleSave, { backgroundColor: theme.mcc.accentDeep }, citiesBusy && { opacity: 0.5 }]} disabled={citiesBusy} onPress={() => void saveActiveCities()}>
                <Text style={[styles.roleText, { color: "#FFFFFF" }]}>{citiesBusy ? "Speichern…" : "Aktive Städte speichern"}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
        {iconPickerOpen ? (
          <SportIconPicker
            draft={sportDraft}
            onSelect={(iconName) => {
              setSportDraft((current) => ({ ...current, iconName }));
              setIconPickerOpen(false);
            }}
            onClose={() => setIconPickerOpen(false)}
          />
        ) : null}
        {pendingConfirm ? <ConfirmSheet confirm={pendingConfirm} onCancel={() => setPendingConfirm(null)} onConfirm={runConfirmedAction} /> : null}
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function AdminInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return <TextInput placeholderTextColor={theme.mcc.textSecondary} style={[styles.input, props.multiline && styles.textArea, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface, color: theme.mcc.textPrimary }]} {...props} />;
}

function SportIconPicker({ draft, onSelect, onClose }: { draft: SportDraft; onSelect: (iconName: string) => void; onClose: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.iconPickerOverlay} pointerEvents="box-none">
      <Pressable style={styles.confirmScrim} onPress={onClose} />
      <View style={[styles.iconPickerCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
        <View style={styles.contactRow}>
          <View style={styles.memberText}>
            <Text style={[styles.confirmTitle, { color: theme.mcc.textPrimary }]}>Welches Icon passt?</Text>
            <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{draft.name || "Neue Sportart"}</Text>
          </View>
          <Pressable style={[styles.inlineCloseButton, { backgroundColor: theme.mcc.surfaceSoft }]} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={18} color={theme.mcc.textPrimary} />
          </Pressable>
        </View>
        <ScrollView style={styles.iconScroll} contentContainerStyle={styles.iconGrid} showsVerticalScrollIndicator={false}>
          {SPORT_ICON_OPTIONS.map((option) => {
            const active = draft.iconName === option.name;
            return (
              <Pressable key={option.name} style={[styles.iconOption, { borderColor: active ? theme.mcc.accent : theme.mcc.line, backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surfaceSoft }]} onPress={() => onSelect(option.name)}>
                <MaterialCommunityIcons name={option.name} size={23} color={active ? "#FFFFFF" : theme.mcc.textPrimary} />
                <Text style={[styles.iconOptionText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function InvitationTreeView({ nodes }: { nodes: InvitationTreeNode[] }) {
  return (
    <View style={styles.treeList}>
      {nodes.map((node) => (
        <InvitationTreeItem key={node.id} node={node} depth={0} />
      ))}
    </View>
  );
}

function InvitationTreeItem({ node, depth }: { node: InvitationTreeNode; depth: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.treeItem, depth > 0 && styles.treeItemNested]}>
      <View style={[styles.treeStem, { backgroundColor: theme.mcc.line }]} />
      <View style={[styles.treeCard, { borderColor: node.accent ? theme.mcc.accent : theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
        <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{node.label}</Text>
        <Text style={[styles.muted, { color: node.accent ? theme.mcc.accent : theme.mcc.textSecondary }]}>{node.meta}</Text>
      </View>
      {node.children.length > 0 ? (
        <View style={styles.treeChildren}>
          {node.children.map((child) => (
            <InvitationTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ConfirmSheet({ confirm, onCancel, onConfirm }: { confirm: Exclude<PendingConfirm, null>; onCancel: () => void; onConfirm: () => void }) {
  const { theme } = useTheme();

  return (
    <View style={styles.confirmOverlay} pointerEvents="box-none">
      <Pressable style={styles.confirmScrim} onPress={onCancel} />
      <View style={[styles.confirmCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
        <Text style={[styles.confirmTitle, { color: theme.mcc.textPrimary }]}>{confirm.title}</Text>
        <Text style={[styles.confirmBody, { color: theme.mcc.textSecondary }]}>{confirm.detail}</Text>
        <View style={styles.confirmActions}>
          <Pressable style={[styles.confirmButton, { backgroundColor: theme.mcc.surfaceSoft }]} onPress={onCancel}>
            <Text style={[styles.confirmButtonText, { color: theme.mcc.textPrimary }]}>Abbrechen</Text>
          </Pressable>
          <Pressable style={[styles.confirmButton, styles.confirmDangerButton]} onPress={onConfirm}>
            <Text style={styles.confirmDangerText}>Bestätigen</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AdminSectionHeading({ label, body }: { label: string; body: string }) {
  return (
    <View style={styles.adminSectionHeading}>
      <MccBadge>{label}</MccBadge>
      <MccBody muted>{body}</MccBody>
    </View>
  );
}

function ProfileDraftPreview({ draft, members, editing }: { draft: ProfileDraft; members: MccMember[]; editing: boolean }) {
  const { theme } = useTheme();
  const apMember = members.find((member) => member.userId === draft.apContactId);
  const capacity = [draft.minimumGroupSize ? `min. ${draft.minimumGroupSize}` : null, draft.maximumGroupSize ? `max. ${draft.maximumGroupSize}` : null].filter(Boolean).join(" - ");
  const cost = draft.costRequired || draft.costPerPerson || draft.costNote ? [draft.costPerPerson ? `${draft.costPerPerson} ${draft.costCurrency || "EUR"}` : null, draft.costNote || "kostenpflichtig"].filter(Boolean).join(" - ") : "keine Pflichtkosten";

  return (
    <View style={[styles.previewPanel, { borderColor: theme.mcc.strongLine, backgroundColor: theme.mcc.accentFaint }]}>
      <MccBadge icon={editing ? "pencil-outline" : "plus-circle-outline"}>{editing ? "Preview: Bearbeitung" : "Preview: Neues Profil"}</MccBadge>
      <MccCardTitle>{draft.name || "Unbenanntes Sportprofil"}</MccCardTitle>
      <MccBody muted>{[draft.locationName || "Ort offen", draft.locationCity, draft.postalCode].filter(Boolean).join(" - ") || "Standort noch offen"}</MccBody>
      <View style={styles.previewChipRow}>
        <MccBadge tone="neutral">{locationLabel(draft.locationType)}</MccBadge>
        <MccBadge tone={capacity ? "accent" : "neutral"}>{capacity || "Kapazität offen"}</MccBadge>
        <MccBadge tone={draft.apRequirementLevel === "critical" ? "warning" : "neutral"}>AP {apRequirementLabel(draft.apRequirementLevel)}</MccBadge>
        <MccBadge tone={draft.costRequired ? "warning" : "neutral"}>{cost}</MccBadge>
      </View>
      <MccBody muted>{apMember ? `Profil-AP: ${apMember.displayName}` : "Noch kein Profil-AP ausgewählt."}</MccBody>
    </View>
  );
}

function AdminMenuCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.menuCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.memberText}>
        <Text style={[styles.name, { color: theme.mcc.textPrimary }]}>{title}</Text>
        <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{body}</Text>
      </View>
      <Text style={[styles.itemArrow, { color: theme.mcc.textSecondary }]}>›</Text>
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
      <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{label}</Text>
      <View style={styles.roleRow}>
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <Pressable key={item.id} style={[styles.roleButton, { backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => onSelect(item.id)}>
              <Text style={[styles.roleText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MultiPickerGroup({
  label,
  items,
  selectedIds,
  onToggle,
}: {
  label: string;
  items: Array<{ id: string; label: string; inactive?: boolean }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.chipGroup}>
      <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{label}</Text>
      <View style={styles.roleRow}>
        {items.map((item) => {
          const active = selectedIds.includes(item.id);
          return (
            <Pressable key={item.id} style={[styles.roleButton, { backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surface, opacity: item.inactive && !active ? 0.55 : 1 }]} onPress={() => onToggle(item.id)}>
              <Text style={[styles.roleText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{item.label}{item.inactive ? " (inaktiv)" : ""}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function sectionTitle(section: AdminSection): string {
  if (section === "sports") return "Sportarten";
  if (section === "profiles") return "Sportprofile";
  if (section === "members") return "Mitglieder";
  if (section === "inviteTree") return "Einladungsbaum";
  if (section === "nameRequests") return "Namensanfragen";
  if (section === "schedule") return "Eventtage";
  if (section === "cities") return "Aktive Städte";
  return "Club steuern";
}

function isAdminSection(value: string): value is AdminSection {
  return (
    value === "overview" ||
    value === "sports" ||
    value === "profiles" ||
    value === "members" ||
    value === "inviteTree" ||
    value === "nameRequests" ||
    value === "schedule" ||
    value === "cities"
  );
}

function buildInvitationTree(entries: InvitationTreeEntry[]): InvitationTreeNode[] {
  const codesByCreator = new Map<string, InvitationTreeEntry[]>();
  const usedUserIds = new Set<string>();

  for (const entry of entries) {
    const creatorKey = entry.created_by ?? "system";
    const codes = codesByCreator.get(creatorKey) ?? [];
    codes.push(entry);
    codesByCreator.set(creatorKey, codes);
    if (entry.used_by) usedUserIds.add(entry.used_by);
  }

  const creatorKeys = [...codesByCreator.keys()];
  const rootKeys = creatorKeys.filter((key) => key === "system" || !usedUserIds.has(key));
  const visitedCreators = new Set<string>();
  const roots = (rootKeys.length > 0 ? rootKeys : creatorKeys).map((key) => buildCreatorNode(key, codesByCreator, visitedCreators));

  return roots.filter((node) => node.children.length > 0);
}

function buildCreatorNode(
  creatorKey: string,
  codesByCreator: Map<string, InvitationTreeEntry[]>,
  visitedCreators: Set<string>,
): InvitationTreeNode {
  const codes = codesByCreator.get(creatorKey) ?? [];
  const creatorName = creatorKey === "system" ? "System" : codes[0]?.createdByName ?? "Mitglied";

  if (visitedCreators.has(creatorKey)) {
    return {
      id: `creator-${creatorKey}-loop`,
      label: creatorName,
      meta: "Weitere Codes sind bereits im Baum sichtbar.",
      children: [],
    };
  }

  visitedCreators.add(creatorKey);
  return {
    id: `creator-${creatorKey}`,
    label: creatorName,
    meta: "hat Einladungscodes erstellt",
    accent: creatorKey === "system" ? "system" : null,
    children: codes.map((code) => buildCodeNode(code, codesByCreator, visitedCreators)),
  };
}

function buildCodeNode(
  code: InvitationTreeEntry,
  codesByCreator: Map<string, InvitationTreeEntry[]>,
  visitedCreators: Set<string>,
): InvitationTreeNode {
  const usedMeta = code.used_at ? `verwendet am ${formatDate(code.used_at)}` : "noch nicht verwendet";
  const memberChildren =
    code.used_by && !visitedCreators.has(code.used_by)
      ? (() => {
          visitedCreators.add(code.used_by);
          return (codesByCreator.get(code.used_by) ?? []).map((childCode) => buildCodeNode(childCode, codesByCreator, visitedCreators));
        })()
      : [];
  const usedMember = code.used_by
    ? [{
        id: `member-${code.used_by}-${code.code}`,
        label: code.usedByName ?? "Mitglied",
        meta: [code.usedByCity, usedMeta].filter(Boolean).join(" · "),
        accent: code.used_at ? "used" : null,
        children: memberChildren,
      }]
    : [];

  return {
    id: `code-${code.code}`,
    label: `Code ${code.code}`,
    meta: code.used_by ? "eingelöst" : "wartet auf Einlösung",
    children: usedMember,
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sportIdsForProfile(profile: Row<"sport_profiles">, links: Row<"sport_profile_sports">[]): string[] {
  const linked = links.filter((link) => link.profile_id === profile.id).map((link) => link.sport_id);
  return linked.length > 0 ? [...new Set(linked)] : [profile.sport_id];
}

function profileMapTarget(profile: Row<"sport_profiles">) {
  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    mapUrl: profile.map_url,
    label: [profile.location_name, profile.location_city, profile.postal_code].filter(Boolean).join(" "),
  };
}

function categoryLabel(value: string): string {
  const labels: Record<string, string> = {
    ballsport: "Ballsport",
    ball: "Ballsport",
    ausdauer: "Ausdauersport",
    kraft: "Kraftsport",
    kraftsport: "Kraftsport",
    wasser: "Wasser",
    wassersport: "Wassersport",
    winter: "Winter",
    wintersport: "Wintersport",
    kampf: "Kampfsport",
    kampfsport: "Kampfsport",
    rueckschlagspiel: "Rückschlagspiel",
    teamsport: "Teamsport",
    individualsport: "Individualsport",
    tanz: "Tanz",
    fitness: "Fitness",
    mobility: "Mobility",
    unknown: "Unbekannt",
    unbekannt: "Unbekannt",
    cardio: "Ausdauersport",
  };
  return labels[value] ?? value;
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateProfileDraft(draft: ProfileDraft): string | null {
  if (profileNeedsWeatherLocation(draft.locationType) && !draftHasWeatherLocation(draft)) {
    return "Outdoor-Profile brauchen Koordinaten oder eine PLZ, damit Wetterrisiken bewertet werden können.";
  }

  const minimumParticipants = parseOptionalNumber(draft.minimumGroupSize);
  const maximumParticipants = parseOptionalNumber(draft.maximumGroupSize);
  if (minimumParticipants && maximumParticipants && maximumParticipants < minimumParticipants) {
    return "Das Standort-Maximum muss größer oder gleich dem Standort-Minimum sein.";
  }

  if (draft.costPerPerson.trim() && parseOptionalNumber(draft.costPerPerson) === null) {
    return "Kosten pro Person müssen eine gültige Zahl sein.";
  }

  if (parseOptionalNumber(draft.costPerPerson) !== null && Number(parseOptionalNumber(draft.costPerPerson)) < 0) {
    return "Kosten pro Person dürfen nicht negativ sein.";
  }

  if (draft.maxWindKmh.trim() && parseOptionalNumber(draft.maxWindKmh) === null) {
    return "Maximaler Wind muss eine gültige Zahl sein.";
  }

  return null;
}

function draftHasWeatherLocation(draft: ProfileDraft): boolean {
  return hasCoordinatePair(parseOptionalNumber(draft.latitude), parseOptionalNumber(draft.longitude)) || /^\d{5}$/.test(draft.postalCode.trim());
}

function profileHasWeatherLocation(profile: Row<"sport_profiles">): boolean {
  return hasCoordinatePair(profile.latitude, profile.longitude) || /^\d{5}$/.test(profile.postal_code ?? "");
}

function hasCoordinatePair(latitude: number | null, longitude: number | null): boolean {
  return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude);
}

function profileNeedsWeatherLocation(locationType: SportLocationType): boolean {
  return locationType !== "indoor";
}

function apRequirementLabel(value: ApRequirementLevel): string {
  if (value === "critical") return "kritisch";
  if (value === "required") return "erforderlich";
  return "nicht nötig";
}

function costProfileSummary(profile: Row<"sport_profiles">): string {
  if (!profile.cost_required && !profile.cost_note && !profile.cost_per_person) {
    return "keine Pflichtkosten";
  }
  const amount = typeof profile.cost_per_person === "number" ? `${profile.cost_per_person} ${profile.cost_currency ?? "EUR"} p. P.` : null;
  return [amount, profile.cost_note || "kostenpflichtig"].filter(Boolean).join(" - ");
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function weatherRuleBoolean(value: unknown, key: string, fallback = false): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "boolean" ? next : fallback;
}

function weatherRuleNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "number" && Number.isFinite(next) ? next : null;
}

function formatOptionalNumber(value: number | null): string {
  return typeof value === "number" ? String(value) : "";
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
      <Text style={[styles.muted, { color: theme.mcc.textSecondary }]}>{label}</Text>
      <View style={styles.roleRow}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Pressable key={option} style={[styles.roleButton, { backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surface }]} onPress={() => onSelect(option)}>
              <Text style={[styles.roleText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{isIntensity(option) ? intensityLabel(option) : locationLabel(option)}</Text>
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
  content: { flexGrow: 1, gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 22 },
  muted: { fontSize: 13, lineHeight: 19 },
  adminGrid: { gap: 10 },
  scheduleRow: { alignItems: "center", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 12 },
  scheduleInfo: { flex: 1, minWidth: 0 },
  timeInput: { borderRadius: 14, borderWidth: 1, fontSize: 16, fontWeight: "900", minWidth: 76, paddingHorizontal: 12, paddingVertical: 9, textAlign: "center" } as object,
  scheduleSave: { alignItems: "center", marginTop: 4 },
  adminSectionHeading: { gap: 6, paddingTop: 8 },
  previewPanel: { gap: 12, borderRadius: 22, borderWidth: 1, padding: 14 },
  previewChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  sectionQuestion: { fontSize: 16, fontWeight: "900", lineHeight: 21, marginTop: 4 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  sportTitleRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  memberText: { flex: 1, minWidth: 0 },
  memberCard: { gap: 10, borderTopWidth: 1, paddingTop: 12 },
  profileHeaderRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  profileText: { flex: 1, minWidth: 0 },
  profileChildCard: { gap: 8, borderRadius: 18, borderWidth: 1, padding: 12 },
  contactRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  treeList: { gap: 10 },
  treeItem: { gap: 8, paddingLeft: 16, position: "relative" },
  treeItemNested: { marginLeft: 14 },
  treeStem: { borderRadius: 999, bottom: 0, left: 3, opacity: 0.8, position: "absolute", top: 0, width: 2 },
  treeCard: { borderRadius: 16, borderWidth: 1, gap: 3, paddingHorizontal: 12, paddingVertical: 10 },
  treeChildren: { gap: 8 },
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
  inlineIconLabel: { alignItems: "center", flexDirection: "row", gap: 7 },
  inlineCloseButton: { alignItems: "center", borderRadius: 999, height: 34, justifyContent: "center", width: 34 },
  iconPickerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 36,
    justifyContent: "center",
    padding: 16,
  },
  iconPickerCard: {
    alignSelf: "center",
    width: "100%",
    maxHeight: "82%",
    maxWidth: 520,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  iconScroll: { flexGrow: 0 },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 },
  iconOption: { alignItems: "center", borderRadius: 16, borderWidth: 1, gap: 5, minWidth: 92, paddingHorizontal: 10, paddingVertical: 10 },
  iconOptionText: { fontSize: 11, fontWeight: "900" },
  primaryButton: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11 },
  primaryText: { fontSize: 13, fontWeight: "900" },
  dangerButton: { backgroundColor: "rgba(255,126,106,0.16)" },
  dangerText: { color: "#ff8d7a", fontSize: 12, fontWeight: "900" },
  pressed: { opacity: 0.82 },
  confirmOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    justifyContent: "flex-end",
  },
  confirmScrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  confirmCard: {
    gap: 12,
    margin: 16,
    marginBottom: 96,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  confirmTitle: { fontSize: 21, fontWeight: "900", lineHeight: 25 },
  confirmBody: { fontSize: 14, lineHeight: 21 },
  confirmActions: { flexDirection: "row", gap: 10 },
  confirmButton: { flex: 1, alignItems: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12 },
  confirmButtonText: { fontSize: 13, fontWeight: "900" },
  confirmDangerButton: { backgroundColor: "rgba(255,126,106,0.18)" },
  confirmDangerText: { color: "#ff8d7a", fontSize: 13, fontWeight: "900" },
});
