import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Image, KeyboardAvoidingView, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { SearchField } from "../src/components/FormControls";
import { MapRouteButton } from "../src/components/MapRouteButton";
import { MotionPressable, Reveal } from "../src/components/Motion";
import { SportIconBadge } from "../src/components/SportIcon";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { LoadingState, Screen } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import type { VoteRank } from "../src/lib/votingRules";
import {
  clearMccNoGo,
  clearMccVote,
  getMccEventState,
  getMyProfile,
  proposeSport,
  saveMccAttendance,
  saveMccNoGo,
  saveMccVoteRank,
  updateProfileCity,
  type AttendanceStatus,
  type MccEventState,
} from "../src/services";

const darkLogo = require("../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../assets/mcc-logo-color-symbol.png");
const EVENT_CACHE_PREFIX = "mcc.eventState.";
const seenCityPromptUserIds = new Set<string>();

const voteRanks: VoteRank[] = [1, 2, 3];

const attendanceOptions: Array<{ status: AttendanceStatus; title: string; body: string }> = [
  { status: "going", title: "Ich bin dabei", body: "Du wirst eingeplant und kannst abstimmen." },
  { status: "maybe", title: "Vielleicht", body: "Du kannst abstimmen, bleibst aber flexibel." },
  { status: "not_going", title: "Ich kann nicht", body: "Du wirst nicht in die Abstimmung gezählt." },
];

type FlowStep = "attendance" | "sports" | "overview";

function normalizeEventState(input: Partial<MccEventState>): MccEventState {
  if (!input.clubId || !input.event) {
    throw new Error("Invalid cached event state");
  }

  return {
    ...(input as MccEventState),
    sports: Array.isArray(input.sports) ? input.sports : [],
    proposals: Array.isArray(input.proposals) ? input.proposals : [],
    sportProfiles: Array.isArray(input.sportProfiles) ? input.sportProfiles : [],
    votes: Array.isArray(input.votes) ? input.votes : [],
    noGos: Array.isArray(input.noGos) ? input.noGos : [],
    attendance: Array.isArray(input.attendance) ? input.attendance : [],
    eventActivities: Array.isArray(input.eventActivities) ? input.eventActivities : [],
    myAttendance: input.myAttendance ?? null,
    myVotes: Array.isArray(input.myVotes) ? input.myVotes : [],
    myNoGos: Array.isArray(input.myNoGos) ? input.myNoGos : [],
    decision: input.decision ?? {
      mode: "none",
      activities: [],
      scores: [],
      decisionCharacter: "no_valid_decision",
      explainability: {
        voteSummaryBySport: [],
        fairnessByUser: [],
        noGoBreakdown: {
          unresolved: [],
          resolvedByAlternative: [],
          ignoredBecauseNotGoing: [],
          summary: "Keine No-Go-Konflikte.",
        },
        rotationReasons: [],
        weatherReasons: [],
        practicalityReasons: [],
        capacityReasons: [],
        costReasons: [],
      },
      noGoBreakdown: {
        unresolved: [],
        resolvedByAlternative: [],
        ignoredBecauseNotGoing: [],
        summary: "Keine No-Go-Konflikte.",
      },
      losingCandidateReasons: [],
      excludedProfiles: [],
      reason: "Cache wurde für die neue Eventlogik ergänzt.",
    },
    decisionText: input.decisionText ?? {
      selectedSportName: "Entscheidung steht",
      decisionCharacter: "no_valid_decision",
      decisionCharacterLabel: "Keine Entscheidung",
      resultLabels: [],
      simpleExplanation: "Die aktuellen Eventdaten werden neu geladen.",
      noGoSummary: "Keine No-Go-Konflikte.",
      losingCandidateSummaries: [],
      activityRows: [],
      scoreRows: [],
    },
  };
}

export default function HomeScreen() {
  const { loading, user } = useAuth();
  const { mode, theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualStep, setManualStep] = useState<FlowStep | null>(null);
  const [needsCity, setNeedsCity] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [sportSearch, setSportSearch] = useState("");
  const [cityBusy, setCityBusy] = useState(false);
  const [citySkipped, setCitySkipped] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const cacheKey = `${EVENT_CACHE_PREFIX}${user.id}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cachedState = normalizeEventState(JSON.parse(cached) as Partial<MccEventState>);
        setState((current) => current ?? cachedState);
      } catch {
        await AsyncStorage.removeItem(cacheKey);
      }
    }
    setBusy(true);
    const result = await getMccEventState(supabase, user.id);
    setBusy(false);

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    setNotice(null);
    setState(result.data);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(result.data));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadProfileCity() {
      if (!user) return;
      const result = await getMyProfile(supabase, user.id);
      if (result.data && !result.data.city && !citySkipped && !seenCityPromptUserIds.has(user.id)) {
        setNeedsCity(true);
        setPostalCode(result.data.postal_code ?? "");
        setCity(result.data.city ?? "");
      }
    }

    void loadProfileCity();
  }, [citySkipped, user]);

  const selectableSports = useMemo(() => {
    if (!state) return [];
    const query = sportSearch.trim().toLowerCase();
    return state.sports.filter((sport) => {
      if (!query) return true;
      const profileText = state.sportProfiles
        .filter((profile) => profile.sport_id === sport.id)
        .map((profile) => [profile.name, profile.location_name, profile.venue_group_key].filter(Boolean).join(" "))
        .join(" ");
      return [sport.name, sport.category, sport.combinable_tags?.join(" "), profileText].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [sportSearch, state]);

  const isDecided = state?.event.status === "decided" || state?.event.status === "completed";
  const naturalStep: FlowStep = isDecided
    ? "overview"
    : !state?.myAttendance
      ? "attendance"
      : state.myAttendance.status === "not_going"
        ? "overview"
        : state.myVotes.length === 0
          ? "sports"
          : "overview";
  const activeStep = manualStep ?? naturalStep;
  const decisionSportName = isDecided ? (state?.decisionText.selectedSportName ?? "Entscheidung steht") : "???";
  const secondaryDecisionName = isDecided ? state?.decisionText.secondarySportName : undefined;
  const eventDate = state?.event.starts_at ? new Date(state.event.starts_at) : null;
  const brandLogo = mode === "dark" ? darkLogo : lightLogo;

  function applyLocalState(nextState: MccEventState) {
    setState(nextState);
    if (user) {
      void AsyncStorage.setItem(`${EVENT_CACHE_PREFIX}${user.id}`, JSON.stringify(nextState));
    }
  }

  async function chooseAttendance(status: AttendanceStatus) {
    if (!user || !state) return;
    const previousState = state;
    const optimisticAttendance = {
      id: state.myAttendance?.id ?? "optimistic-attendance",
      event_id: state.event.id,
      user_id: user.id,
      status,
      subgroup_id: null,
      actual_status: null,
      checked_by: null,
      checked_at: null,
      created_at: state.myAttendance?.created_at ?? new Date().toISOString(),
    };

    const nextState = {
      ...state,
      attendance: [optimisticAttendance, ...state.attendance.filter((row) => row.user_id !== user.id)],
      myAttendance: optimisticAttendance,
      myVotes: status === "not_going" ? [] : state.myVotes,
      votes: status === "not_going" ? state.votes.filter((vote) => vote.user_id !== user.id) : state.votes,
    };

    setNotice(null);
    applyLocalState(nextState);
    setManualStep(status === "not_going" ? "overview" : "sports");

    const result = await saveMccAttendance(supabase, { eventId: state.event.id, userId: user.id, status });
    if (result.error) {
      setState(previousState);
      setNotice(result.error.message);
      return;
    }

    if (status === "not_going") {
      await Promise.all(
        previousState.myVotes.map((vote) => clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId: vote.sport_id })),
      );
    }

    void load();
  }

  async function chooseSport(sportId: string) {
    if (!user || !state || !canInfluenceDecision(state.myAttendance?.status) || isDecided) return;
    if (state.myNoGos.some((noGo) => noGo.sport_id === sportId)) return;

    const existing = state.myVotes.find((vote) => vote.sport_id === sportId);
    if (existing) {
      const nextState = {
        ...state,
        myVotes: state.myVotes.filter((vote) => vote.sport_id !== sportId),
        votes: state.votes.filter((vote) => !(vote.user_id === user.id && vote.sport_id === sportId)),
      };
      setNotice(null);
      applyLocalState(nextState);
      const result = await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId });
      if (result.error) {
        setNotice(result.error.message);
        void load();
      }
      return;
    }

    const usedRanks = new Set(state.myVotes.map((vote) => vote.vote_rank));
    const rank = voteRanks.find((candidate) => !usedRanks.has(candidate)) ?? 3;
    const replaced = state.myVotes.find((vote) => vote.vote_rank === rank);

    const optimisticVote = {
      id: `optimistic-${sportId}`,
      event_id: state.event.id,
      sport_id: sportId,
      user_id: user.id,
      weight: rank === 1 ? 1 : rank === 2 ? 0.6 : 0.3,
      vote_rank: rank,
      created_at: new Date().toISOString(),
    };
    const nextMyVotes = [...state.myVotes.filter((vote) => vote.sport_id !== sportId && vote.sport_id !== replaced?.sport_id), optimisticVote].sort(
      (a, b) => a.vote_rank - b.vote_rank,
    );
    const hasProposal = state.proposals.some((proposal) => proposal.sport_id === sportId);
    const optimisticProposal = {
      id: `optimistic-proposal-${sportId}`,
      event_id: state.event.id,
      sport_id: sportId,
      proposed_by: user.id,
      note: null,
      created_at: new Date().toISOString(),
    };
    const nextState = {
      ...state,
      proposals: hasProposal ? state.proposals : [optimisticProposal, ...state.proposals],
      myVotes: nextMyVotes,
      votes: [
        ...state.votes.filter((vote) => !(vote.user_id === user.id && (vote.sport_id === sportId || vote.sport_id === replaced?.sport_id))),
        optimisticVote,
      ],
    };

    setNotice(null);
    applyLocalState(nextState);

    if (replaced) {
      const clearResult = await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId: replaced.sport_id });
      if (clearResult.error) {
        setNotice(clearResult.error.message);
        void load();
        return;
      }
    }

    if (!hasProposal) {
      const proposalResult = await proposeSport(supabase, { eventId: state.event.id, sportId, proposedBy: user.id, note: null });
      if (proposalResult.error) {
        setNotice(proposalResult.error.message);
        void load();
        return;
      }
    }

    const result = await saveMccVoteRank(supabase, { eventId: state.event.id, userId: user.id, sportId, rank });
    if (result.error) {
      setNotice(result.error.message);
      void load();
    }
  }

  async function toggleNoGo(sportId: string) {
    if (!user || !state || !canInfluenceDecision(state.myAttendance?.status) || isDecided) return;
    const existing = state.myNoGos.find((noGo) => noGo.sport_id === sportId);
    setNotice(null);

    if (existing) {
      const nextState = {
        ...state,
        myNoGos: state.myNoGos.filter((noGo) => noGo.sport_id !== sportId),
        noGos: state.noGos.filter((noGo) => !(noGo.user_id === user.id && noGo.sport_id === sportId)),
      };
      applyLocalState(nextState);
      const result = await clearMccNoGo(supabase, { eventId: state.event.id, userId: user.id, sportId });
      if (result.error) {
        setNotice(result.error.message);
        void load();
      }
      return;
    }

    const existingVote = state.myVotes.find((vote) => vote.sport_id === sportId);
    const optimisticNoGo = {
      id: `optimistic-nogo-${sportId}`,
      event_id: state.event.id,
      sport_id: sportId,
      user_id: user.id,
      reason: null,
      created_at: new Date().toISOString(),
    };
    const nextState = {
      ...state,
      myVotes: existingVote ? state.myVotes.filter((vote) => vote.sport_id !== sportId) : state.myVotes,
      votes: existingVote ? state.votes.filter((vote) => !(vote.user_id === user.id && vote.sport_id === sportId)) : state.votes,
      myNoGos: [optimisticNoGo, ...state.myNoGos.filter((noGo) => noGo.sport_id !== sportId)],
      noGos: [optimisticNoGo, ...state.noGos.filter((noGo) => !(noGo.user_id === user.id && noGo.sport_id === sportId))],
    };
    applyLocalState(nextState);

    if (existingVote) {
      const clearResult = await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId });
      if (clearResult.error) {
        setNotice(clearResult.error.message);
        void load();
        return;
      }
    }

    const result = await saveMccNoGo(supabase, { eventId: state.event.id, userId: user.id, sportId });
    if (result.error) {
      setNotice(result.error.message);
      void load();
    }
  }

  async function setRank(sportId: string, rank: VoteRank) {
    if (!user || !state || !canInfluenceDecision(state.myAttendance?.status) || isDecided) return;
    if (state.myNoGos.some((noGo) => noGo.sport_id === sportId)) return;

    const replaced = state.myVotes.find((vote) => vote.vote_rank === rank && vote.sport_id !== sportId);
    const currentVote = state.myVotes.find((vote) => vote.sport_id === sportId);
    const hasProposal = state.proposals.some((proposal) => proposal.sport_id === sportId);
    const updatedVote = currentVote
      ? { ...currentVote, vote_rank: rank, weight: rank === 1 ? 1 : rank === 2 ? 0.6 : 0.3 }
      : {
          id: `optimistic-${sportId}`,
          event_id: state.event.id,
          sport_id: sportId,
          user_id: user.id,
          weight: rank === 1 ? 1 : rank === 2 ? 0.6 : 0.3,
          vote_rank: rank,
          created_at: new Date().toISOString(),
        };
    const optimisticProposal = {
      id: `optimistic-proposal-${sportId}`,
      event_id: state.event.id,
      sport_id: sportId,
      proposed_by: user.id,
      note: null,
      created_at: new Date().toISOString(),
    };

    const nextState = {
      ...state,
      proposals: hasProposal ? state.proposals : [optimisticProposal, ...state.proposals],
      myVotes: [...state.myVotes.filter((vote) => vote.sport_id !== sportId && vote.sport_id !== replaced?.sport_id), updatedVote].sort((a, b) => a.vote_rank - b.vote_rank),
      votes: [
        ...state.votes.filter((vote) => !(vote.user_id === user.id && (vote.sport_id === sportId || vote.sport_id === replaced?.sport_id))),
        updatedVote,
      ],
    };
    setNotice(null);
    applyLocalState(nextState);

    if (replaced) {
      const clearResult = await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId: replaced.sport_id });
      if (clearResult.error) {
        setNotice(clearResult.error.message);
        void load();
        return;
      }
    }

    if (!hasProposal) {
      const proposalResult = await proposeSport(supabase, { eventId: state.event.id, sportId, proposedBy: user.id, note: null });
      if (proposalResult.error) {
        setNotice(proposalResult.error.message);
        void load();
        return;
      }
    }

    const result = await saveMccVoteRank(supabase, { eventId: state.event.id, userId: user.id, sportId, rank });
    if (result.error) {
      setNotice(result.error.message);
      void load();
    }
  }

  async function updatePostalCode(value: string) {
    const nextPostalCode = value.replace(/\D/g, "").slice(0, 5);
    setPostalCode(nextPostalCode);
    if (nextPostalCode.length !== 5) return;

    const onlineCity = await fetchGermanCityByPostalCode(nextPostalCode);
    if (onlineCity) {
      setCity(onlineCity);
      return;
    }

    const fallbackCity = inferCityFromPostalCode(nextPostalCode);
    if (fallbackCity) setCity(fallbackCity);
  }

  async function saveCity(): Promise<boolean> {
    if (!user || postalCode.length < 5 || !city.trim()) return false;
    setCityBusy(true);
    const result = await updateProfileCity(supabase, { userId: user.id, postalCode, city: city.trim() });
    setCityBusy(false);
    if (result.error) {
      setNotice(result.error.message);
      return false;
    }
    seenCityPromptUserIds.add(user.id);
    setCitySkipped(true);
    setNeedsCity(false);
    return true;
  }

  function skipCityPrompt() {
    if (user) seenCityPromptUserIds.add(user.id);
    setCitySkipped(true);
    setNeedsCity(false);
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!user) return <Redirect href="/auth" />;

  if (!state && busy) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!state) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <Image source={brandLogo} style={[styles.backgroundLogo, { opacity: mode === "dark" ? 0.055 : 0.075 }]} resizeMode="contain" />
        <View style={styles.appShell}>
          <View style={styles.screen}>
            <Header />
            <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[styles.panelTitle, { color: theme.text }]}>Event konnte nicht geladen werden</Text>
              <Text style={[styles.body, { color: theme.muted }]}>{notice ?? "Bitte prüfe Supabase und lade danach neu."}</Text>
              <PrimaryButton label="Neu laden" onPress={load} />
            </View>
          </View>
          <BottomNav active="event" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Image source={brandLogo} style={[styles.backgroundLogo, { opacity: mode === "dark" ? 0.055 : 0.075 }]} resizeMode="contain" />
      <View style={styles.appShell}>
        <Animated.ScrollView
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={theme.text} />}
          contentContainerStyle={styles.screen}
        >
          <Header />
          <View style={styles.hero}>
            <Text style={[styles.kicker, { color: theme.accent }]}>Diese Woche</Text>
            <Text style={[styles.title, { color: theme.text }]}>Gemeinsamer Cardiotag</Text>
          </View>
          <Progress activeStep={activeStep} />
          {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}

          <Stage stepKey={activeStep}>
            {activeStep === "attendance" ? (
              <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={[styles.panelKicker, { color: theme.accent }]}>Schritt 1</Text>
                <Text style={[styles.panelTitle, { color: theme.text }]}>Bist du dabei?</Text>
                <View style={styles.optionStack}>
                  {attendanceOptions.map((option) => {
                    const active = state.myAttendance?.status === option.status;
                    return (
                      <Reveal key={option.status} index={attendanceOptions.indexOf(option)}>
                      <MotionPressable
                        key={option.status}
                        style={[
                          styles.option,
                          { borderColor: theme.border, backgroundColor: theme.softSurface },
                          active && { borderColor: theme.accent, backgroundColor: theme.button },
                        ]}
                        pressedStyle={styles.pressed}
                        onPress={() => chooseAttendance(option.status)}
                      >
                        <Text style={[styles.optionTitle, { color: active ? theme.inverse : theme.text }]}>{option.title}</Text>
                        <Text style={[styles.optionBody, { color: active ? theme.inverse : theme.muted }]}>{option.body}</Text>
                      </MotionPressable>
                      </Reveal>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {activeStep === "sports" ? (
              <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={[styles.panelKicker, { color: theme.accent }]}>Schritt 2</Text>
                <Text style={[styles.panelTitle, { color: theme.text }]}>Wähle deinen Mix</Text>
                <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart oder Standort suchen" />
                <View style={styles.voteStack}>
                  {selectableSports.map((sport, index) => {
                    const vote = state.myVotes.find((row) => row.sport_id === sport.id);
                    const noGo = state.myNoGos.some((row) => row.sport_id === sport.id);
                    const profileHint = profileSummary(state, sport.id);
                    return (
                      <Reveal key={sport.id} index={index}>
                      <MotionPressable
                        key={sport.id}
                        style={[
                          styles.sportCard,
                          { borderColor: theme.border, backgroundColor: theme.softSurface },
                          vote && { borderColor: theme.accent, backgroundColor: theme.button },
                          noGo && { borderColor: "#ff8d7a", backgroundColor: "rgba(255,126,106,0.14)" },
                        ]}
                        pressedStyle={styles.pressed}
                      >
                        <SportIconBadge sport={sport} size={36} />
                        <View style={styles.sportTextWrap}>
                          <Text style={[styles.sportName, { color: vote ? theme.inverse : theme.text }]}>{sport.name}</Text>
                          <Text style={[styles.sportMeta, { color: vote ? theme.inverse : theme.muted }]}>
                            {sport.category} · {sport.intensity_level}
                          </Text>
                          {profileHint ? <Text style={[styles.sportMeta, { color: vote ? theme.inverse : theme.muted }]}>{profileHint}</Text> : null}
                        </View>
                        <View style={styles.voteControls}>
                          {noGo ? null : (
                            <View style={styles.rankPicker}>
                              {voteRanks.map((rank) => (
                                <Pressable
                                  key={rank}
                                  style={[styles.rankDot, vote?.vote_rank === rank && styles.rankDotActive]}
                                  onPress={() => setRank(sport.id, rank)}
                                >
                                  <Text style={[styles.rankText, vote?.vote_rank === rank && styles.rankTextActive]}>{rank}</Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                          {vote ? (
                            <Pressable style={styles.removeVoteButton} onPress={() => chooseSport(sport.id)}>
                              <MaterialCommunityIcons name="close" size={16} color={vote ? theme.inverse : theme.text} />
                            </Pressable>
                          ) : null}
                          <Pressable style={noGo ? styles.noGoButton : styles.noGoGhost} onPress={() => toggleNoGo(sport.id)}>
                            <Text style={noGo ? styles.noGoButtonText : [styles.noGoGhostText, { color: theme.muted }]}>No-Go</Text>
                          </Pressable>
                        </View>
                      </MotionPressable>
                      </Reveal>
                    );
                  })}
                </View>
                {selectableSports.length === 0 ? <Text style={[styles.body, { color: theme.muted }]}>Keine Sportarten für diese Suche.</Text> : null}
                <PrimaryButton label="Weiter zum Überblick" onPress={() => state.myVotes.length > 0 && setManualStep("overview")} disabled={state.myVotes.length === 0} />
              </View>
            ) : null}

            {activeStep === "overview" ? (
              <View style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={[styles.panelKicker, { color: theme.accent }]}>{isDecided ? "Entscheidung" : "Vor der Auswertung"}</Text>
                <Text style={[styles.panelTitle, { color: theme.text }]}>{decisionSportName}</Text>
                {!isDecided ? <Text style={[styles.body, { color: theme.muted }]}>Sportart folgt am Mittwoch nach der Auswertung.</Text> : null}
                {isDecided ? (
                  <>
                    {secondaryDecisionName ? <Text style={[styles.secondarySport, { color: theme.accent }]}>+ {secondaryDecisionName}</Text> : null}
                    <View style={styles.pillRow}>
                      {state.decisionText.resultLabels.map((label) => (
                        <View key={label} style={[styles.pill, { backgroundColor: theme.softSurface }]}>
                          <Text style={[styles.pillText, { color: theme.accent }]}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={[styles.body, { color: theme.muted }]}>{state.event.decision_reason ?? state.decisionText.simpleExplanation}</Text>
                    {homeActivityRows(state).map((activity) => (
                      <View key={activity.key} style={styles.activityRouteRow}>
                        <Text style={[styles.body, styles.activityRouteText, { color: theme.text }]}>{activity.label}</Text>
                        <MapRouteButton target={activity.mapTarget} compact />
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={[styles.body, { color: theme.muted }]}>
                    Deine Auswahl ist gespeichert. Die Sportart bleibt bis zur Auswertung eine Überraschung.
                  </Text>
                )}
                <View style={styles.detailGrid}>
                  <Detail label="Teilnahme" value={attendanceLabel(state.myAttendance?.status)} />
                  <Detail
                    label="Sportwahl"
                    value={
                      state.myAttendance?.status === "not_going"
                        ? "Nicht relevant"
                        : [
                            state.myVotes.map((vote) => `${vote.vote_rank}. ${sportName(state, vote.sport_id)}`).join(" · "),
                            state.myNoGos.length > 0 ? `No-Go: ${state.myNoGos.map((noGo) => sportName(state, noGo.sport_id)).join(", ")}` : "",
                          ].filter(Boolean).join(" · ")
                    }
                  />
                  <Detail label="Zeit" value={eventDate ? eventDate.toLocaleString("de-DE", { weekday: "long", hour: "2-digit", minute: "2-digit" }) : "Noch offen"} />
                  <Detail label="Ort" value={state.event.location ?? "Noch offen"} />
                </View>
                <View style={styles.actionRow}>
                  <SecondaryButton label="Teilnahme ändern" onPress={() => setManualStep("attendance")} />
                  {canInfluenceDecision(state.myAttendance?.status) ? <SecondaryButton label="Sport ändern" onPress={() => setManualStep("sports")} /> : null}
                </View>
                {isDecided ? (
                  <PrimaryButton label="Zum Event-Chat" onPress={() => router.push("/chat")} />
                ) : (
                  <View style={[styles.lockedChat, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
                    <Text style={[styles.lockedChatText, { color: theme.muted }]}>Chat öffnet nach der Entscheidung.</Text>
                  </View>
                )}
              </View>
            ) : null}
          </Stage>
        </Animated.ScrollView>
        <CityPrompt
          visible={needsCity}
          postalCode={postalCode}
          city={city}
          onPostalCodeChange={updatePostalCode}
          onCityChange={setCity}
          onSave={saveCity}
          onSkip={skipCityPrompt}
          busy={cityBusy}
        />
        <BottomNav active="event" />
      </View>
    </SafeAreaView>
  );
}

function CityPrompt({
  visible,
  postalCode,
  city,
  onPostalCodeChange,
  onCityChange,
  onSave,
  onSkip,
  busy,
}: {
  visible: boolean;
  postalCode: string;
  city: string;
  onPostalCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onSave: () => Promise<boolean>;
  onSkip: () => void;
  busy: boolean;
}) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    scale.setValue(0.94);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 160, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 170, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, translateY, visible]);

  function closeWithAnimation() {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 26, duration: 120, useNativeDriver: true }),
    ]).start(onSkip);
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={undefined} style={styles.cityOverlay}>
        <Animated.View style={[styles.cityCard, { backgroundColor: theme.surface, borderColor: theme.border, opacity, transform: [{ translateY }, { scale }] }]}>
          <Text style={[styles.cityKicker, { color: theme.accent }]}>Kurz dein Standort</Text>
          <Text style={[styles.cityTitle, { color: theme.text }]}>Aus welcher Stadt kommst du?</Text>
          <TextInput
            value={postalCode}
            onChangeText={onPostalCodeChange}
            placeholder="PLZ"
            placeholderTextColor={theme.muted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            style={[styles.cityInput, { borderColor: theme.border, backgroundColor: theme.softSurface, color: theme.text }]}
          />
          <TextInput
            value={city}
            onChangeText={onCityChange}
            placeholder="Stadt"
            placeholderTextColor={theme.muted}
            autoCapitalize="words"
            style={[styles.cityInput, { borderColor: theme.border, backgroundColor: theme.softSurface, color: theme.text }]}
          />
          <Pressable
            style={[styles.cityButton, { backgroundColor: theme.button }, (postalCode.length < 5 || !city.trim() || busy) && styles.disabled]}
            onPress={() => {
              void onSave();
            }}
            disabled={postalCode.length < 5 || !city.trim() || busy}
          >
            <Text style={[styles.cityButtonText, { color: theme.inverse }]}>{busy ? "Speichern..." : "Speichern"}</Text>
          </Pressable>
          <Pressable style={styles.citySkip} onPress={closeWithAnimation}>
            <Text style={[styles.citySkipText, { color: theme.muted }]}>Später</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Header() {
  const { mode } = useTheme();
  const headerLogo = mode === "dark" ? darkLogo : lightLogo;

  return (
    <View style={styles.header}>
      <Image source={headerLogo} style={styles.logo} resizeMode="contain" />
      <View style={styles.headerActions}>
        <Pressable style={styles.historyButton} onPress={() => router.push("/events/history")}>
          <MaterialCommunityIcons name="history" size={27} color="#ffffff" />
        </Pressable>
        <ThemeToggle />
      </View>
    </View>
  );
}

function Progress({ activeStep }: { activeStep: FlowStep }) {
  const { theme } = useTheme();
  const steps: FlowStep[] = ["attendance", "sports", "overview"];
  const activeIndex = steps.indexOf(activeStep);

  return (
    <View style={styles.progress}>
      {steps.map((step, index) => (
        <View key={step} style={[styles.progressDot, { backgroundColor: index <= activeIndex ? theme.accent : theme.border }]} />
      ))}
    </View>
  );
}

function Stage({ children, stepKey }: { children: ReactNode; stepKey: FlowStep }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(0.985)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(16);
    scale.setValue(0.985);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 130, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, stepKey, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>{children}</Animated.View>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.button }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.primaryButtonText, { color: theme.inverse }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.softSurface }, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.detail, { borderTopColor: theme.border }]}>
      <Text style={[styles.detailLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value || "Noch offen"}</Text>
    </View>
  );
}

function attendanceLabel(status?: AttendanceStatus): string {
  if (status === "going") return "Du bist dabei";
  if (status === "maybe") return "Vielleicht";
  if (status === "not_going") return "Du kannst nicht";
  return "Noch offen";
}

function canInfluenceDecision(status?: AttendanceStatus): boolean {
  return status === "going" || status === "maybe";
}

function sportName(state: MccEventState, sportId: string): string {
  return state.sports.find((sport) => sport.id === sportId)?.name ?? "Sportart";
}

function homeActivityRows(state: MccEventState): Array<{ key: string; label: string; mapTarget: { latitude?: number | null; longitude?: number | null; label?: string | null; mapUrl?: string | null } | null }> {
  if (state.eventActivities.length > 0) {
    return state.eventActivities.map((activity) => {
      const count = (activity.assigned_user_ids ?? []).length;
      const profile = state.sportProfiles.find((entry) => entry.id === activity.sport_profile_id);
      return {
        key: activity.id,
        label: `${activity.title}${activity.location ? ` · ${activity.location}` : ""}${count > 0 ? ` · ${count} Personen` : ""}`,
        mapTarget: profile ? sportProfileMapTarget(profile) : activity.location ? { label: activity.location } : null,
      };
    });
  }

  return state.decisionText.activityRows.map((activity) => {
    const profile = state.sportProfiles.find((entry) => entry.id === activity.profileId);
    return {
      key: activity.profileId,
      label: `${activity.sportName} · ${activity.profileName}${activity.locationName ? ` · ${activity.locationName}` : ""} · ${activity.participantCount} Personen`,
      mapTarget: profile ? sportProfileMapTarget(profile) : activity.locationName ? { label: activity.locationName } : null,
    };
  });
}

function sportProfileMapTarget(profile: MccEventState["sportProfiles"][number]) {
  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    mapUrl: profile.map_url,
    label: [profile.location_name, profile.location_city, profile.postal_code].filter(Boolean).join(" "),
  };
}

function profileSummary(state: MccEventState, sportId: string): string {
  const profiles = state.sportProfiles.filter((profile) => profile.sport_id === sportId);
  if (profiles.length === 0) return "Noch kein konkretes Sportprofil";
  const locations = profiles.map((profile) => profile.location_name).filter(Boolean);
  const locationText = [...new Set(locations)].slice(0, 2).join(", ");
  return `${profiles.length} Profil${profiles.length === 1 ? "" : "e"}${locationText ? ` · ${locationText}` : ""}`;
}

async function fetchGermanCityByPostalCode(postalCode: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.zippopotam.us/de/${postalCode}`);
    if (!response.ok) return null;
    const payload = (await response.json()) as { places?: Array<{ "place name"?: string }> };
    return payload.places?.[0]?.["place name"] ?? null;
  } catch {
    return null;
  }
}

function inferCityFromPostalCode(postalCode: string): string {
  const exact: Record<string, string> = {
    "10115": "Berlin",
    "20095": "Hamburg",
    "28195": "Bremen",
    "30159": "Hannover",
    "40210": "Düsseldorf",
    "50667": "Köln",
    "60311": "Frankfurt am Main",
    "70173": "Stuttgart",
    "80331": "München",
    "90402": "Nürnberg",
    "78462": "Konstanz",
  };

  if (exact[postalCode]) return exact[postalCode];
  if (postalCode.length < 2) return "";

  const prefix = Number(postalCode.slice(0, 2));
  if (prefix <= 14) return "Berlin";
  if (prefix <= 19) return "Brandenburg";
  if (prefix <= 22) return "Hamburg";
  if (prefix <= 28) return "Bremen";
  if (prefix <= 31) return "Hannover";
  if (prefix <= 34) return "Kassel";
  if (prefix <= 37) return "Göttingen";
  if (prefix <= 40) return "Dortmund";
  if (prefix <= 42) return "Düsseldorf";
  if (prefix <= 47) return "Ruhrgebiet";
  if (prefix <= 53) return "Köln";
  if (prefix <= 56) return "Koblenz";
  if (prefix <= 60) return "Frankfurt am Main";
  if (prefix <= 65) return "Wiesbaden";
  if (prefix <= 69) return "Mannheim";
  if (prefix <= 73) return "Stuttgart";
  if (prefix <= 79) return "Konstanz";
  if (prefix <= 86) return "München";
  if (prefix <= 89) return "Ulm";
  if (prefix <= 91) return "Nürnberg";
  if (prefix <= 96) return "Bamberg";
  return "Leipzig";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  appShell: { flex: 1 },
  screen: { gap: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  backgroundLogo: {
    position: "absolute",
    top: 82,
    right: -120,
    width: 380,
    height: 380,
    opacity: 0.055,
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  historyButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  logo: { width: 50, height: 50 },
  menuButton: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 16, paddingVertical: 10 },
  menuButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  hero: { gap: 8, paddingTop: 10, paddingBottom: 2 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "900", letterSpacing: 0, lineHeight: 38 },
  progress: { flexDirection: "row", gap: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" },
  progressDotActive: { backgroundColor: "#4da3ff" },
  panel: {
    gap: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,17,27,0.94)",
    padding: 16,
    shadowColor: "#4da3ff",
    shadowOpacity: 0.13,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 24 },
  },
  panelKicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  panelTitle: { color: "#ffffff", fontSize: 28, fontWeight: "900", letterSpacing: 0, lineHeight: 32 },
  body: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
  secondarySport: { color: "#8fc7ff", fontSize: 20, fontWeight: "900", marginTop: -8 },
  optionStack: { gap: 10 },
  option: { gap: 5, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)", padding: 16 },
  optionActive: { borderColor: "rgba(77,163,255,0.78)", backgroundColor: "rgba(77,163,255,0.18)" },
  optionTitle: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  optionTitleActive: { color: "#ffffff" },
  optionBody: { color: "#9aa7b8", fontSize: 14 },
  optionBodyActive: { color: "#d9ecff" },
  voteStack: { gap: 10 },
  sportCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 15,
  },
  sportCardActive: { borderColor: "rgba(77,163,255,0.78)", backgroundColor: "rgba(77,163,255,0.18)" },
  sportTextWrap: { flex: 1, gap: 3 },
  sportName: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  sportNameActive: { color: "#ffffff" },
  sportMeta: { color: "#9aa7b8", fontSize: 13 },
  sportMetaActive: { color: "#d9ecff" },
  addMark: { color: "#4da3ff", fontSize: 26, fontWeight: "700" },
  voteControls: { alignItems: "center", gap: 7 },
  rankPicker: { flexDirection: "row", gap: 6 },
  rankDot: { alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  rankDotActive: { backgroundColor: "#ffffff" },
  rankText: { color: "#d9ecff", fontWeight: "900" },
  rankTextActive: { color: "#05070b" },
  removeVoteButton: { alignItems: "center", borderRadius: 999, height: 28, justifyContent: "center", width: 28 },
  noGoButton: { borderRadius: 999, backgroundColor: "rgba(255,126,106,0.22)", paddingHorizontal: 10, paddingVertical: 8 },
  noGoButtonText: { color: "#ffb5a8", fontSize: 12, fontWeight: "900" },
  noGoGhost: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  noGoGhostText: { fontSize: 12, fontWeight: "900" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, backgroundColor: "rgba(77,163,255,0.16)", paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { color: "#8fc7ff", fontSize: 12, fontWeight: "900" },
  detailGrid: { gap: 8 },
  detail: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", gap: 2, paddingTop: 10 },
  detailLabel: { color: "#728197", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  detailValue: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryButton: { alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", paddingVertical: 14 },
  primaryButtonText: { color: "#05070b", fontSize: 15, fontWeight: "900" },
  secondaryButton: {
    flexGrow: 1,
    minWidth: 132,
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  lockedChat: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 14,
  },
  lockedChatText: { color: "#9aa7b8", fontSize: 14, fontWeight: "900" },
  activityRouteRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  activityRouteText: { flex: 1, minWidth: 0 },
  cityOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 92,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  cityCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 430,
    gap: 12,
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  cityKicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  cityTitle: { fontSize: 26, fontWeight: "900", lineHeight: 30 },
  cityInput: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 17,
    paddingHorizontal: 14,
    outlineStyle: "none",
  } as object,
  cityButton: { alignItems: "center", borderRadius: 18, paddingVertical: 15 },
  cityButtonText: { fontSize: 15, fontWeight: "900" },
  citySkip: { alignItems: "center", paddingVertical: 5 },
  citySkipText: { fontSize: 14, fontWeight: "900" },
  notice: { borderRadius: 18, backgroundColor: "rgba(164,62,48,0.18)", padding: 12 },
  noticeText: { color: "#ffb5a8", fontSize: 14, fontWeight: "900", textAlign: "center" },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
  disabled: { opacity: 0.38 },
});
