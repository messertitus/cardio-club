import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { LoadingState, Screen } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import type { VoteRank } from "../src/lib/votingRules";
import {
  clearMccVote,
  getMccEventState,
  saveMccAttendance,
  saveMccVoteRank,
  type AttendanceStatus,
  type MccEventState,
} from "../src/services";

const logo = require("../assets/mcc-logo-white-symbol-transparent.png");

const voteRanks: VoteRank[] = [1, 2, 3];

const attendanceOptions: Array<{ status: AttendanceStatus; title: string; body: string }> = [
  { status: "going", title: "Ich bin dabei", body: "Du wirst eingeplant und kannst abstimmen." },
  { status: "maybe", title: "Vielleicht", body: "Du kannst abstimmen, bleibst aber flexibel." },
  { status: "not_going", title: "Ich kann nicht", body: "Du wirst nicht in die Abstimmung gezählt." },
];

type FlowStep = "attendance" | "sports" | "overview";

export default function HomeScreen() {
  const { loading, user } = useAuth();
  const [state, setState] = useState<MccEventState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualStep, setManualStep] = useState<FlowStep | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const result = await getMccEventState(supabase, user.id);
    setBusy(false);

    if (result.error) {
      setNotice(result.error.message);
      return;
    }

    setNotice(null);
    setState(result.data);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const proposedSports = useMemo(() => {
    if (!state) return [];
    const proposedIds = new Set(state.proposals.map((proposal) => proposal.sport_id));
    return state.sports.filter((sport) => proposedIds.has(sport.id));
  }, [state]);

  const naturalStep: FlowStep = !state?.myAttendance
    ? "attendance"
    : state.myAttendance.status === "not_going"
      ? "overview"
      : state.myVotes.length === 0
        ? "sports"
        : "overview";
  const activeStep = manualStep ?? naturalStep;
  const selectedSport = state?.sports.find((sport) => sport.id === state.event.selected_sport_id);
  const decisionSportName = selectedSport?.name ?? state?.decisionText.selectedSportName ?? "Noch offen";
  const eventDate = state?.event.starts_at ? new Date(state.event.starts_at) : null;

  async function chooseAttendance(status: AttendanceStatus) {
    if (!user || !state) return;
    const previousState = state;
    const optimisticAttendance = {
      id: state.myAttendance?.id ?? "optimistic-attendance",
      event_id: state.event.id,
      user_id: user.id,
      status,
      subgroup_id: null,
      created_at: state.myAttendance?.created_at ?? new Date().toISOString(),
    };

    setNotice(null);
    setState({
      ...state,
      attendance: [optimisticAttendance, ...state.attendance.filter((row) => row.user_id !== user.id)],
      myAttendance: optimisticAttendance,
      myVotes: status === "not_going" ? [] : state.myVotes,
      votes: status === "not_going" ? state.votes.filter((vote) => vote.user_id !== user.id) : state.votes,
    });
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
    if (!user || !state || state.myAttendance?.status === "not_going") return;

    const existing = state.myVotes.find((vote) => vote.sport_id === sportId);
    if (existing) {
      setNotice(null);
      setState({
        ...state,
        myVotes: state.myVotes.filter((vote) => vote.sport_id !== sportId),
        votes: state.votes.filter((vote) => !(vote.user_id === user.id && vote.sport_id === sportId)),
      });
      const result = await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId });
      if (result.error) setNotice(result.error.message);
      void load();
      return;
    }

    const usedRanks = new Set(state.myVotes.map((vote) => vote.vote_rank));
    const rank = voteRanks.find((candidate) => !usedRanks.has(candidate)) ?? 3;
    const replaced = state.myVotes.find((vote) => vote.vote_rank === rank);

    if (replaced) {
      await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId: replaced.sport_id });
    }

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

    setNotice(null);
    setState({
      ...state,
      myVotes: nextMyVotes,
      votes: [
        ...state.votes.filter((vote) => !(vote.user_id === user.id && (vote.sport_id === sportId || vote.sport_id === replaced?.sport_id))),
        optimisticVote,
      ],
    });

    const result = await saveMccVoteRank(supabase, { eventId: state.event.id, userId: user.id, sportId, rank });
    if (result.error) setNotice(result.error.message);
    void load();
  }

  async function setRank(sportId: string, rank: VoteRank) {
    if (!user || !state || state.myAttendance?.status === "not_going") return;
    const replaced = state.myVotes.find((vote) => vote.vote_rank === rank && vote.sport_id !== sportId);

    if (replaced) {
      await clearMccVote(supabase, { eventId: state.event.id, userId: user.id, sportId: replaced.sport_id });
    }

    const result = await saveMccVoteRank(supabase, { eventId: state.event.id, userId: user.id, sportId, rank });
    if (result.error) setNotice(result.error.message);
    void load();
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
      <SafeAreaView style={styles.safeArea}>
        <Image source={logo} style={styles.backgroundLogo} resizeMode="contain" />
        <View style={styles.appShell}>
          <View style={styles.screen}>
            <Header />
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Event konnte nicht geladen werden</Text>
              <Text style={styles.body}>{notice ?? "Bitte prüfe Supabase und lade danach neu."}</Text>
              <PrimaryButton label="Neu laden" onPress={load} />
            </View>
          </View>
          <BottomNav active="event" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Image source={logo} style={styles.backgroundLogo} resizeMode="contain" />
      <View style={styles.appShell}>
        <Animated.ScrollView
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor="#ffffff" />}
          contentContainerStyle={styles.screen}
        >
          <Header />
          <View style={styles.hero}>
            <Text style={styles.kicker}>Diese Woche</Text>
            <Text style={styles.title}>Gemeinsamer Cardiotag</Text>
          </View>
          <Progress activeStep={activeStep} />
          {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}

          <Stage stepKey={activeStep}>
            {activeStep === "attendance" ? (
              <View style={styles.panel}>
                <Text style={styles.panelKicker}>Schritt 1</Text>
                <Text style={styles.panelTitle}>Bist du dabei?</Text>
                <View style={styles.optionStack}>
                  {attendanceOptions.map((option) => {
                    const active = state.myAttendance?.status === option.status;
                    return (
                      <Pressable
                        key={option.status}
                        style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
                        onPress={() => chooseAttendance(option.status)}
                      >
                        <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{option.title}</Text>
                        <Text style={[styles.optionBody, active && styles.optionBodyActive]}>{option.body}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {activeStep === "sports" ? (
              <View style={styles.panel}>
                <Text style={styles.panelKicker}>Schritt 2</Text>
                <Text style={styles.panelTitle}>Wähle deinen Mix</Text>
                <View style={styles.voteStack}>
                  {proposedSports.map((sport) => {
                    const vote = state.myVotes.find((row) => row.sport_id === sport.id);
                    return (
                      <Pressable
                        key={sport.id}
                        style={({ pressed }) => [styles.sportCard, vote && styles.sportCardActive, pressed && styles.pressed]}
                        onPress={() => chooseSport(sport.id)}
                      >
                        <View style={styles.sportTextWrap}>
                          <Text style={[styles.sportName, vote && styles.sportNameActive]}>{sport.name}</Text>
                          <Text style={[styles.sportMeta, vote && styles.sportMetaActive]}>
                            {sport.location_type} · {sport.intensity_level}
                          </Text>
                        </View>
                        {vote ? (
                          <View style={styles.rankPicker}>
                            {voteRanks.map((rank) => (
                              <Pressable
                                key={rank}
                                style={[styles.rankDot, vote.vote_rank === rank && styles.rankDotActive]}
                                onPress={() => setRank(sport.id, rank)}
                              >
                                <Text style={[styles.rankText, vote.vote_rank === rank && styles.rankTextActive]}>{rank}</Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.addMark}>+</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                <PrimaryButton label="Weiter zum Überblick" onPress={() => state.myVotes.length > 0 && setManualStep("overview")} disabled={state.myVotes.length === 0} />
              </View>
            ) : null}

            {activeStep === "overview" ? (
              <View style={styles.panel}>
                <Text style={styles.panelKicker}>Überblick</Text>
                <Text style={styles.panelTitle}>{decisionSportName}</Text>
                <View style={styles.pillRow}>
                  {state.decisionText.resultLabels.map((label) => (
                    <View key={label} style={styles.pill}>
                      <Text style={styles.pillText}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.body}>{state.event.decision_reason ?? state.decisionText.simpleExplanation}</Text>
                <View style={styles.detailGrid}>
                  <Detail label="Teilnahme" value={attendanceLabel(state.myAttendance?.status)} />
                  <Detail
                    label="Sportwahl"
                    value={
                      state.myAttendance?.status === "not_going"
                        ? "Nicht relevant"
                        : state.myVotes.map((vote) => `${vote.vote_rank}. ${sportName(state, vote.sport_id)}`).join(" · ")
                    }
                  />
                  <Detail label="Zeit" value={eventDate ? eventDate.toLocaleString("de-DE", { weekday: "long", hour: "2-digit", minute: "2-digit" }) : "Noch offen"} />
                  <Detail label="Ort" value={state.event.location ?? "Noch offen"} />
                </View>
                <View style={styles.actionRow}>
                  <SecondaryButton label="Teilnahme ändern" onPress={() => setManualStep("attendance")} />
                  {state.myAttendance?.status !== "not_going" ? <SecondaryButton label="Sport ändern" onPress={() => setManualStep("sports")} /> : null}
                </View>
                <PrimaryButton label="Zum Event-Chat" onPress={() => router.push("/chat")} />
              </View>
            ) : null}
          </Stage>
        </Animated.ScrollView>
        <BottomNav active="event" />
      </View>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <Pressable style={styles.menuButton} onPress={() => router.push("/menu")}>
        <Text style={styles.menuButtonText}>Menü</Text>
      </Pressable>
    </View>
  );
}

function Progress({ activeStep }: { activeStep: FlowStep }) {
  const steps: FlowStep[] = ["attendance", "sports", "overview"];
  const activeIndex = steps.indexOf(activeStep);

  return (
    <View style={styles.progress}>
      {steps.map((step, index) => (
        <View key={step} style={[styles.progressDot, index <= activeIndex && styles.progressDotActive]} />
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
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "Noch offen"}</Text>
    </View>
  );
}

function attendanceLabel(status?: AttendanceStatus): string {
  if (status === "going") return "Du bist dabei";
  if (status === "maybe") return "Vielleicht";
  if (status === "not_going") return "Du kannst nicht";
  return "Noch offen";
}

function sportName(state: MccEventState, sportId: string): string {
  return state.sports.find((sport) => sport.id === sportId)?.name ?? "Sportart";
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  appShell: { flex: 1 },
  screen: { gap: 18, padding: 18, paddingBottom: 34 },
  backgroundLogo: {
    position: "absolute",
    top: 82,
    right: -120,
    width: 380,
    height: 380,
    opacity: 0.055,
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  logo: { width: 50, height: 50 },
  menuButton: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 16, paddingVertical: 10 },
  menuButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  hero: { gap: 8, paddingTop: 10, paddingBottom: 2 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 38, fontWeight: "900", letterSpacing: 0, lineHeight: 42 },
  progress: { flexDirection: "row", gap: 8 },
  progressDot: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" },
  progressDotActive: { backgroundColor: "#4da3ff" },
  panel: {
    gap: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,17,27,0.94)",
    padding: 18,
    shadowColor: "#4da3ff",
    shadowOpacity: 0.13,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 24 },
  },
  panelKicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  panelTitle: { color: "#ffffff", fontSize: 31, fontWeight: "900", letterSpacing: 0, lineHeight: 35 },
  body: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
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
  rankPicker: { flexDirection: "row", gap: 6 },
  rankDot: { alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  rankDotActive: { backgroundColor: "#ffffff" },
  rankText: { color: "#d9ecff", fontWeight: "900" },
  rankTextActive: { color: "#05070b" },
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
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  notice: { borderRadius: 18, backgroundColor: "rgba(164,62,48,0.18)", padding: 12 },
  noticeText: { color: "#ffb5a8", fontSize: 14, fontWeight: "900", textAlign: "center" },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
  disabled: { opacity: 0.38 },
});
