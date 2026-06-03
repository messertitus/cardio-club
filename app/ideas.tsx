import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { DetailLine, LabeledInput, MapLocationPicker, SearchField, SegmentedControl } from "../src/components/FormControls";
import { PageHeader } from "../src/components/PageHeader";
import { Button, LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import {
  isCurrentUserAdmin,
  listSportIdeas,
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

type IdeaFlowStep = SportIdeaDraftStep | "weather";

type IdeaDraft = {
  ideaId: string | null;
  name: string;
  sportId: string;
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
  { id: "essentials", label: "Wichtig" },
  { id: "weather", label: "Wetter" },
  { id: "optional", label: "Optional" },
  { id: "review", label: "Review" },
];

const emptyDraft: IdeaDraft = {
  ideaId: null,
  name: "",
  sportId: "",
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
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);
  const [sportSearch, setSportSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");

  async function load() {
    if (!user) return;
    setBusy(true);
    const [sportsResult, profilesResult, ideasResult, adminResult] = await Promise.all([
      listSports(supabase),
      listSportProfiles(supabase),
      listSportIdeas(supabase),
      isCurrentUserAdmin(supabase, user.id),
    ]);
    setBusy(false);
    if (sportsResult.data) setSports(sportsResult.data);
    if (profilesResult.data) setSportProfiles(profilesResult.data);
    if (ideasResult.data) {
      setIdeas(ideasResult.data);
      const ownDraft = ideasResult.data.find((idea) => idea.suggested_by === user.id && idea.is_draft);
      if (ownDraft && !draft.ideaId) {
        setDraft(ideaToDraft(ownDraft));
        setActiveStep(asFlowStep(ownDraft.draft_step));
      }
    }
    if (adminResult.data !== null) setIsAdmin(adminResult.data);
    if (sportsResult.error || profilesResult.error || ideasResult.error || adminResult.error) {
      setMessage(sportsResult.error?.message ?? profilesResult.error?.message ?? ideasResult.error?.message ?? adminResult.error?.message ?? null);
    }
  }

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const filteredSports = useMemo(() => {
    const query = sportSearch.trim().toLowerCase();
    if (!query) return sports;
    return sports.filter((sport) => {
      const profileText = sportProfiles
        .filter((profile) => profile.sport_id === sport.id)
        .map((profile) => [profile.name, profile.location_name, profile.location_city, profile.venue_group_key].filter(Boolean).join(" "))
        .join(" ");
      return `${sport.name} ${sport.category} ${(sport.combinable_tags ?? []).join(" ")} ${profileText}`.toLowerCase().includes(query);
    });
  }, [sportProfiles, sportSearch, sports]);

  const filteredIdeas = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    const sorted = sortIdeasForUser(ideas, user?.id ?? null);
    if (!query) return sorted;
    return sorted.filter((idea) =>
      [
        idea.name,
        idea.profile_name,
        idea.location,
        idea.location_city,
        idea.postal_code,
        idea.creatorName,
        idea.sportName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [ideas, queueSearch, user?.id]);

  const ownDraft = useMemo(() => ideas.find((idea) => user && idea.suggested_by === user.id && idea.is_draft) ?? null, [ideas, user]);
  const profilesBySport = useMemo(() => groupProfilesBySport(sportProfiles), [sportProfiles]);
  const activeStepIndex = Math.max(0, flowSteps.findIndex((step) => step.id === activeStep));
  const canGoPrevious = activeStepIndex > 0;
  const canGoNext = activeStepIndex < flowSteps.length - 1;

  const currentUserOwnsDraft = Boolean(user && (!draft.suggestedBy || draft.suggestedBy === user.id));
  const canSaveDraft = Boolean(user && currentUserOwnsDraft);
  const errors = submitAttempted ? requiredErrors(draft) : {};

  async function saveDraft() {
    if (!user || !canSaveDraft) return;
    clearMessages();
    setBusy(true);
    const input = draftToInput(draft, user.id, activeStep === "weather" ? "optional" : activeStep);
    const result = await saveSportIdeaDraft(supabase, input);
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setDraft(ideaToDraft({ ...result.data, creatorName: "Du", creatorCity: null, sportName: selectedSportName(result.data.sport_id, sports) }));
    setSuccess("Entwurf gespeichert.");
    await load();
  }

  async function submit() {
    if (!user) return;
    clearMessages();
    setSubmitAttempted(true);
    const missing = requiredErrors(draft);
    if (Object.keys(missing).length > 0) {
      setMessage("Bitte ergänze die markierten Pflichtfelder.");
      return;
    }
    setBusy(true);
    const result = await submitSportIdea(supabase, draftToInput(draft, user.id, "review"));
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setDraft(emptyDraft);
    setSubmitAttempted(false);
    setActiveStep("location");
    setSuccess("Idee eingereicht.");
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
    if (!idea.sport_id) return "Bitte wähle vor der Freigabe eine abstrakte Sportart aus.";
    const result = await upsertSportProfile(supabase, {
      sportId: idea.sport_id,
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
    setSubmitAttempted(false);
  }

  function goToPreviousStep() {
    if (!canGoPrevious) return;
    setActiveStep(flowSteps[activeStepIndex - 1].id);
  }

  function goToNextStep() {
    if (!canGoNext) return;
    setActiveStep(flowSteps[activeStepIndex + 1].id);
  }

  function clearMessages() {
    setMessage(null);
    setSuccess(null);
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.shell}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PageHeader kicker="Sportideen" title="Sportarten und Standorte" />
            {message ? <Text style={styles.notice}>{message}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            {ownDraft ? (
              <Pressable style={[styles.draftBanner, { borderColor: theme.accent, backgroundColor: theme.softSurface }]} onPress={() => continueIdea(ownDraft)}>
                <View style={styles.ideaText}>
                  <Text style={[styles.ideaName, { color: theme.text }]}>Dein Entwurf</Text>
                  <Text style={[styles.ideaNote, { color: theme.muted }]}>{ownDraft.name ?? ownDraft.profile_name ?? "Entwurf ohne Namen"}</Text>
                </View>
                <Text style={[styles.itemArrow, { color: theme.accent }]}>Fortsetzen</Text>
              </Pressable>
            ) : null}

            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Aktive Sportarten</Text>
              <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart oder Standort suchen" />
              {filteredSports.length === 0 ? <Text style={[styles.body, { color: theme.muted }]}>Keine Sportarten für diese Suche.</Text> : null}
              <View style={styles.activeSportList}>
                {filteredSports.map((sport) => {
                  const profiles = profilesBySport.get(sport.id) ?? [];
                  return (
                    <View key={sport.id} style={[styles.activeSportBlock, { borderTopColor: theme.border }]}>
                      <Text style={[styles.sportPillText, { color: theme.text }]}>{sport.name}</Text>
                      {profiles.length === 0 ? <Text style={[styles.ideaNote, { color: theme.muted }]}>Noch kein Standortprofil hinterlegt.</Text> : null}
                      {profiles.map((profile) => (
                        <View key={profile.id} style={[styles.profileLine, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.profileLineTitle, { color: theme.text }]}>{sportProfileEventName(sport.name, profile)}</Text>
                          <Text style={[styles.profileLineMeta, { color: theme.muted }]}>{profileLocationText(profile)}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Neue Aktivität vorschlagen</Text>
              <View style={styles.stepRow}>
                {flowSteps.map((step) => {
                  const active = activeStep === step.id;
                  return (
                    <Pressable key={step.id} style={[styles.stepChip, { backgroundColor: active ? theme.button : theme.surface }]} onPress={() => setActiveStep(step.id)}>
                      <Text style={[styles.stepText, { color: active ? theme.inverse : theme.text }]}>{step.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

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
                      label="Exakter Ort"
                      required
                      location={draft.location}
                      mapUrl={draft.mapUrl}
                      error={errors.location}
                      onLocationChange={(location) => setDraft((current) => ({ ...current, location }))}
                      onMapUrlChange={(mapUrl) => setDraft((current) => ({ ...current, mapUrl }))}
                      onCoordinatesChange={({ latitude, longitude }) => setDraft((current) => ({ ...current, latitude, longitude }))}
                    />
                  ) : (
                    <>
                      <LabeledInput label="Stadt" required value={draft.locationCity} onChangeText={(locationCity) => setDraft((current) => ({ ...current, locationCity }))} placeholder="z. B. Konstanz" error={errors.locationCity} />
                      <LabeledInput label="PLZ" value={draft.postalCode} onChangeText={(postalCode) => setDraft((current) => ({ ...current, postalCode }))} placeholder="z. B. 78462" keyboardType="number-pad" inputMode="numeric" />
                    </>
                  )}
                </View>
              ) : null}

              {activeStep === "essentials" ? (
                <View style={styles.formGrid}>
                  <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart suchen" />
                  <View style={styles.choiceGrid}>
                    {filteredSports.map((sport) => {
                      const active = draft.sportId === sport.id;
                      return (
                        <Pressable key={sport.id} style={[styles.choiceChip, { backgroundColor: active ? theme.button : theme.surface }]} onPress={() => setDraft((current) => ({ ...current, sportId: sport.id, name: current.name || sport.name }))}>
                          <Text style={[styles.choiceText, { color: active ? theme.inverse : theme.text }]}>{sport.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <LabeledInput label="Name der Sportart" required value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder="z. B. Beachvolleyball" error={errors.name} />
                  <LabeledInput label="Profilname" required value={draft.profileName} onChangeText={(profileName) => setDraft((current) => ({ ...current, profileName }))} placeholder="z. B. Beachvolleyball im Stadtpark" error={errors.profileName} />
                  <SegmentedControl
                    label="Art des Profils"
                    value={draft.locationType ?? "flexible"}
                    onChange={(locationType) => setDraft((current) => ({ ...current, locationType }))}
                    options={[
                      { value: "outdoor", label: "Outdoor" },
                      { value: "indoor", label: "Indoor" },
                      { value: "water", label: "Wasser" },
                      { value: "field", label: "Feld" },
                      { value: "flexible", label: "Flexibel" },
                    ]}
                  />
                  {errors.locationType ? <Text style={styles.notice}>{errors.locationType}</Text> : null}
                  <LabeledInput label="Mindestanzahl" required value={draft.minimumGroupSize} onChangeText={(minimumGroupSize) => setDraft((current) => ({ ...current, minimumGroupSize: digitsOnly(minimumGroupSize) }))} placeholder="z. B. 4" keyboardType="number-pad" inputMode="numeric" error={errors.minimumGroupSize} />
                  <LabeledInput label="Maximalanzahl" value={draft.maximumGroupSize} onChangeText={(maximumGroupSize) => setDraft((current) => ({ ...current, maximumGroupSize: digitsOnly(maximumGroupSize) }))} placeholder="Optional, z. B. 12" keyboardType="number-pad" inputMode="numeric" error={errors.maximumGroupSize} />
                </View>
              ) : null}

              {activeStep === "weather" ? (
                <View style={styles.formGrid}>
                  <SegmentedControl
                    label="Regen"
                    value={draft.rainMode}
                    onChange={(rainMode) => setDraft((current) => ({ ...current, rainMode }))}
                    options={[
                      { value: "ok", label: "Regen ok" },
                      { value: "sensitive", label: "Lieber trocken" },
                      { value: "dry", label: "Nur trocken" },
                    ]}
                  />
                  <SegmentedControl
                    label="Temperatur"
                    value={draft.temperatureMode}
                    onChange={(temperatureMode) => setDraft((current) => ({ ...current, temperatureMode }))}
                    options={[
                      { value: "any", label: "Egal" },
                      { value: "moderate", label: "Mild" },
                      { value: "warm", label: "Nicht kalt" },
                      { value: "cool", label: "Nicht heiß" },
                    ]}
                  />
                  <Pressable style={[styles.choiceChip, { backgroundColor: draft.thunderstormUnsafe ? theme.button : theme.surface, alignSelf: "flex-start" }]} onPress={() => setDraft((current) => ({ ...current, thunderstormUnsafe: !current.thunderstormUnsafe }))}>
                    <Text style={[styles.choiceText, { color: draft.thunderstormUnsafe ? theme.inverse : theme.text }]}>Gewitter blockt Outdoor</Text>
                  </Pressable>
                </View>
              ) : null}

              {activeStep === "optional" ? (
                <View style={styles.formGrid}>
                  <LabeledInput label="Mitzubringen" value={draft.requiredEquipment} onChangeText={(requiredEquipment) => setDraft((current) => ({ ...current, requiredEquipment }))} placeholder="Optional, Komma getrennt" />
                  <LabeledInput label="Vor Ort vorhanden" value={draft.availableEquipment} onChangeText={(availableEquipment) => setDraft((current) => ({ ...current, availableEquipment }))} placeholder="Optional, z. B. Netz, Tore, Matten" />
                  <LabeledInput label="Öffnungszeiten" value={draft.openingNotes} onChangeText={(openingNotes) => setDraft((current) => ({ ...current, openingNotes }))} placeholder="Optional" multiline />
                  <LabeledInput label="Kosten" value={draft.costNote} onChangeText={(costNote) => setDraft((current) => ({ ...current, costNote }))} placeholder="Optional, z. B. kostenlos oder 5 EUR" />
                  <LabeledInput label="Anreise" value={draft.transitNotes} onChangeText={(transitNotes) => setDraft((current) => ({ ...current, transitNotes }))} placeholder="Optional, ÖPNV/Parken" multiline />
                  <LabeledInput label="Infrastruktur" value={draft.amenityNotes} onChangeText={(amenityNotes) => setDraft((current) => ({ ...current, amenityNotes }))} placeholder="Optional, Toiletten, Wasser, Umkleiden" multiline />
                  <LabeledInput label="Regeln/Sicherheit" value={draft.safetyNotes} onChangeText={(safetyNotes) => setDraft((current) => ({ ...current, safetyNotes }))} placeholder="Optional" multiline />
                  <View style={styles.choiceGrid}>
                    <ToggleChip label="Reservierung nötig" value={draft.reservationRequired === true} onPress={() => setDraft((current) => ({ ...current, reservationRequired: current.reservationRequired === true ? null : true }))} />
                    <ToggleChip label="Licht vorhanden" value={draft.lightingAvailable === true} onPress={() => setDraft((current) => ({ ...current, lightingAvailable: current.lightingAvailable === true ? null : true }))} />
                    <ToggleChip label="Ansprechpartner vor Ort nötig" value={draft.apRequired} onPress={() => setDraft((current) => ({ ...current, apRequired: !current.apRequired }))} />
                  </View>
                </View>
              ) : null}

              {activeStep === "review" ? (
                <View style={styles.formGrid}>
                  <DetailLine label="Sportart" value={selectedSportName(draft.sportId, sports) ?? "Noch offen"} />
                  <DetailLine label="Idee" value={draft.name || "Noch offen"} />
                  <DetailLine label="Profil" value={draft.profileName || "Noch offen"} />
                  <DetailLine label="Standort" value={draftLocationLabel(draft)} />
                  <DetailLine label="Gruppe" value={groupLabel(draft)} />
                  <DetailLine label="Wetter" value={weatherSummary(draft)} />
                  <LabeledInput label="Kurzbeschreibung" value={draft.note} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} placeholder="Was muss man wissen?" multiline />
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <Button label="Entwurf speichern" variant="secondary" onPress={saveDraft} disabled={!canSaveDraft || busy} />
                {canGoPrevious ? <Button label="Zurück" variant="secondary" onPress={goToPreviousStep} disabled={busy} /> : null}
                {canGoNext ? <Button label="Weiter" onPress={goToNextStep} disabled={busy} /> : <Button label="Einreichen" onPress={submit} disabled={busy} />}
              </View>
            </View>

            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Warteschlange</Text>
              <SearchField value={queueSearch} onChangeText={setQueueSearch} placeholder="Standort, Sportart oder Person suchen" />
              {filteredIdeas.length === 0 ? <Text style={[styles.body, { color: theme.muted }]}>Noch keine passenden Ideen.</Text> : null}
              {filteredIdeas.map((idea) => {
                const opened = expandedIdeaId === idea.id;
                return (
                  <View key={idea.id} style={[styles.ideaRow, { borderTopColor: theme.border }]}>
                    <Pressable style={styles.ideaHeader} onPress={() => setExpandedIdeaId(opened ? null : idea.id)}>
                      <View style={styles.ideaText}>
                        <Text style={[styles.ideaName, { color: theme.text }]}>{idea.name ?? idea.profile_name ?? "Entwurf ohne Namen"}</Text>
                        <Text style={[styles.ideaMeta, { color: theme.accent }]}>{ideaLocationLabel(idea)} - {idea.creatorName}</Text>
                        <Text style={[styles.ideaNote, { color: theme.muted }]}>{ideaStatusLabel(idea)}</Text>
                      </View>
                      <Text style={[styles.itemArrow, { color: theme.muted }]}>{opened ? "x" : ">"}</Text>
                    </Pressable>
                    {opened ? (
                      <View style={styles.formGrid}>
                        <IdeaDetails idea={idea} />
                        {idea.is_draft && idea.suggested_by === user.id ? (
                          <Button label="Entwurf fortsetzen" variant="secondary" onPress={() => continueIdea(idea)} />
                        ) : null}
                        {isAdmin && !idea.is_draft && idea.status === "pending" ? (
                          <View style={styles.actionRow}>
                            <Button label="Freigeben" onPress={() => reviewIdea(idea, "approved")} />
                            <Button label="Ablehnen" variant="ghost" onPress={() => reviewIdea(idea, "rejected")} />
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
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

function sortIdeasForUser(ideas: SportIdeaWithCreator[], userId: string | null): SportIdeaWithCreator[] {
  return [...ideas].sort((a, b) => {
    const aOwnDraft = Boolean(userId && a.suggested_by === userId && a.is_draft);
    const bOwnDraft = Boolean(userId && b.suggested_by === userId && b.is_draft);
    if (aOwnDraft !== bOwnDraft) return aOwnDraft ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function groupProfilesBySport(profiles: Row<"sport_profiles">[]): Map<string, Row<"sport_profiles">[]> {
  const result = new Map<string, Row<"sport_profiles">[]>();
  for (const profile of profiles.filter((entry) => entry.is_active)) {
    const next = result.get(profile.sport_id) ?? [];
    next.push(profile);
    result.set(profile.sport_id, next);
  }
  return result;
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
      <DetailLine label="Sportart" value={idea.sportName} />
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
  return {
    ideaId: idea.id,
    name: idea.name ?? "",
    sportId: idea.sport_id ?? "",
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

function draftToInput(draft: IdeaDraft, userId: string, draftStep: SportIdeaDraftStep) {
  return {
    ideaId: draft.ideaId,
    userId: draft.suggestedBy ?? userId,
    name: draft.name,
    sportId: draft.sportId,
    profileName: draft.profileName,
    note: draft.note,
    locationMode: draft.locationMode,
    location: draft.location,
    postalCode: draft.postalCode,
    locationCity: draft.locationCity,
    mapUrl: draft.mapUrl,
    latitude: draft.latitude,
    longitude: draft.longitude,
    preferredTime: draft.preferredTime,
    locationType: draft.locationType,
    minimumGroupSize: parseOptionalInteger(draft.minimumGroupSize),
    maximumGroupSize: parseOptionalInteger(draft.maximumGroupSize),
    requiredEquipment: parseCsv(draft.requiredEquipment),
    availableEquipment: parseCsv(draft.availableEquipment),
    costNote: draft.costNote,
    openingNotes: draft.openingNotes,
    transitNotes: draft.transitNotes,
    amenityNotes: draft.amenityNotes,
    reservationRequired: draft.reservationRequired,
    lightingAvailable: draft.lightingAvailable,
    safetyNotes: draft.safetyNotes,
    locationRules: draft.locationRules,
    apRequired: draft.apRequired,
    weatherRules: weatherRulesFromDraft(draft),
    draftStep,
  };
}

function requiredErrors(draft: IdeaDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.name.trim()) errors.name = "Name fehlt.";
  if (!draft.profileName.trim()) errors.profileName = "Profilname fehlt.";
  if (draft.locationMode === "fixed" && !draft.location.trim() && !draft.mapUrl.trim()) errors.location = "Standort fehlt.";
  if (draft.locationMode === "flexible" && !draft.locationCity.trim() && !draft.postalCode.trim()) errors.locationCity = "Stadt oder PLZ fehlt.";
  if (!draft.locationType) errors.locationType = "Profilart fehlt.";
  const min = parseOptionalInteger(draft.minimumGroupSize);
  const max = parseOptionalInteger(draft.maximumGroupSize);
  if (!min || min < 1) errors.minimumGroupSize = "Mindestanzahl fehlt.";
  if (min && max && max < min) errors.maximumGroupSize = "Maximalanzahl muss größer sein.";
  return errors;
}

function weatherRulesFromDraft(draft: IdeaDraft): Json {
  return {
    requiresDry: draft.rainMode === "dry",
    rainSensitive: draft.rainMode === "sensitive" || draft.rainMode === "dry",
    thunderstormUnsafe: draft.thunderstormUnsafe,
    heatSensitive: draft.temperatureMode === "moderate" || draft.temperatureMode === "cool",
    coldSensitive: draft.temperatureMode === "moderate" || draft.temperatureMode === "warm",
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

function asFlowStep(value: string): IdeaFlowStep {
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

function selectedSportName(sportId: string | null, sports: Row<"sports">[]): string | null {
  return sports.find((sport) => sport.id === sportId)?.name ?? null;
}

function draftLocationLabel(draft: IdeaDraft): string {
  if (draft.locationMode === "flexible") return [draft.postalCode, draft.locationCity || "flexibel"].filter(Boolean).join(" ");
  return draft.location || (draft.latitude && draft.longitude ? `${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}` : "Noch offen");
}

function ideaLocationLabel(idea: SportIdeaWithCreator): string {
  if (idea.location_mode === "flexible") return [idea.postal_code, idea.location_city || "flexibel"].filter(Boolean).join(" ");
  return idea.location ?? idea.location_city ?? "Standort offen";
}

function groupLabel(draft: IdeaDraft): string {
  const min = parseOptionalInteger(draft.minimumGroupSize);
  const max = parseOptionalInteger(draft.maximumGroupSize);
  if (!min) return "Noch offen";
  return `${min}${max ? ` bis ${max}` : "+"} Personen`;
}

function weatherSummary(draft: IdeaDraft): string {
  const rain = draft.rainMode === "dry" ? "nur trocken" : draft.rainMode === "sensitive" ? "Regen ungünstig" : "Regen okay";
  const temp = draft.temperatureMode === "moderate" ? "milde Temperaturen" : draft.temperatureMode === "warm" ? "nicht kalt" : draft.temperatureMode === "cool" ? "nicht heiß" : "Temperatur flexibel";
  return `${rain}, ${temp}${draft.thunderstormUnsafe ? ", Gewitter blockt" : ""}`;
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
  card: { gap: 14, borderRadius: 24, borderWidth: 1, padding: 14 },
  draftBanner: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, justifyContent: "space-between", padding: 12 },
  cardTitle: { fontSize: 21, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 22 },
  formGrid: { gap: 12 },
  stepRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  stepText: { fontSize: 12, fontWeight: "900" },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceText: { fontSize: 12, fontWeight: "900" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activeSportList: { gap: 8 },
  activeSportBlock: { borderTopWidth: 1, gap: 8, paddingTop: 10 },
  profileLine: { borderRadius: 14, gap: 3, paddingHorizontal: 11, paddingVertical: 9 },
  profileLineTitle: { fontSize: 13, fontWeight: "900", lineHeight: 18 },
  profileLineMeta: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  sportPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  sportPillText: { fontSize: 13, fontWeight: "900" },
  ideaRow: { gap: 10, borderTopWidth: 1, paddingTop: 11 },
  ideaHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  ideaText: { flex: 1, minWidth: 0, gap: 3 },
  ideaName: { fontSize: 15, fontWeight: "900" },
  ideaMeta: { fontSize: 13, fontWeight: "900" },
  ideaNote: { fontSize: 13, lineHeight: 18 },
  itemArrow: { fontSize: 20, fontWeight: "900" },
});
