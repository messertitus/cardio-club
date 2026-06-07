import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { DetailLine, LabeledInput, MapLocationPicker, SearchField, SegmentedControl } from "../src/components/FormControls";
import { MapRouteButton } from "../src/components/MapRouteButton";
import { PageHeader } from "../src/components/PageHeader";
import { SportIconBadge } from "../src/components/SportIcon";
import { Button, LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import {
  isCurrentUserAdmin,
  listSportIdeas,
  listSportProfileSportLinks,
  listSportProfiles,
  listSports,
  reviewSportIdea,
  saveSportIdeaDraft,
  submitSportIdea,
  upsertSportProfile,
  type Json,
  type Row,
  type SportIdeaDraftStep,
  type SportIdeaLocationMode,
  type SportIdeaWithCreator,
  type SportLocationType,
} from "../src/services";

type IdeaFlowStep = "location" | "locationName" | "sport" | "type" | "group" | "weather" | "equipment" | "available" | "schedule" | "logistics" | "review";

type SportSpecificDraft = {
  locationType: SportLocationType | null;
  minimumGroupSize: string;
  maximumGroupSize: string;
  requiredEquipment: string;
  availableEquipment: string;
  costNote: string;
  openingNotes: string;
  transitNotes: string;
  amenityNotes: string;
  reservationRequired: boolean | null;
  lightingAvailable: boolean | null;
  safetyNotes: string;
  locationRules: string;
  apRequired: boolean;
  rainMode: "ok" | "sensitive" | "dry";
  temperatureMode: "any" | "moderate" | "warm" | "cool";
  thunderstormUnsafe: boolean;
};

type IdeaDraft = {
  ideaId: string | null;
  name: string;
  requestedSportName: string;
  sportId: string;
  sportIds: string[];
  activeSportId: string | null;
  sportDetails: Record<string, SportSpecificDraft>;
  profileName: string;
  note: string;
  locationMode: SportIdeaLocationMode;
  location: string;
  postalCode: string;
  locationCity: string;
  mapUrl: string;
  latitude: number | null;
  longitude: number | null;
  preferredTime: string;
  locationType: SportLocationType | null;
  minimumGroupSize: string;
  maximumGroupSize: string;
  requiredEquipment: string;
  availableEquipment: string;
  costNote: string;
  openingNotes: string;
  transitNotes: string;
  amenityNotes: string;
  reservationRequired: boolean | null;
  lightingAvailable: boolean | null;
  safetyNotes: string;
  locationRules: string;
  apRequired: boolean;
  rainMode: "ok" | "sensitive" | "dry";
  temperatureMode: "any" | "moderate" | "warm" | "cool";
  thunderstormUnsafe: boolean;
  suggestedBy: string | null;
};

const flowSteps: Array<{ id: IdeaFlowStep; label: string }> = [
  { id: "location", label: "Standort" },
  { id: "locationName", label: "Name" },
  { id: "sport", label: "Sportart" },
  { id: "type", label: "Profilart" },
  { id: "group", label: "Anzahl" },
  { id: "weather", label: "Wetter" },
  { id: "equipment", label: "Mitbringen" },
  { id: "available", label: "Vor Ort" },
  { id: "schedule", label: "Zeiten" },
  { id: "logistics", label: "Anreise" },
  { id: "review", label: "Übersicht" },
];

const emptyDraft: IdeaDraft = {
  ideaId: null,
  name: "",
  requestedSportName: "",
  sportId: "",
  sportIds: [],
  activeSportId: null,
  sportDetails: {},
  profileName: "",
  note: "",
  locationMode: "fixed",
  location: "",
  postalCode: "",
  locationCity: "",
  mapUrl: "",
  latitude: null,
  longitude: null,
  preferredTime: "",
  locationType: null,
  minimumGroupSize: "",
  maximumGroupSize: "",
  requiredEquipment: "",
  availableEquipment: "",
  costNote: "",
  openingNotes: "",
  transitNotes: "",
  amenityNotes: "",
  reservationRequired: null,
  lightingAvailable: null,
  safetyNotes: "",
  locationRules: "",
  apRequired: false,
  rainMode: "ok",
  temperatureMode: "any",
  thunderstormUnsafe: true,
  suggestedBy: null,
};

export default function IdeasScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [draft, setDraft] = useState<IdeaDraft>(emptyDraft);
  const [activeStep, setActiveStep] = useState<IdeaFlowStep>("location");
  const [ideas, setIdeas] = useState<SportIdeaWithCreator[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [sportProfileLinks, setSportProfileLinks] = useState<Row<"sport_profile_sports">[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);
  const [sportSearch, setSportSearch] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [approvedOpen, setApprovedOpen] = useState(false);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [requestSportOpen, setRequestSportOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [costOpenBySport, setCostOpenBySport] = useState<Record<string, boolean>>({});
  const confirmationPulse = useRef(new Animated.Value(0)).current;

  async function load() {
    if (!user) return;
    setBusy(true);
    const [sportsResult, profilesResult, linksResult, ideasResult, adminResult] = await Promise.all([
      listSports(supabase),
      listSportProfiles(supabase),
      listSportProfileSportLinks(supabase),
      listSportIdeas(supabase),
      isCurrentUserAdmin(supabase, user.id),
    ]);
    setBusy(false);
    if (sportsResult.data) setSports(sportsResult.data);
    if (profilesResult.data) setSportProfiles(profilesResult.data);
    if (linksResult.data) setSportProfileLinks(linksResult.data);
    if (ideasResult.data) {
      setIdeas(ideasResult.data);
      const ownDraft = ideasResult.data.find((idea) => idea.suggested_by === user.id && idea.is_draft);
      if (ownDraft && !draft.ideaId) {
        setDraft(ideaToDraft(ownDraft));
        setActiveStep(asFlowStep(ownDraft.draft_step));
      }
    }
    if (adminResult.data !== null) setIsAdmin(adminResult.data);
    if (sportsResult.error || profilesResult.error || linksResult.error || ideasResult.error || adminResult.error) {
      setMessage(sportsResult.error?.message ?? profilesResult.error?.message ?? linksResult.error?.message ?? ideasResult.error?.message ?? adminResult.error?.message ?? null);
    }
  }

  useEffect(() => {
    if (user) void load();
  }, [user]);

  useEffect(() => {
    if (draft.costNote.trim()) setCostOpen(true);
  }, [draft.costNote]);

  const filteredSports = useMemo(() => {
    const query = sportSearch.trim().toLowerCase();
    if (!query) return sports;
    return sports.filter((sport) => {
      const profileText = sportProfiles
        .filter((profile) => profileIsLinkedToSport(profile, sport.id, sportProfileLinks))
        .map((profile) => [profile.name, profile.location_name, profile.location_city, profile.venue_group_key].filter(Boolean).join(" "))
        .join(" ");
      return `${sport.name} ${sport.category} ${profileText}`.toLowerCase().includes(query);
    });
  }, [sportProfileLinks, sportProfiles, sportSearch, sports]);

  const selectedSportIds = useMemo(() => selectedSportIdsFromDraft(draft), [draft.sportId, draft.sportIds]);
  const activeSportId = draft.activeSportId && selectedSportIds.includes(draft.activeSportId) ? draft.activeSportId : selectedSportIds[0] ?? null;
  const activeSport = useMemo(() => sports.find((sport) => sport.id === activeSportId) ?? null, [activeSportId, sports]);
  const activeSportDetail = useMemo(() => (activeSportId ? sportDetailForDraft(draft, activeSportId) : sportDetailForDraft(draft, null)), [activeSportId, draft]);
  const activeCostOpen = activeSportId ? costOpenBySport[activeSportId] ?? Boolean(activeSportDetail.costNote.trim()) : costOpen || Boolean(activeSportDetail.costNote.trim());

  const sortedIdeas = useMemo(() => sortIdeasForUser(ideas, user?.id ?? null), [ideas, user?.id]);
  const queueIdeas = useMemo(() => sortedIdeas.filter((idea) => idea.is_draft || idea.status === "pending"), [sortedIdeas]);
  const approvedIdeas = useMemo(() => sortedIdeas.filter((idea) => !idea.is_draft && idea.status === "approved"), [sortedIdeas]);
  const rejectedIdeas = useMemo(() => sortedIdeas.filter((idea) => !idea.is_draft && idea.status === "rejected"), [sortedIdeas]);

  const ownDraft = useMemo(() => ideas.find((idea) => user && idea.suggested_by === user.id && idea.is_draft) ?? null, [ideas, user]);
  const profilesBySport = useMemo(() => groupProfilesBySport(sportProfiles, sportProfileLinks), [sportProfileLinks, sportProfiles]);
  const creatorNameById = useMemo(() => {
    const result = new Map<string, string>();
    for (const idea of ideas) {
      if (idea.suggested_by && idea.creatorName) result.set(idea.suggested_by, idea.creatorName);
    }
    return result;
  }, [ideas]);
  const currentFlowSteps = useMemo(
    () => flowSteps.filter((step) => draft.locationMode === "fixed" || step.id !== "locationName"),
    [draft.locationMode],
  );
  useEffect(() => {
    if (!currentFlowSteps.some((step) => step.id === activeStep)) {
      setActiveStep(currentFlowSteps[0]?.id ?? "location");
    }
  }, [activeStep, currentFlowSteps]);
  const activeStepIndex = Math.max(0, currentFlowSteps.findIndex((step) => step.id === activeStep));
  const canGoPrevious = activeStepIndex > 0;
  const canGoNext = activeStepIndex < currentFlowSteps.length - 1;

  const currentUserOwnsDraft = Boolean(user && (!draft.suggestedBy || draft.suggestedBy === user.id));
  const canSaveDraft = Boolean(user && currentUserOwnsDraft);
  const errors = submitAttempted ? requiredErrors(draft) : {};

  async function saveDraft() {
    if (!user || !canSaveDraft) return;
    clearMessages();
    setBusy(true);
    const input = draftToInput(draft, user.id, persistedDraftStep(activeStep), sports, activeSportId ?? draft.sportId);
    const result = await saveSportIdeaDraft(supabase, input);
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setDraft(ideaToDraft({ ...result.data, creatorName: "Du", creatorCity: null, sportName: selectedSportNames(ideaSportIds(result.data), sports), sportNames: selectedSportNameList(ideaSportIds(result.data), sports) }));
    setSuccess("Entwurf gespeichert.");
    await load();
  }

  async function submit() {
    if (!user) return;
    clearMessages();
    setSubmitAttempted(true);
    const missing = requiredErrors(draft);
    if (Object.keys(missing).length > 0) {
      const missingSportId = firstMissingSportId(draft);
      if (missingSportId) setDraft((current) => ({ ...current, activeSportId: missingSportId }));
      setActiveStep(firstMissingStep(missing, draft));
      setMessage("Bitte ergänze die markierten Angaben.");
      return;
    }
    setBusy(true);
    const sportIdsToSubmit = selectedSportIdsFromDraft(draft);
    let firstError: string | null = null;
    if (sportIdsToSubmit.length > 0) {
      for (const sportId of sportIdsToSubmit) {
        const inputDraft = { ...draft, ideaId: sportIdsToSubmit.length === 1 || sportId === draft.sportId ? draft.ideaId : null };
        const result = await submitSportIdea(supabase, draftToInput(inputDraft, user.id, "review", sports, sportId));
        if (result.error) {
          firstError = result.error.message;
          break;
        }
      }
    } else {
      const result = await submitSportIdea(supabase, draftToInput(draft, user.id, "review", sports));
      firstError = result.error?.message ?? null;
    }
    setBusy(false);
    if (firstError) {
      setMessage(firstError);
      return;
    }
    setDraft(emptyDraft);
    setProposalOpen(false);
    setSubmitAttempted(false);
    setActiveStep("location");
    setSuccess(sportIdsToSubmit.length > 1 ? `${sportIdsToSubmit.length} Ideen eingereicht.` : "Idee eingereicht.");
    await load();
  }

  async function reviewIdea(idea: SportIdeaWithCreator, status: "approved" | "rejected") {
    if (!user) return;
    clearMessages();
    if (status === "approved") {
      const profileResult = await createProfileFromIdea(idea);
      if (profileResult) {
        setMessage(profileResult);
        return;
      }
    }
    const result = await reviewSportIdea(supabase, { ideaId: idea.id, status, reviewedBy: user.id, reviewNote: idea.review_note });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setSuccess(status === "approved" ? "Idee freigegeben." : "Idee abgelehnt.");
    await load();
  }

  async function createProfileFromIdea(idea: SportIdeaWithCreator): Promise<string | null> {
    const sportIds = ideaSportIds(idea);
    if (sportIds.length === 0) return "Bitte wähle vor der Freigabe mindestens eine abstrakte Sportart aus.";
    const result = await upsertSportProfile(supabase, {
      sportId: sportIds[0],
      sportIds,
      name: idea.profile_name ?? idea.name ?? "",
      locationName: idea.location,
      mapUrl: idea.map_url,
      postalCode: idea.postal_code,
      locationCity: idea.location_city,
      latitude: idea.latitude,
      longitude: idea.longitude,
      locationType: idea.location_type ?? "flexible",
      isIndoor: idea.location_type === "indoor",
      minimumGroupSize: idea.minimum_group_size,
      maximumGroupSize: idea.maximum_group_size,
      requiredEquipment: idea.required_equipment ?? [],
      availableEquipment: idea.available_equipment ?? [],
      costNote: idea.cost_note,
      openingNotes: idea.opening_notes,
      transitNotes: idea.transit_notes,
      amenityNotes: idea.amenity_notes,
      reservationRequired: idea.reservation_required,
      lightingAvailable: idea.lighting_available,
      safetyNotes: idea.safety_notes,
      locationRules: idea.location_rules,
      apRequired: idea.ap_required,
      apContactId: idea.suggested_by,
      weatherRules: weatherRulesForProfile(idea.weather_rules),
      createdBy: idea.suggested_by,
    });

    return result.error?.message ?? null;
  }

  function continueIdea(idea: SportIdeaWithCreator) {
    setDraft(ideaToDraft(idea));
    setActiveStep(asFlowStep(idea.draft_step));
    setExpandedIdeaId(idea.id);
    setProposalOpen(true);
    setSubmitAttempted(false);
  }

  function goToPreviousStep() {
    if (!canGoPrevious) return;
    setActiveStep(currentFlowSteps[activeStepIndex - 1].id);
  }

  function goToNextStep() {
    if (!canGoNext) return;
    if (isSportSpecificStep(activeStep) && selectedSportIds.length > 1 && activeSportId) {
      const currentSportIndex = selectedSportIds.indexOf(activeSportId);
      const nextSportId = selectedSportIds[currentSportIndex + 1];
      if (nextSportId) {
        goToSportWithFeedback(nextSportId);
        return;
      }
    }
    const nextStep = currentFlowSteps[activeStepIndex + 1].id;
    if (isSportSpecificStep(nextStep) && selectedSportIds.length > 1) {
      setDraft((current) => ({ ...current, activeSportId: selectedSportIds[0] }));
    }
    goToStepWithFeedback(nextStep);
  }

  function goToStepWithFeedback(step: IdeaFlowStep) {
    setMessage(null);
    confirmationPulse.stopAnimation();
    confirmationPulse.setValue(0);
    Animated.sequence([
      Animated.timing(confirmationPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(140),
      Animated.timing(confirmationPulse, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => setActiveStep(step));
  }

  function goToSportWithFeedback(sportId: string) {
    setMessage(null);
    confirmationPulse.stopAnimation();
    confirmationPulse.setValue(0);
    Animated.sequence([
      Animated.timing(confirmationPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(140),
      Animated.timing(confirmationPulse, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => setDraft((current) => ({ ...current, activeSportId: sportId })));
  }

  function clearMessages() {
    setMessage(null);
    setSuccess(null);
  }

  function toggleSportChoice(sport: Row<"sports">) {
    setRequestSportOpen(false);
    setDraft((current) => {
      const currentIds = selectedSportIdsFromDraft(current);
      const isSelected = currentIds.includes(sport.id);
      const nextIds = isSelected ? currentIds.filter((id) => id !== sport.id) : [...currentIds, sport.id];
      const nextDetails = { ...current.sportDetails };
      if (isSelected) {
        delete nextDetails[sport.id];
      } else if (!nextDetails[sport.id]) {
        nextDetails[sport.id] = sportDetailForDraft(current, current.activeSportId ?? current.sportId);
      }

      const nextActiveSportId = isSelected
        ? current.activeSportId === sport.id
          ? nextIds[0] ?? null
          : current.activeSportId
        : sport.id;
      const firstSportId = nextIds[0] ?? "";
      const firstSportName = selectedSportName(firstSportId, sports) ?? "";

      return {
        ...current,
        sportId: firstSportId,
        sportIds: nextIds,
        activeSportId: nextActiveSportId,
        sportDetails: nextDetails,
        requestedSportName: "",
        name: nextIds.length > 1 ? `${nextIds.length} Sportarten` : firstSportName,
      };
    });
  }

  function selectActiveSport(sportId: string) {
    setDraft((current) => ({ ...current, activeSportId: sportId }));
  }

  function updateActiveSportDetail(patch: Partial<SportSpecificDraft>) {
    if (!activeSportId) {
      setDraft((current) => ({ ...current, ...patch }));
      return;
    }
    setDraft((current) => ({
      ...current,
      sportDetails: {
        ...current.sportDetails,
        [activeSportId]: { ...sportDetailForDraft(current, activeSportId), ...patch },
      },
    }));
  }

  function setActiveSportCostOpen(open: boolean) {
    if (!activeSportId) {
      setCostOpen(open);
      if (!open) updateActiveSportDetail({ costNote: "" });
      return;
    }
    setCostOpenBySport((current) => ({ ...current, [activeSportId]: open }));
    if (!open) updateActiveSportDetail({ costNote: "" });
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.shell}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PageHeader
              kicker="Sportideen"
              title="Sportarten und Standorte"
              actions={ownDraft ? <DraftIconButton onPress={() => continueIdea(ownDraft)} /> : null}
            />
            {message ? <Text style={styles.notice}>{message}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Aktive Sportarten</Text>
              <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart oder Standort suchen" />
              {filteredSports.length === 0 ? <Text style={[styles.body, { color: theme.muted }]}>Keine Sportarten für diese Suche.</Text> : null}
              <View style={styles.activeSportList}>
                {filteredSports.map((sport) => {
                  const profiles = profilesBySport.get(sport.id) ?? [];
                  return (
                    <View key={sport.id} style={[styles.activeSportBlock, { borderTopColor: theme.border }]}>
                      <View style={styles.sportTitleRow}>
                        <SportIconBadge sport={sport} size={34} />
                        <Text style={[styles.sportPillText, { color: theme.text }]}>{sport.name}</Text>
                      </View>
                      {profiles.length === 0 ? <Text style={[styles.ideaNote, { color: theme.muted }]}>Noch kein Standortprofil hinterlegt.</Text> : null}
                      {profiles.map((profile) => (
                        <View key={profile.id} style={[styles.profileLine, styles.profileLineRow, { backgroundColor: theme.surface }]}>
                          <View style={styles.profileLineText}>
                            <Text style={[styles.profileLineTitle, { color: theme.text }]}>{sportProfileEventName(sport.name, profile)}</Text>
                            <Text style={[styles.profileLineMeta, { color: theme.muted }]}>
                              {[profileLocationText(profile), profile.created_by ? `Ersteller: ${creatorNameById.get(profile.created_by) ?? "Mitglied"}` : null].filter(Boolean).join(" - ")}
                            </Text>
                          </View>
                          <MapRouteButton target={profileMapTarget(profile)} compact />
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>

            <Pressable style={[styles.createCard, { borderColor: theme.border, backgroundColor: theme.softSurface }]} onPress={() => setProposalOpen(true)}>
              <View style={styles.ideaText}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Neue Aktivität vorschlagen</Text>
                <Text style={[styles.ideaNote, { color: theme.muted }]}>Standort, Sportart, Wetter und Gruppengröße Schritt für Schritt erfassen.</Text>
              </View>
              <Text style={[styles.itemArrow, { color: theme.accent }]}>+</Text>
            </Pressable>

            {proposalOpen ? (
            <Modal visible transparent animationType="fade" onRequestClose={() => setProposalOpen(false)}>
              <KeyboardAvoidingView behavior={undefined} style={styles.modalRoot}>
                <View style={[styles.modalSheet, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                  <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.card, styles.formSheet, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Pressable style={[styles.floatingCloseButton, { backgroundColor: theme.softSurface }]} onPress={() => setProposalOpen(false)}>
                <MaterialCommunityIcons name="close" size={20} color={theme.text} />
              </Pressable>
              <View style={styles.sheetHeader}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Neue Aktivität vorschlagen</Text>
                <Pressable style={[styles.closeSheetButton, { backgroundColor: theme.surface }]} onPress={() => setProposalOpen(false)}>
                  <MaterialCommunityIcons name="close" size={20} color={theme.text} />
                </Pressable>
              </View>
              <WizardQuestion step={activeStep} sportName={activeSport?.name ?? null} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.stepConfirmBadge,
                  {
                    backgroundColor: theme.button,
                    opacity: confirmationPulse,
                    transform: [
                      {
                        scale: confirmationPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.86, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons name="check" size={18} color={theme.inverse} />
              </Animated.View>
              <View style={[styles.stepIntro, { backgroundColor: theme.softSurface }]}>
                <Text style={[styles.stepIntroKicker, { color: theme.accent }]}>Schritt {activeStepIndex + 1} von {currentFlowSteps.length}</Text>
                <Text style={[styles.stepIntroText, { color: theme.muted }]}>{stepHelper(activeStep)}</Text>
              </View>
              <View style={styles.progressBarRow}>
                {currentFlowSteps.map((step, index) => {
                  const passed = index <= activeStepIndex;
                  return (
                    <Pressable
                      key={step.id}
                      accessibilityLabel={step.label}
                      style={[styles.progressBarSegment, { backgroundColor: passed ? theme.accent : theme.softSurface, borderColor: theme.border }]}
                      onPress={() => setActiveStep(step.id)}
                    />
                  );
                })}
              </View>
              <View style={styles.stepRow}>
                {currentFlowSteps.map((step) => {
                  const active = activeStep === step.id;
                  return (
                    <Pressable key={step.id} style={[styles.stepChip, { backgroundColor: active ? theme.button : theme.surface }]} onPress={() => setActiveStep(step.id)}>
                      <Text style={[styles.stepText, { color: active ? theme.inverse : theme.text }]}>{step.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedSportIds.length > 1 && activeStep !== "sport" ? (
                <View style={[styles.subflowPanel, { backgroundColor: theme.softSurface }]}>
                  <Text style={[styles.subflowKicker, { color: theme.muted }]}>Profilangaben pro Sportart</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subflowChipRow}>
                    {selectedSportIds.map((sportId) => {
                      const sport = sports.find((entry) => entry.id === sportId);
                      const active = activeSportId === sportId;
                      return (
                        <Pressable key={sportId} style={[styles.subflowChip, { backgroundColor: active ? theme.button : theme.surface, borderColor: theme.border }]} onPress={() => selectActiveSport(sportId)}>
                          {sport ? <SportIconBadge sport={sport} size={24} /> : null}
                          <Text style={[styles.subflowChipText, { color: active ? theme.inverse : theme.text }]}>{sport?.name ?? "Sportart"}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {activeStep === "location" ? (
                <View style={styles.formGrid}>
                  <SegmentedControl
                    label="Standort"
                    value={draft.locationMode}
                    onChange={(locationMode) => setDraft((current) => ({ ...current, locationMode }))}
                    options={[
                      { value: "fixed", label: "Fest", helper: "Exakte Stelle" },
                      { value: "flexible", label: "Flexibel", helper: "Stadt oder PLZ" },
                    ]}
                  />
                  {draft.locationMode === "fixed" ? (
                    <MapLocationPicker
                      required
                      location={draft.location}
                      mapUrl={draft.mapUrl}
                      latitude={draft.latitude}
                      longitude={draft.longitude}
                      error={errors.location ?? errors.coordinates}
                      onLocationChange={(location) => setDraft((current) => ({ ...current, location }))}
                      onMapUrlChange={(mapUrl) => setDraft((current) => ({ ...current, mapUrl }))}
                      onCoordinatesChange={({ latitude, longitude }) => setDraft((current) => ({ ...current, latitude, longitude }))}
                      showNameInput={false}
                      onConfirmed={() => goToStepWithFeedback("locationName")}
                    />
                  ) : (
                    <>
                      <LabeledInput label="Stadt" required value={draft.locationCity} onChangeText={(locationCity) => setDraft((current) => ({ ...current, locationCity }))} placeholder="z. B. Konstanz" error={errors.locationCity} />
                      <LabeledInput label="PLZ" value={draft.postalCode} onChangeText={(postalCode) => setDraft((current) => ({ ...current, postalCode }))} placeholder="z. B. 78462" keyboardType="number-pad" inputMode="numeric" />
                    </>
                  )}
                </View>
              ) : null}

              {activeStep === "locationName" ? (
                <View style={styles.formGrid}>
                  <LabeledInput
                    label="Kurzname des Standorts"
                    required
                    value={draft.location}
                    onChangeText={(location) => setDraft((current) => ({ ...current, location }))}
                    onSubmitEditing={() => {
                      if (draft.location.trim()) goToNextStep();
                    }}
                    placeholder="z. B. Hörnle, Schänzleplatz, Uni-Sporthalle"
                    returnKeyType="next"
                    error={errors.location}
                  />
                </View>
              ) : null}

              {activeStep === "sport" ? (
                <View style={styles.formGrid}>
                  <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart suchen" />
                  <View style={styles.choiceGrid}>
                    {filteredSports.map((sport) => {
                      const active = selectedSportIds.includes(sport.id);
                      return (
                        <Pressable key={sport.id} style={[styles.choiceChip, styles.sportChoiceChip, { backgroundColor: active ? theme.button : theme.surface }]} onPress={() => toggleSportChoice(sport)}>
                          <SportIconBadge sport={sport} size={22} />
                          <Text style={[styles.choiceText, { color: active ? theme.inverse : theme.text }]}>{sport.name}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={[styles.choiceChip, styles.plusChoice, { backgroundColor: draft.requestedSportName ? theme.button : theme.surface }]} onPress={() => {
                      setRequestSportOpen(true);
                      setDraft((current) => ({ ...current, sportId: "", sportIds: [], activeSportId: null, sportDetails: {}, name: "", requestedSportName: current.requestedSportName }));
                    }}>
                      <Text style={[styles.choiceText, { color: draft.requestedSportName ? theme.inverse : theme.text }]}>+</Text>
                    </Pressable>
                  </View>
                  {errors.sport ? <Text style={styles.notice}>{errors.sport}</Text> : null}
                  {selectedSportIds.length > 0 ? (
                    <View style={[styles.subflowPanel, { backgroundColor: theme.softSurface }]}>
                      <Text style={[styles.subflowKicker, { color: theme.muted }]}>Ausgewählt</Text>
                      <View style={styles.subflowChipRow}>
                        {selectedSportIds.map((sportId) => {
                          const sport = sports.find((entry) => entry.id === sportId);
                          return (
                            <Pressable key={sportId} style={[styles.subflowChip, { backgroundColor: activeSportId === sportId ? theme.button : theme.surface, borderColor: theme.border }]} onPress={() => selectActiveSport(sportId)}>
                              {sport ? <SportIconBadge sport={sport} size={22} /> : null}
                              <Text style={[styles.subflowChipText, { color: activeSportId === sportId ? theme.inverse : theme.text }]}>{sport?.name ?? "Sportart"}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  {requestSportOpen || draft.requestedSportName ? (
                    <LabeledInput
                      label="Neue Sportart anfragen"
                      required
                      value={draft.requestedSportName}
                      onChangeText={(requestedSportName) => setDraft((current) => ({ ...current, requestedSportName, sportId: "", sportIds: [], activeSportId: null, sportDetails: {}, name: requestedSportName }))}
                      placeholder="z. B. Pickleball, Spikeball, Klettern"
                    />
                  ) : null}
                </View>
              ) : null}

              {activeStep === "type" ? (
                <View style={styles.formGrid}>
                  <SegmentedControl
                    value={activeSportDetail.locationType ?? "flexible"}
                    onChange={(locationType) => updateActiveSportDetail({ locationType })}
                    options={[
                      { value: "outdoor", label: "Outdoor", helper: "unter freiem Himmel" },
                      { value: "indoor", label: "Indoor", helper: "wetterunabhängig" },
                      { value: "water", label: "Wasser", helper: "See, Bad, Fluss" },
                      { value: "field", label: "Feld", helper: "Platz oder Spielfeld" },
                      { value: "flexible", label: "Flexibel", helper: "mehrere Varianten" },
                    ]}
                  />
                  {errors.locationType ? <Text style={styles.notice}>{errors.locationType}</Text> : null}
                </View>
              ) : null}

              {activeStep === "group" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Mindestanzahl" required value={activeSportDetail.minimumGroupSize} onChangeText={(minimumGroupSize) => updateActiveSportDetail({ minimumGroupSize: digitsOnly(minimumGroupSize) })} placeholder="z. B. 4" keyboardType="number-pad" inputMode="numeric" error={errors.minimumGroupSize} />
                  <LabeledInput label="Maximalanzahl" value={activeSportDetail.maximumGroupSize} onChangeText={(maximumGroupSize) => updateActiveSportDetail({ maximumGroupSize: digitsOnly(maximumGroupSize) })} placeholder="z. B. 12, leer lassen wenn offen" keyboardType="number-pad" inputMode="numeric" error={errors.maximumGroupSize} />
                  <DetailLine label="Gruppe" value={groupLabel(activeSportDetail)} />
                </View>
              ) : null}

              {activeStep === "weather" ? (
                <View style={styles.formGrid}>
                  {activeSportDetail.locationType === "indoor" ? (
                    <Text style={[styles.ideaNote, { color: theme.muted }]}>Indoor-Profile werden wetterseitig stabil bewertet. Regen und Temperatur müssen hier nicht gepflegt werden.</Text>
                  ) : (
                    <>
                      <SegmentedControl
                        label="Regen"
                        value={activeSportDetail.rainMode}
                        onChange={(rainMode) => updateActiveSportDetail({ rainMode })}
                        options={[
                          { value: "ok", label: "Regen egal", helper: "z. B. Laufgruppe" },
                          { value: "sensitive", label: "Lieber trocken", helper: "leichter Malus" },
                          { value: "dry", label: "Nur trocken", helper: "starker Malus bei Regen" },
                        ]}
                      />
                      <SegmentedControl
                        label="Temperatur"
                        value={activeSportDetail.temperatureMode}
                        onChange={(temperatureMode) => updateActiveSportDetail({ temperatureMode })}
                        options={[
                          { value: "any", label: "Egal", helper: "keine Gewichtung" },
                          { value: "moderate", label: "Mild", helper: "nicht heiß, nicht kalt" },
                          { value: "warm", label: "Soll warm sein", helper: "z. B. Schwimmen" },
                          { value: "cool", label: "Soll kalt sein", helper: "z. B. Wintersport" },
                        ]}
                      />
                    </>
                  )}
                </View>
              ) : null}

              {false && activeStep === "equipment" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Mitzubringen" value={draft.requiredEquipment} onChangeText={(requiredEquipment) => setDraft((current) => ({ ...current, requiredEquipment }))} placeholder="z. B. Schläger, Matte, Trinkflasche" />
                  <LabeledInput label="Vor Ort vorhanden" value={draft.availableEquipment} onChangeText={(availableEquipment) => setDraft((current) => ({ ...current, availableEquipment }))} placeholder="z. B. Netz, Tore, Matten" />
                  <LabeledInput label="Öffnungszeiten" value={draft.openingNotes} onChangeText={(openingNotes) => setDraft((current) => ({ ...current, openingNotes }))} placeholder="z. B. frei zugänglich oder Mo-Fr bis 22 Uhr" multiline />
                  <LabeledInput label="Kosten" value={draft.costNote} onChangeText={(costNote) => setDraft((current) => ({ ...current, costNote }))} placeholder="z. B. kostenlos oder 5 EUR Hallenanteil" />
                  <LabeledInput label="Anreise" value={draft.transitNotes} onChangeText={(transitNotes) => setDraft((current) => ({ ...current, transitNotes }))} placeholder="z. B. Buslinie 9, Radweg, wenige Parkplätze" multiline />
                  <LabeledInput label="Infrastruktur" value={draft.amenityNotes} onChangeText={(amenityNotes) => setDraft((current) => ({ ...current, amenityNotes }))} placeholder="z. B. Toiletten, Wasserstelle, Umkleiden" multiline />
                  <LabeledInput label="Regeln/Sicherheit" value={draft.safetyNotes} onChangeText={(safetyNotes) => setDraft((current) => ({ ...current, safetyNotes }))} placeholder="z. B. bei Nässe rutschig, Helm empfohlen" multiline />
                  <View style={styles.choiceGrid}>
                    <ToggleChip label="Reservierung nötig" value={draft.reservationRequired === true} onPress={() => setDraft((current) => ({ ...current, reservationRequired: current.reservationRequired === true ? null : true }))} />
                    <ToggleChip label="Ansprechpartner vor Ort nötig" value={draft.apRequired} onPress={() => setDraft((current) => ({ ...current, apRequired: !current.apRequired }))} />
                  </View>
                </View>
              ) : null}

              {activeStep === "equipment" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Was sollte man mitbringen?" value={activeSportDetail.requiredEquipment} onChangeText={(requiredEquipment) => updateActiveSportDetail({ requiredEquipment })} placeholder="z. B. Schläger, Matte, Trinkflasche" />
                </View>
              ) : null}

              {activeStep === "available" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Was ist vor Ort vorhanden?" value={activeSportDetail.availableEquipment} onChangeText={(availableEquipment) => updateActiveSportDetail({ availableEquipment })} placeholder="z. B. Netz, Tore, Matten, Bälle" />
                  <View style={styles.choiceGrid}>
                    <ToggleChip label="Licht vorhanden" value={activeSportDetail.lightingAvailable === true} onPress={() => updateActiveSportDetail({ lightingAvailable: activeSportDetail.lightingAvailable === true ? null : true })} />
                  </View>
                </View>
              ) : null}

              {activeStep === "schedule" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Wann ist der Standort nutzbar?" value={activeSportDetail.openingNotes} onChangeText={(openingNotes) => updateActiveSportDetail({ openingNotes })} placeholder="z. B. frei zugänglich oder Mo-Fr bis 22 Uhr" multiline />
                  <View style={styles.choiceGrid}>
                    <ToggleChip label="Reservierung nötig" value={activeSportDetail.reservationRequired === true} onPress={() => updateActiveSportDetail({ reservationRequired: activeSportDetail.reservationRequired === true ? null : true })} />
                    <ToggleChip
                      label="Kostenpflichtig"
                      value={activeCostOpen}
                      onPress={() => {
                        setActiveSportCostOpen(!activeCostOpen);
                      }}
                    />
                  </View>
                  {activeCostOpen ? (
                    <LabeledInput
                      label="Preis pro Person"
                      value={activeSportDetail.costNote}
                      onChangeText={(costNote) => updateActiveSportDetail({ costNote })}
                      placeholder="z. B. 5 EUR Hallenanteil oder Eintritt nach Tarif"
                    />
                  ) : null}
                </View>
              ) : null}

              {activeStep === "logistics" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Wie kommt man gut hin?" value={activeSportDetail.transitNotes} onChangeText={(transitNotes) => updateActiveSportDetail({ transitNotes })} placeholder="z. B. Buslinie 9, Radweg, wenige Parkplätze" multiline />
                  <LabeledInput label="Welche Infrastruktur gibt es?" value={activeSportDetail.amenityNotes} onChangeText={(amenityNotes) => updateActiveSportDetail({ amenityNotes })} placeholder="z. B. Toiletten, Wasserstelle, Umkleiden" multiline />
                  <LabeledInput label="Regeln oder Sicherheit" value={activeSportDetail.safetyNotes} onChangeText={(safetyNotes) => updateActiveSportDetail({ safetyNotes })} placeholder="z. B. bei Nässe rutschig, Helm empfohlen" multiline />
                  <View style={styles.choiceGrid}>
                    <ToggleChip label="Ansprechpartner vor Ort nötig" value={activeSportDetail.apRequired} onPress={() => updateActiveSportDetail({ apRequired: !activeSportDetail.apRequired })} />
                  </View>
                </View>
              ) : null}

              {activeStep === "review" ? (
                <View style={styles.formGrid}>
                  <DetailLine label="Sportarten" value={ideaNameFromDraft(draft, sports) || "Noch offen"} />
                  <DetailLine label="Profil" value={buildProfileName(draft, sports)} />
                  <DetailLine label="Standort" value={draftLocationLabel(draft)} />
                  {selectedSportIds.length > 1 ? (
                    <View style={styles.reviewSportList}>
                      {selectedSportIds.map((sportId) => {
                        const detail = sportDetailForDraft(draft, sportId);
                        const sport = sports.find((entry) => entry.id === sportId);
                        return (
                          <View key={sportId} style={[styles.reviewSportCard, { backgroundColor: theme.softSurface }]}>
                            <Text style={[styles.reviewSportTitle, { color: theme.text }]}>{sport?.name ?? "Sportart"}</Text>
                            <DetailLine label="Gruppe" value={groupLabel(detail)} />
                            <DetailLine label="Wetter" value={weatherSummary(detail)} />
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <>
                      <DetailLine label="Gruppe" value={groupLabel(activeSportDetail)} />
                      <DetailLine label="Wetter" value={weatherSummary(activeSportDetail)} />
                    </>
                  )}
                  <LabeledInput label="Kurzbeschreibung" value={draft.note} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} placeholder="Was muss man wissen?" multiline />
                </View>
              ) : null}

              <View style={styles.wizardActions}>
                <Pressable style={[styles.draftMiniButton, { borderColor: theme.border, backgroundColor: theme.softSurface }, (!canSaveDraft || busy) && styles.disabled]} onPress={saveDraft} disabled={!canSaveDraft || busy}>
                  <MaterialCommunityIcons name="content-save-outline" size={15} color={theme.text} />
                  <Text style={[styles.draftMiniText, { color: theme.text }]}>Entwurf speichern</Text>
                </Pressable>
                <View style={styles.wizardNavRow}>
                  <Pressable style={[styles.wizardNavButton, { borderColor: theme.border, backgroundColor: theme.softSurface }, (!canGoPrevious || busy) && styles.disabled]} onPress={goToPreviousStep} disabled={!canGoPrevious || busy}>
                    <MaterialCommunityIcons name="arrow-left" size={18} color={theme.text} />
                    <Text style={[styles.wizardNavText, { color: theme.text }]}>Zurück</Text>
                  </Pressable>
                  <Pressable style={[styles.wizardNavButton, { backgroundColor: theme.button }, busy && styles.disabled]} onPress={canGoNext ? goToNextStep : submit} disabled={busy}>
                    <Text style={[styles.wizardNavText, { color: theme.inverse }]}>{canGoNext ? "Weiter" : "Einreichen"}</Text>
                    <MaterialCommunityIcons name={canGoNext ? "arrow-right" : "check"} size={18} color={theme.inverse} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.hiddenActionRow}>
                <Button label="Entwurf speichern" variant="secondary" onPress={saveDraft} disabled={!canSaveDraft || busy} />
                {canGoPrevious ? <Button label="Zurück" variant="secondary" onPress={goToPreviousStep} disabled={busy} /> : null}
                {canGoNext ? <Button label="Weiter" onPress={goToNextStep} disabled={busy} /> : <Button label="Einreichen" onPress={submit} disabled={busy} />}
              </View>
            </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </Modal>
            ) : null}

            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Pressable style={styles.queueHeader} onPress={() => setQueueOpen((open) => !open)}>
                <View style={styles.ideaText}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Warteschlange</Text>
                  <Text style={[styles.ideaNote, { color: theme.muted }]}>
                    {queueIdeas.length} offen · {approvedIdeas.length} freigegeben · {rejectedIdeas.length} abgelehnt
                  </Text>
                </View>
                <MaterialCommunityIcons name={queueOpen ? "chevron-up" : "chevron-down"} size={24} color={theme.muted} />
              </Pressable>

              {queueOpen ? (
                <View style={styles.formGrid}>
                  {queueIdeas.length === 0 ? <Text style={[styles.body, { color: theme.muted }]}>Keine offenen Ideen.</Text> : null}
                  {queueIdeas.map((idea) => (
                    <IdeaQueueRow
                      key={idea.id}
                      idea={idea}
                      opened={expandedIdeaId === idea.id}
                      currentUserId={user.id}
                      isAdmin={isAdmin}
                      onToggle={() => setExpandedIdeaId(expandedIdeaId === idea.id ? null : idea.id)}
                      onContinue={() => continueIdea(idea)}
                      onApprove={() => reviewIdea(idea, "approved")}
                      onReject={() => reviewIdea(idea, "rejected")}
                    />
                  ))}

                  <ArchiveToggle title="Freigegeben" count={approvedIdeas.length} open={approvedOpen} onPress={() => setApprovedOpen((open) => !open)} />
                  {approvedOpen ? (
                    approvedIdeas.length > 0 ? approvedIdeas.map((idea) => (
                      <IdeaQueueRow
                        key={idea.id}
                        idea={idea}
                        opened={expandedIdeaId === idea.id}
                        currentUserId={user.id}
                        isAdmin={false}
                        onToggle={() => setExpandedIdeaId(expandedIdeaId === idea.id ? null : idea.id)}
                        onContinue={() => continueIdea(idea)}
                        onApprove={() => reviewIdea(idea, "approved")}
                        onReject={() => reviewIdea(idea, "rejected")}
                      />
                    )) : <Text style={[styles.body, { color: theme.muted }]}>Noch nichts freigegeben.</Text>
                  ) : null}

                  <ArchiveToggle title="Abgelehnt" count={rejectedIdeas.length} open={rejectedOpen} onPress={() => setRejectedOpen((open) => !open)} />
                  {rejectedOpen ? (
                    rejectedIdeas.length > 0 ? rejectedIdeas.map((idea) => (
                      <IdeaQueueRow
                        key={idea.id}
                        idea={idea}
                        opened={expandedIdeaId === idea.id}
                        currentUserId={user.id}
                        isAdmin={false}
                        onToggle={() => setExpandedIdeaId(expandedIdeaId === idea.id ? null : idea.id)}
                        onContinue={() => continueIdea(idea)}
                        onApprove={() => reviewIdea(idea, "approved")}
                        onReject={() => reviewIdea(idea, "rejected")}
                      />
                    )) : <Text style={[styles.body, { color: theme.muted }]}>Noch nichts abgelehnt.</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function ToggleChip({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={[styles.choiceChip, { backgroundColor: value ? theme.button : theme.surface }]} onPress={onPress}>
      <Text style={[styles.choiceText, { color: value ? theme.inverse : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function WizardQuestion({ step, sportName }: { step: IdeaFlowStep; sportName: string | null }) {
  const { theme } = useTheme();
  const question = stepQuestionParts(step, sportName);
  return (
    <Text style={[styles.wizardQuestion, { color: theme.text }]}>
      {question.prefix}
      {question.highlight ? <Text style={{ color: theme.accent }}>{question.highlight}</Text> : null}
      {question.suffix}
    </Text>
  );
}

function DraftIconButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={[styles.draftIconButton, { borderColor: theme.accent, backgroundColor: theme.softSurface }]} onPress={onPress}>
      <Text style={[styles.draftIconText, { color: theme.accent }]}>!</Text>
    </Pressable>
  );
}

function ArchiveToggle({ title, count, open, onPress }: { title: string; count: number; open: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={[styles.archiveToggle, { backgroundColor: theme.surface }]} onPress={onPress}>
      <Text style={[styles.archiveTitle, { color: theme.text }]}>{title}</Text>
      <View style={styles.archiveMeta}>
        <Text style={[styles.archiveCount, { color: theme.muted }]}>{count}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={theme.muted} />
      </View>
    </Pressable>
  );
}

function IdeaQueueRow({
  idea,
  opened,
  currentUserId,
  isAdmin,
  onToggle,
  onContinue,
  onApprove,
  onReject,
}: {
  idea: SportIdeaWithCreator;
  opened: boolean;
  currentUserId: string;
  isAdmin: boolean;
  onToggle: () => void;
  onContinue: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.ideaRow, { borderTopColor: theme.border }]}>
      <Pressable style={styles.ideaHeader} onPress={onToggle}>
        <View style={styles.ideaText}>
          <Text style={[styles.ideaName, { color: theme.text }]}>{idea.name ?? idea.profile_name ?? "Entwurf ohne Namen"}</Text>
          <Text style={[styles.ideaMeta, { color: theme.accent }]}>{ideaLocationLabel(idea)} - {idea.creatorName}</Text>
          <Text style={[styles.ideaNote, { color: theme.muted }]}>{ideaStatusLabel(idea)}</Text>
        </View>
        <MaterialCommunityIcons name={opened ? "chevron-up" : "chevron-right"} size={22} color={theme.muted} />
      </Pressable>
      {opened ? (
        <View style={styles.formGrid}>
          <IdeaDetails idea={idea} />
          {idea.status === "rejected" ? <DetailLine label="Begründung" value={idea.review_note ?? "Noch keine Begründung hinterlegt."} /> : null}
          {idea.is_draft && idea.suggested_by === currentUserId ? <Button label="Entwurf fortsetzen" variant="secondary" onPress={onContinue} /> : null}
          {isAdmin && !idea.is_draft && idea.status === "pending" ? (
            <View style={styles.actionRow}>
              <Button label="Freigeben" onPress={onApprove} />
              <Button label="Ablehnen" variant="ghost" onPress={onReject} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function stepHelper(step: IdeaFlowStep): string {
  if (step === "location") return "Kurzname, Suche oder Karte: Danach ist klar, wo die Aktivität stattfinden kann.";
  if (step === "locationName") return "Der kurze Name erscheint später in Sportlisten und Events.";
  if (step === "sport") return "Wähle die abstrakte Sportart. Falls sie fehlt, frage sie mit dem Plus direkt mit an.";
  if (step === "type") return "Die Profilart steuert, welche Wetter- und Praxisfragen überhaupt relevant sind.";
  if (step === "group") return "Die Gruppengröße hilft dem Algorithmus, faire und praktikable Konstellationen zu bauen.";
  if (step === "weather") return "Nur das eintragen, was für diesen Standort wirklich relevant ist. Indoor bleibt bewusst kurz.";
  if (step === "equipment") return "Alles, was die Gruppe selbst mitbringen sollte.";
  if (step === "available") return "Alles, was am Ort schon vorhanden ist, inklusive Licht.";
  if (step === "schedule") return "Zeitfenster und Reservierung, damit niemand vor verschlossener Tür steht.";
  if (step === "logistics") return "Anreise, Infrastruktur und Sicherheitsinfos für die spätere Eventplanung.";
  return "Kontrolliere die Zusammenfassung und ergänze nur noch einen kurzen Hinweis.";
}

function stepQuestion(step: IdeaFlowStep): string {
  if (step === "location") return "Wo findet die Aktivität statt?";
  if (step === "locationName") return "Wie soll der Standort kurz heißen?";
  if (step === "sport") return "Welche Sportart passt zu diesem Standort?";
  if (step === "type") return "Welche Art von Profil ist das?";
  if (step === "group") return "Wie viele Personen passen gut dazu?";
  if (step === "weather") return "Welches Wetter ist relevant?";
  if (step === "equipment") return "Was sollte man mitbringen?";
  if (step === "available") return "Was ist vor Ort schon vorhanden?";
  if (step === "schedule") return "Wann kann man den Standort nutzen?";
  if (step === "logistics") return "Wie kommt man hin und was muss man wissen?";
  return "Passt alles so?";
}

function stepQuestionParts(step: IdeaFlowStep, sportName: string | null): { prefix: string; highlight?: string; suffix: string } {
  if (!sportName) return { prefix: stepQuestion(step), suffix: "" };
  if (step === "type") return { prefix: "Welche Art von Profil ist ", highlight: sportName, suffix: "?" };
  if (step === "group") return { prefix: "Wie viele Personen passen zu ", highlight: sportName, suffix: "?" };
  if (step === "weather") return { prefix: "Welches Wetter ist für ", highlight: sportName, suffix: " relevant?" };
  if (step === "equipment") return { prefix: "Was sollte man für ", highlight: sportName, suffix: " mitbringen?" };
  if (step === "available") return { prefix: "Was ist für ", highlight: sportName, suffix: " vor Ort vorhanden?" };
  if (step === "schedule") return { prefix: "Wann kann man ", highlight: sportName, suffix: " dort nutzen?" };
  if (step === "logistics") return { prefix: "Wie kommt man zu ", highlight: sportName, suffix: " hin?" };
  return { prefix: stepQuestion(step), suffix: "" };
}

function isSportSpecificStep(step: IdeaFlowStep): boolean {
  return ["type", "group", "weather", "equipment", "available", "schedule", "logistics"].includes(step);
}

function persistedDraftStep(step: IdeaFlowStep): SportIdeaDraftStep {
  if (step === "location" || step === "locationName") return "location";
  if (step === "review") return "review";
  if (step === "equipment" || step === "available" || step === "schedule" || step === "logistics" || step === "weather") return "optional";
  return "essentials";
}

function sortIdeasForUser(ideas: SportIdeaWithCreator[], userId: string | null): SportIdeaWithCreator[] {
  return [...ideas].sort((a, b) => {
    const aOwnDraft = Boolean(userId && a.suggested_by === userId && a.is_draft);
    const bOwnDraft = Boolean(userId && b.suggested_by === userId && b.is_draft);
    if (aOwnDraft !== bOwnDraft) return aOwnDraft ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function groupProfilesBySport(profiles: Row<"sport_profiles">[], links: Row<"sport_profile_sports">[]): Map<string, Row<"sport_profiles">[]> {
  const result = new Map<string, Row<"sport_profiles">[]>();
  for (const profile of profiles.filter((entry) => entry.is_active)) {
    const linkedSportIds = links.filter((link) => link.profile_id === profile.id).map((link) => link.sport_id);
    const sportIds = linkedSportIds.length > 0 ? linkedSportIds : [profile.sport_id];
    for (const sportId of sportIds) {
      const next = result.get(sportId) ?? [];
      next.push(profile);
      result.set(sportId, next);
    }
  }
  return result;
}

function profileIsLinkedToSport(profile: Row<"sport_profiles">, sportId: string, links: Row<"sport_profile_sports">[]): boolean {
  const profileLinks = links.filter((link) => link.profile_id === profile.id);
  if (profileLinks.length === 0) return profile.sport_id === sportId;
  return profileLinks.some((link) => link.sport_id === sportId);
}

function sportProfileEventName(sportName: string, profile: Row<"sport_profiles">): string {
  const profileName = profile.name.trim();
  if (profileName.toLowerCase().includes(sportName.toLowerCase())) return profileName;

  const location = profile.location_name || profile.location_city;
  if (!location) return `${sportName} · ${profileName}`;

  return `${sportName} ${locationPreposition(location, profile.location_type)} ${location}`;
}

function profileLocationText(profile: Row<"sport_profiles">): string {
  return [profile.location_name, profile.location_city, profile.location_type, profile.minimum_group_size ? `ab ${profile.minimum_group_size} Personen` : null]
    .filter(Boolean)
    .join(" · ");
}

function profileMapTarget(profile: Row<"sport_profiles">) {
  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    mapUrl: profile.map_url,
    label: [profile.location_name, profile.location_city, profile.postal_code].filter(Boolean).join(" "),
  };
}

function locationPreposition(location: string, type: SportLocationType): string {
  const lower = location.toLowerCase();
  if (type === "water" || lower.includes("see") || lower.includes("rhein") || lower.includes("ufer")) return "am";
  if (lower.includes("park") || lower.includes("halle") || lower.includes("platz") || lower.includes("schänzle")) return "im";
  return "in";
}

function IdeaDetails({ idea }: { idea: SportIdeaWithCreator }) {
  return (
    <View style={styles.formGrid}>
      <DetailLine label="Ersteller" value={idea.creatorName} />
      <DetailLine label="Sportarten" value={ideaSportNames(idea)} />
      <DetailLine label="Profil" value={idea.profile_name} />
      <DetailLine label="Standort" value={ideaLocationLabel(idea)} />
      <DetailLine label="Gruppe" value={idea.minimum_group_size ? `${idea.minimum_group_size}${idea.maximum_group_size ? ` bis ${idea.maximum_group_size}` : "+"} Personen` : null} />
      <DetailLine label="Wetter" value={weatherSummary(ideaToDraft(idea))} />
      <DetailLine label="Ausstattung" value={(idea.required_equipment ?? []).join(", ")} />
      <DetailLine label="Hinweise" value={[idea.note, idea.cost_note, idea.transit_notes, idea.amenity_notes, idea.safety_notes].filter(Boolean).join(" - ")} />
    </View>
  );
}

function ideaToDraft(idea: Row<"sport_ideas"> & Partial<SportIdeaWithCreator>): IdeaDraft {
  const weather = weatherRules(idea.weather_rules);
  const sportIds = ideaSportIds(idea);
  const sportDetail: SportSpecificDraft = {
    locationType: idea.location_type ?? null,
    minimumGroupSize: idea.minimum_group_size ? String(idea.minimum_group_size) : "",
    maximumGroupSize: idea.maximum_group_size ? String(idea.maximum_group_size) : "",
    requiredEquipment: (idea.required_equipment ?? []).join(", "),
    availableEquipment: (idea.available_equipment ?? []).join(", "),
    costNote: idea.cost_note ?? "",
    openingNotes: idea.opening_notes ?? "",
    transitNotes: idea.transit_notes ?? "",
    amenityNotes: idea.amenity_notes ?? "",
    reservationRequired: idea.reservation_required,
    lightingAvailable: idea.lighting_available,
    safetyNotes: idea.safety_notes ?? "",
    locationRules: idea.location_rules ?? "",
    apRequired: idea.ap_required ?? false,
    rainMode: weather.requiresDry ? "dry" : weather.rainSensitive ? "sensitive" : "ok",
    temperatureMode: weather.heatSensitive && weather.coldSensitive ? "moderate" : weather.coldSensitive ? "warm" : weather.heatSensitive ? "cool" : "any",
    thunderstormUnsafe: weather.thunderstormUnsafe ?? true,
  };
  return {
    ideaId: idea.id,
    name: idea.name ?? "",
    requestedSportName: sportIds.length > 0 ? "" : idea.name ?? "",
    sportId: sportIds[0] ?? "",
    sportIds,
    activeSportId: sportIds[0] ?? null,
    sportDetails: Object.fromEntries(sportIds.map((sportId) => [sportId, sportDetail])),
    profileName: idea.profile_name ?? idea.name ?? "",
    note: idea.note ?? "",
    locationMode: idea.location_mode ?? "fixed",
    location: idea.location ?? "",
    postalCode: idea.postal_code ?? "",
    locationCity: idea.location_city ?? "",
    mapUrl: idea.map_url ?? "",
    latitude: idea.latitude ?? null,
    longitude: idea.longitude ?? null,
    preferredTime: idea.preferred_time ?? "",
    locationType: idea.location_type ?? null,
    minimumGroupSize: idea.minimum_group_size ? String(idea.minimum_group_size) : "",
    maximumGroupSize: idea.maximum_group_size ? String(idea.maximum_group_size) : "",
    requiredEquipment: (idea.required_equipment ?? []).join(", "),
    availableEquipment: (idea.available_equipment ?? []).join(", "),
    costNote: idea.cost_note ?? "",
    openingNotes: idea.opening_notes ?? "",
    transitNotes: idea.transit_notes ?? "",
    amenityNotes: idea.amenity_notes ?? "",
    reservationRequired: idea.reservation_required,
    lightingAvailable: idea.lighting_available,
    safetyNotes: idea.safety_notes ?? "",
    locationRules: idea.location_rules ?? "",
    apRequired: idea.ap_required ?? false,
    rainMode: weather.requiresDry ? "dry" : weather.rainSensitive ? "sensitive" : "ok",
    temperatureMode: weather.heatSensitive && weather.coldSensitive ? "moderate" : weather.coldSensitive ? "warm" : weather.heatSensitive ? "cool" : "any",
    thunderstormUnsafe: weather.thunderstormUnsafe ?? true,
    suggestedBy: idea.suggested_by ?? null,
  };
}

function draftToInput(draft: IdeaDraft, userId: string, draftStep: SportIdeaDraftStep, sports: Row<"sports">[], sportIdOverride?: string | null) {
  const sportId = sportIdOverride ?? draft.sportId;
  const detail = sportDetailForDraft(draft, sportId);
  const name = ideaNameFromDraft(draft, sports, sportIdOverride);
  const profileName = buildProfileName(draft, sports, sportIdOverride);
  return {
    ideaId: draft.ideaId,
    userId: draft.suggestedBy ?? userId,
    name,
    sportId,
    sportIds: sportId ? [sportId] : draft.sportIds,
    profileName,
    note: draft.note,
    locationMode: draft.locationMode,
    location: draft.location,
    postalCode: draft.postalCode,
    locationCity: draft.locationCity,
    mapUrl: draft.mapUrl,
    latitude: draft.latitude,
    longitude: draft.longitude,
    preferredTime: draft.preferredTime,
    locationType: detail.locationType,
    minimumGroupSize: parseOptionalInteger(detail.minimumGroupSize),
    maximumGroupSize: parseOptionalInteger(detail.maximumGroupSize),
    requiredEquipment: parseCsv(detail.requiredEquipment),
    availableEquipment: parseCsv(detail.availableEquipment),
    costNote: detail.costNote,
    openingNotes: detail.openingNotes,
    transitNotes: detail.transitNotes,
    amenityNotes: detail.amenityNotes,
    reservationRequired: detail.reservationRequired,
    lightingAvailable: detail.lightingAvailable,
    safetyNotes: detail.safetyNotes,
    locationRules: detail.locationRules,
    apRequired: detail.apRequired,
    weatherRules: weatherRulesFromDetail(detail),
    draftStep,
  };
}

function requiredErrors(draft: IdeaDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const selectedIds = selectedSportIdsFromDraft(draft);
  if (selectedIds.length === 0 && !draft.requestedSportName.trim()) errors.sport = "Wähle mindestens eine Sportart aus oder frage eine neue an.";
  if (draft.locationMode === "fixed" && !draft.location.trim()) errors.location = "Kurzname des Standorts fehlt.";
  if (draft.locationMode === "fixed" && (!Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude))) errors.coordinates = "Bitte markiere den Standort in der Karte.";
  if (draft.locationMode === "flexible" && !draft.locationCity.trim() && !draft.postalCode.trim()) errors.locationCity = "Stadt oder PLZ fehlt.";
  const detailsToValidate = selectedIds.length > 0 ? selectedIds.map((sportId) => sportDetailForDraft(draft, sportId)) : [sportDetailForDraft(draft, null)];
  for (const detail of detailsToValidate) {
    if (!detail.locationType) errors.locationType = "Profilart fehlt.";
    const min = parseOptionalInteger(detail.minimumGroupSize);
    const max = parseOptionalInteger(detail.maximumGroupSize);
    if (!min || min < 1) errors.minimumGroupSize = "Mindestanzahl fehlt.";
    if (min && max && max < min) errors.maximumGroupSize = "Maximalanzahl muss größer sein.";
    if (errors.locationType || errors.minimumGroupSize || errors.maximumGroupSize) break;
  }
  return errors;
}

function firstMissingSportId(draft: IdeaDraft): string | null {
  for (const sportId of selectedSportIdsFromDraft(draft)) {
    const detail = sportDetailForDraft(draft, sportId);
    const min = parseOptionalInteger(detail.minimumGroupSize);
    const max = parseOptionalInteger(detail.maximumGroupSize);
    if (!detail.locationType || !min || min < 1 || (min && max && max < min)) return sportId;
  }
  return null;
}

function firstMissingStep(errors: Record<string, string>, draft: IdeaDraft): IdeaFlowStep {
  if (errors.coordinates) return "location";
  if (errors.location) return draft.locationMode === "fixed" && Number.isFinite(draft.latitude) && Number.isFinite(draft.longitude) ? "locationName" : "location";
  if (errors.locationCity) return "location";
  if (errors.sport) return "sport";
  if (errors.locationType) return "type";
  if (errors.minimumGroupSize || errors.maximumGroupSize) return "group";
  return "review";
}

function weatherRulesFromDetail(detail: SportSpecificDraft): Json {
  if (detail.locationType === "indoor") {
    return { thunderstormUnsafe: false };
  }
  return {
    requiresDry: detail.rainMode === "dry",
    rainSensitive: detail.rainMode === "sensitive" || detail.rainMode === "dry",
    thunderstormUnsafe: detail.thunderstormUnsafe,
    heatSensitive: detail.temperatureMode === "moderate" || detail.temperatureMode === "cool",
    coldSensitive: detail.temperatureMode === "moderate" || detail.temperatureMode === "warm",
    prefersWarm: detail.temperatureMode === "warm",
    prefersCold: detail.temperatureMode === "cool",
  };
}

function weatherRules(value: Json): Record<string, boolean> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, boolean>) : {};
}

function weatherRulesForProfile(value: Json) {
  const rules = weatherRules(value);
  return {
    requiresDry: Boolean(rules.requiresDry),
    rainSensitive: Boolean(rules.rainSensitive),
    heatSensitive: Boolean(rules.heatSensitive),
    coldSensitive: Boolean(rules.coldSensitive),
    thunderstormUnsafe: rules.thunderstormUnsafe !== false,
  };
}

function ideaSportIds(idea: Pick<Row<"sport_ideas">, "sport_id" | "sport_ids">): string[] {
  return [...new Set([...(idea.sport_ids ?? []), ...(idea.sport_id ? [idea.sport_id] : [])].filter(Boolean))];
}

function ideaSportNames(idea: SportIdeaWithCreator): string | null {
  if (idea.sportNames.length > 0) return idea.sportNames.join(", ");
  return idea.sportName;
}

function asFlowStep(value: string): IdeaFlowStep {
  if (value === "essentials") return "sport";
  if (value === "optional") return "equipment";
  return flowSteps.some((step) => step.id === value) ? (value as IdeaFlowStep) : "location";
}

function parseOptionalInteger(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseCsv(value: string): string[] {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function selectedSportIdsFromDraft(draft: IdeaDraft): string[] {
  const ids = draft.sportIds.length > 0 ? draft.sportIds : draft.sportId ? [draft.sportId] : [];
  return [...new Set(ids.filter(Boolean))];
}

function sportDetailForDraft(draft: IdeaDraft, sportId: string | null | undefined): SportSpecificDraft {
  if (sportId && draft.sportDetails[sportId]) return draft.sportDetails[sportId];
  return {
    locationType: draft.locationType,
    minimumGroupSize: draft.minimumGroupSize,
    maximumGroupSize: draft.maximumGroupSize,
    requiredEquipment: draft.requiredEquipment,
    availableEquipment: draft.availableEquipment,
    costNote: draft.costNote,
    openingNotes: draft.openingNotes,
    transitNotes: draft.transitNotes,
    amenityNotes: draft.amenityNotes,
    reservationRequired: draft.reservationRequired,
    lightingAvailable: draft.lightingAvailable,
    safetyNotes: draft.safetyNotes,
    locationRules: draft.locationRules,
    apRequired: draft.apRequired,
    rainMode: draft.rainMode,
    temperatureMode: draft.temperatureMode,
    thunderstormUnsafe: draft.thunderstormUnsafe,
  };
}

function selectedSportName(sportId: string | null, sports: Row<"sports">[]): string | null {
  return sports.find((sport) => sport.id === sportId)?.name ?? null;
}

function selectedSportNameList(sportIds: string[], sports: Row<"sports">[]): string[] {
  return sportIds.map((sportId) => selectedSportName(sportId, sports)).filter((name): name is string => Boolean(name));
}

function selectedSportNames(sportIds: string[], sports: Row<"sports">[]): string | null {
  const names = selectedSportNameList(sportIds, sports);
  return names.length > 0 ? names.join(", ") : null;
}

function ideaNameFromDraft(draft: IdeaDraft, sports: Row<"sports">[], sportIdOverride?: string | null): string {
  if (sportIdOverride !== undefined) {
    return selectedSportName(sportIdOverride, sports) ?? (draft.requestedSportName.trim() || draft.name.trim());
  }
  const selectedNames = selectedSportIdsFromDraft(draft)
    .map((sportId) => selectedSportName(sportId, sports))
    .filter((name): name is string => Boolean(name));
  if (selectedNames.length > 1) return selectedNames.join(", ");
  return selectedNames[0] ?? (draft.requestedSportName.trim() || draft.name.trim());
}

function buildProfileName(draft: IdeaDraft, sports: Row<"sports">[], sportIdOverride?: string | null): string {
  const sportName = ideaNameFromDraft(draft, sports, sportIdOverride) || "Sportart";
  const location = draftLocationLabel(draft);
  if (!location || location === "Noch offen") return sportName;
  return `${sportName}: ${location}`;
}

function draftLocationLabel(draft: IdeaDraft): string {
  if (draft.locationMode === "flexible") return [draft.postalCode, draft.locationCity || "flexibel"].filter(Boolean).join(" ");
  return draft.location || (draft.latitude && draft.longitude ? `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}` : "Noch offen");
}

function ideaLocationLabel(idea: SportIdeaWithCreator): string {
  if (idea.location_mode === "flexible") return [idea.postal_code, idea.location_city || "flexibel"].filter(Boolean).join(" ");
  return idea.location ?? idea.location_city ?? "Standort offen";
}

function groupLabel(draft: Pick<SportSpecificDraft, "minimumGroupSize" | "maximumGroupSize">): string {
  const min = parseOptionalInteger(draft.minimumGroupSize);
  const max = parseOptionalInteger(draft.maximumGroupSize);
  if (!min) return "Noch offen";
  return `${min}${max ? ` bis ${max}` : "+"} Personen`;
}

function weatherSummary(draft: Pick<SportSpecificDraft, "locationType" | "rainMode" | "temperatureMode">): string {
  if (draft.locationType === "indoor") return "Indoor, wetterstabil";
  const rain = draft.rainMode === "dry" ? "nur trocken" : draft.rainMode === "sensitive" ? "Regen ungünstig" : "Regen okay";
  const temp = draft.temperatureMode === "moderate" ? "milde Temperaturen" : draft.temperatureMode === "warm" ? "soll warm sein" : draft.temperatureMode === "cool" ? "soll kalt sein" : "Temperatur flexibel";
  return `${rain}, ${temp}`;
}

function ideaStatusLabel(idea: SportIdeaWithCreator): string {
  if (idea.is_draft) return "Entwurf";
  if (idea.status === "approved") return "freigegeben";
  if (idea.status === "rejected") return "abgelehnt";
  return "in Prüfung";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  success: { color: "#5eead4", fontSize: 14, fontWeight: "900" },
  modalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 12, backgroundColor: "rgba(0,0,0,0.68)" },
  modalSheet: {
    alignSelf: "center",
    borderRadius: 28,
    borderWidth: 1,
    maxHeight: "88%",
    maxWidth: 680,
    paddingTop: 6,
    width: "100%",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.32,
    shadowRadius: 30,
  },
  modalContent: { gap: 12, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 28 },
  card: { gap: 14, borderRadius: 24, borderWidth: 1, padding: 14 },
  createCard: { alignItems: "center", borderRadius: 24, borderWidth: 1, flexDirection: "row", gap: 12, justifyContent: "space-between", padding: 14 },
  formSheet: { position: "relative", shadowColor: "#000000", shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.18, shadowRadius: 24 },
  sheetHeader: { display: "none" },
  floatingCloseButton: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", position: "absolute", right: 12, top: 12, width: 38, zIndex: 3 },
  closeSheetButton: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", width: 38 },
  wizardQuestion: { minWidth: 0, paddingRight: 48, fontSize: 23, fontWeight: "900", lineHeight: 28 },
  stepConfirmBadge: { alignItems: "center", borderRadius: 999, height: 34, justifyContent: "center", position: "absolute", right: 58, top: 14, width: 34, zIndex: 4 },
  stepIntro: { display: "none" },
  stepIntroKicker: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  stepIntroText: { fontSize: 13, fontWeight: "800", lineHeight: 18 },
  draftBanner: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 12 },
  cardTitle: { fontSize: 21, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 22 },
  formGrid: { gap: 12 },
  progressBarRow: { flexDirection: "row", gap: 6 },
  progressBarSegment: { borderRadius: 999, borderWidth: 1, flex: 1, height: 8, minWidth: 10 },
  stepRow: { display: "none" },
  stepChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  stepText: { fontSize: 12, fontWeight: "900" },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderRadius: 999, flexGrow: 1, minWidth: 96, paddingHorizontal: 11, paddingVertical: 8 },
  sportChoiceChip: { alignItems: "center", flexDirection: "row", gap: 7 },
  plusChoice: { minWidth: 42, alignItems: "center" },
  choiceText: { fontSize: 12, fontWeight: "900" },
  subflowPanel: { borderRadius: 18, gap: 8, padding: 10 },
  subflowKicker: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  subflowChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subflowChip: { alignItems: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 10, paddingVertical: 7 },
  subflowChipText: { fontSize: 12, fontWeight: "900" },
  reviewSportList: { gap: 8 },
  reviewSportCard: { borderRadius: 16, gap: 8, padding: 10 },
  reviewSportTitle: { fontSize: 14, fontWeight: "900" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hiddenActionRow: { display: "none" },
  wizardActions: { alignItems: "center", gap: 10 },
  draftMiniButton: { alignItems: "center", alignSelf: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  draftMiniText: { fontSize: 12, fontWeight: "900" },
  wizardNavRow: { flexDirection: "row", gap: 12, justifyContent: "center", width: "100%" },
  wizardNavButton: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 50, paddingHorizontal: 12, paddingVertical: 12, width: 92 },
  wizardNavText: { display: "none" },
  disabled: { opacity: 0.42 },
  activeSportList: { gap: 8 },
  activeSportBlock: { borderTopWidth: 1, gap: 8, paddingTop: 10 },
  sportTitleRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  profileLine: { borderRadius: 14, gap: 3, paddingHorizontal: 11, paddingVertical: 9 },
  profileLineRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  profileLineText: { flex: 1, minWidth: 0, gap: 3 },
  profileLineTitle: { fontSize: 13, fontWeight: "900", lineHeight: 18 },
  profileLineMeta: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  sportPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  sportPillText: { fontSize: 13, fontWeight: "900" },
  queueHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  archiveToggle: { alignItems: "center", borderRadius: 16, flexDirection: "row", gap: 10, justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  archiveTitle: { fontSize: 13, fontWeight: "900" },
  archiveMeta: { alignItems: "center", flexDirection: "row", gap: 4 },
  archiveCount: { fontSize: 12, fontWeight: "900" },
  ideaRow: { gap: 10, borderTopWidth: 1, paddingTop: 11 },
  ideaHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  ideaText: { flex: 1, minWidth: 0, gap: 3 },
  ideaName: { fontSize: 15, fontWeight: "900" },
  ideaMeta: { fontSize: 13, fontWeight: "900" },
  ideaNote: { fontSize: 13, lineHeight: 18 },
  itemArrow: { fontSize: 20, fontWeight: "900" },
  draftIconButton: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  draftIconText: { fontSize: 18, fontWeight: "900", lineHeight: 20 },
});
