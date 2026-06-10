import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import type { VoteRank } from "../lib/votingRules";
import { formatEventDayDate, getWeekStartDate, isDecisionReleaseOpen, isEventPast, isVotingInputOpen } from "../services/date";
import {
  canCloseEvent,
  clearMccNoGo,
  clearMccVote,
  getEventStateById,
  proposeSport,
  saveMccAttendance,
  saveMccNoGo,
  saveMccVoteRank,
  type AttendanceStatus,
  type MccEventState,
} from "../services";
import { readLocalCache, writeLocalCache } from "../services/localCache";
import { categoryLabel, intensityLabel } from "../lib/sportLabels";
import { FlowStepRail, ScreenLoader, SmoothReveal, WeeklyEventHeroCard } from "./MccDesign";
import { MapRouteButton } from "./MapRouteButton";
import { MotionPressable, Reveal } from "./Motion";
import { SearchField } from "./FormControls";
import { SportIconBadge } from "./SportIcon";
import type { EventDay } from "../services/date";

export type WeekEvent = {
  id: string;
  eventDay: EventDay;
  weekStartDate: string;
  status: MccEventState["event"]["status"];
};

type FlowStep = "attendance" | "sports" | "overview";

const voteRanks: VoteRank[] = [1, 2, 3];

const attendanceOptions: Array<{ status: AttendanceStatus; title: string; body: string }> = [
  { status: "going", title: "Ich bin dabei", body: "Du wirst eingeplant und kannst abstimmen." },
  { status: "maybe", title: "Vielleicht", body: "Du kannst abstimmen, bleibst aber flexibel." },
  { status: "not_going", title: "Ich kann nicht", body: "Du wirst nicht in die Abstimmung gezählt." },
];

export function EventFlowCard({ event, userId, index = 0 }: { event: WeekEvent; userId: string; index?: number }) {
  const { theme } = useTheme();
  const [state, setState] = useState<MccEventState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualStep, setManualStep] = useState<FlowStep | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const initRef = useRef(false);
  const doneRef = useRef(false);

  const cacheKey = `mcc.eventState.${event.id}.${userId}`;

  function initExpansion(snapshot: MccEventState) {
    if (initRef.current) return;
    initRef.current = true;
    const done = computeUserDone(snapshot, event.eventDay, event.weekStartDate);
    doneRef.current = done;
    setExpanded(!done);
  }

  const load = useCallback(async () => {
    // Show cached state instantly, then refresh in the background.
    const cached = await readLocalCache<MccEventState>(cacheKey, 15 * 60 * 1000);
    if (cached) {
      setState((current) => current ?? cached);
      initExpansion(cached);
    }
    setBusy(true);
    const result = await getEventStateById(supabase, userId, event.id);
    setBusy(false);
    if (result.error) {
      if (!cached) setNotice(result.error.message);
      return;
    }
    setNotice(null);
    setState(result.data);
    void writeLocalCache(cacheKey, result.data);
    initExpansion(result.data);
    const decided =
      result.data.event.status === "decided" || result.data.event.status === "completed" || isDecisionReleaseOpen(event.weekStartDate, event.eventDay);
    const past = isEventPast(event.weekStartDate, event.eventDay);
    const manage = await canCloseEvent(supabase, event.id, userId);
    const isManager = Boolean(manage.data);
    setCanManage(isManager);
    // Managers keep the flow open during the wrap-up phase so results / attendance /
    // closing stay reachable. While voting, even managers collapse once done.
    if (isManager && (decided || past)) setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, event.eventDay, event.id, event.weekStartDate, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // When the user has finished this event's input, gently collapse the flow a
  // moment later so the next open Cardiotag moves into the foreground. We only
  // collapse once the user has reached the overview step (pressed "Weiter" or
  // chose "nicht dabei") — picking a sport must NOT yank the card away mid-vote.
  const userDone = state ? computeUserDone(state, event.eventDay, event.weekStartDate) : false;
  useEffect(() => {
    if (!initRef.current || !state) return;
    const decided = state.event.status === "decided" || state.event.status === "completed" || isDecisionReleaseOpen(event.weekStartDate, event.eventDay);
    const past = isEventPast(event.weekStartDate, event.eventDay);
    if (canManage && (decided || past)) return; // managers keep the wrap-up view open
    if (userDone && manualStep === "overview" && !doneRef.current) {
      doneRef.current = true;
      const timer = setTimeout(() => setExpanded(false), 1100);
      return () => clearTimeout(timer);
    }
    if (!userDone) doneRef.current = false;
  }, [canManage, event.eventDay, event.weekStartDate, manualStep, state, userDone]);

  if (!state) {
    return <ScreenLoader />;
  }

  const isDecided =
    state.event.status === "decided" || state.event.status === "completed" || isDecisionReleaseOpen(event.weekStartDate, event.eventDay);
  const votingInputOpen = isVotingInputOpen(event.weekStartDate, event.eventDay);
  const eventPast = isEventPast(event.weekStartDate, event.eventDay);
  const eventCompleted = state.event.status === "completed";
  const naturalStep: FlowStep = isDecided
    ? "overview"
    : !state.myAttendance
      ? "attendance"
      : state.myAttendance.status === "not_going"
        ? "overview"
        : state.myVotes.length === 0
          ? "sports"
          : "overview";
  const activeStep = manualStep ?? naturalStep;

  const primaryActivity = state.decisionText.activityRows[0] ?? null;
  const secondaryActivity = state.decisionText.activityRows[1] ?? null;
  const decisionSportName = isDecided ? (primaryActivity?.sportName ?? state.decisionText.selectedSportName) : "Auswahl gespeichert";
  const decisionLocation = isDecided ? (primaryActivity?.locationName ?? null) : null;
  const secondaryDecisionName = isDecided ? (secondaryActivity?.sportName ?? undefined) : undefined;
  const decisionTitle = isDecided && secondaryDecisionName ? `${decisionSportName} + ${secondaryDecisionName}` : decisionSportName;
  const heroTitle = isDecided ? decisionTitle : event.eventDay === "saturday" ? "Cardio-Samstag" : "Cardio-Sonntag";
  const isCurrentWeek = event.weekStartDate <= getWeekStartDate();
  // The week badge distinguishes a decided event (get ready), an upcoming
  // next-week event, and the current week's running vote.
  const weekTag = isDecided
    ? { label: "Mach dich bereit", icon: "rocket-launch-outline" as const }
    : isCurrentWeek
      ? { label: "Diese Woche", icon: "pulse" as const }
      : { label: "Demnächst", icon: "calendar-arrow-right" as const };
  const goingCount = state.attendance.filter((entry) => entry.status === "going").length;
  const maybeCount = state.attendance.filter((entry) => entry.status === "maybe").length;
  const votersCount = new Set(state.votes.map((vote) => vote.user_id)).size;
  const phaseLabel = eventCompleted ? "Abgeschlossen" : eventPast ? "Vorbei" : isDecided ? "Entscheidung steht" : votingInputOpen ? "Voting läuft" : "Bald";
  const myFairness = state.decision.explainability.fairnessByUser.find((entry) => entry.userId === userId) ?? null;
  const isExpanded = expanded ?? !userDone;
  const attending = state.myAttendance?.status === "going" || state.myAttendance?.status === "maybe";
  const myChoiceSummary =
    state.myAttendance?.status === "not_going"
      ? "Nicht dabei"
      : state.myVotes.length > 0
        ? state.myVotes.map((vote) => `${vote.vote_rank}. ${sportName(state, vote.sport_id)}`).join(" · ")
        : state.myAttendance
          ? "Dabei – noch nicht abgestimmt"
          : "Noch offen";
  const heroCtaLabel = isDecided && activeStep === "overview" ? "Zum Event-Chat" : undefined;
  const heroFlowTarget =
    activeStep === "attendance"
      ? { label: "Teilnahme", icon: "account-check-outline" as const, tone: "success" as const }
      : activeStep === "sports"
        ? { label: "Voting", icon: "vote-outline" as const, tone: "accent" as const }
        : { label: "Club", icon: "trophy-outline" as const, tone: isDecided ? ("success" as const) : ("warning" as const) };

  const selectableSports = (() => {
    const query = sportSearch.trim().toLowerCase();
    return state.sports.filter((sport) => {
      if (!query) return true;
      const profileText = state.sportProfiles
        .filter((profile) => profile.sport_id === sport.id)
        .map((profile) => [profile.name, profile.location_name, profile.venue_group_key].filter(Boolean).join(" "))
        .join(" ");
      return [sport.name, sport.category, sport.combinable_tags?.join(" "), profileText].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  })();

  async function chooseAttendance(status: AttendanceStatus) {
    if (!state) return;
    const previousState = state;
    const optimisticAttendance = {
      id: state.myAttendance?.id ?? "optimistic-attendance",
      event_id: state.event.id,
      user_id: userId,
      status,
      subgroup_id: null,
      actual_status: null,
      checked_by: null,
      checked_at: null,
      created_at: state.myAttendance?.created_at ?? new Date().toISOString(),
    };
    const nextState: MccEventState = {
      ...state,
      attendance: [optimisticAttendance, ...state.attendance.filter((row) => row.user_id !== userId)],
      myAttendance: optimisticAttendance,
      myVotes: status === "not_going" ? [] : state.myVotes,
      votes: status === "not_going" ? state.votes.filter((vote) => vote.user_id !== userId) : state.votes,
    };
    setNotice(null);
    setState(nextState);
    setManualStep(status === "not_going" ? "overview" : "sports");
    const result = await saveMccAttendance(supabase, { eventId: state.event.id, userId, status });
    if (result.error) {
      setState(previousState);
      setNotice(result.error.message);
      return;
    }
    if (status === "not_going") {
      await Promise.all(previousState.myVotes.map((vote) => clearMccVote(supabase, { eventId: state.event.id, userId, sportId: vote.sport_id })));
    }
    void load();
  }

  async function chooseSport(sportId: string) {
    if (!state || !canInfluenceDecision(state.myAttendance?.status) || isDecided) return;
    if (state.myNoGos.some((noGo) => noGo.sport_id === sportId)) return;
    const existing = state.myVotes.find((vote) => vote.sport_id === sportId);
    if (existing) {
      const nextState: MccEventState = {
        ...state,
        myVotes: state.myVotes.filter((vote) => vote.sport_id !== sportId),
        votes: state.votes.filter((vote) => !(vote.user_id === userId && vote.sport_id === sportId)),
      };
      setNotice(null);
      setState(nextState);
      const result = await clearMccVote(supabase, { eventId: state.event.id, userId, sportId });
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
      user_id: userId,
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
      proposed_by: userId,
      note: null,
      created_at: new Date().toISOString(),
    };
    const nextState: MccEventState = {
      ...state,
      proposals: hasProposal ? state.proposals : [optimisticProposal, ...state.proposals],
      myVotes: nextMyVotes,
      votes: [...state.votes.filter((vote) => !(vote.user_id === userId && (vote.sport_id === sportId || vote.sport_id === replaced?.sport_id))), optimisticVote],
    };
    setNotice(null);
    setState(nextState);
    if (replaced) {
      const clearResult = await clearMccVote(supabase, { eventId: state.event.id, userId, sportId: replaced.sport_id });
      if (clearResult.error) {
        setNotice(clearResult.error.message);
        void load();
        return;
      }
    }
    if (!hasProposal) {
      const proposalResult = await proposeSport(supabase, { eventId: state.event.id, sportId, proposedBy: userId, note: null });
      if (proposalResult.error) {
        setNotice(proposalResult.error.message);
        void load();
        return;
      }
    }
    const result = await saveMccVoteRank(supabase, { eventId: state.event.id, userId, sportId, rank });
    if (result.error) {
      setNotice(result.error.message);
      void load();
    }
  }

  async function toggleNoGo(sportId: string) {
    if (!state || !canInfluenceDecision(state.myAttendance?.status) || isDecided) return;
    const existing = state.myNoGos.find((noGo) => noGo.sport_id === sportId);
    setNotice(null);
    if (existing) {
      const nextState: MccEventState = {
        ...state,
        myNoGos: state.myNoGos.filter((noGo) => noGo.sport_id !== sportId),
        noGos: state.noGos.filter((noGo) => !(noGo.user_id === userId && noGo.sport_id === sportId)),
      };
      setState(nextState);
      const result = await clearMccNoGo(supabase, { eventId: state.event.id, userId, sportId });
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
      user_id: userId,
      reason: null,
      created_at: new Date().toISOString(),
    };
    const nextState: MccEventState = {
      ...state,
      myVotes: existingVote ? state.myVotes.filter((vote) => vote.sport_id !== sportId) : state.myVotes,
      votes: existingVote ? state.votes.filter((vote) => !(vote.user_id === userId && vote.sport_id === sportId)) : state.votes,
      myNoGos: [optimisticNoGo, ...state.myNoGos.filter((noGo) => noGo.sport_id !== sportId)],
      noGos: [optimisticNoGo, ...state.noGos.filter((noGo) => !(noGo.user_id === userId && noGo.sport_id === sportId))],
    };
    setState(nextState);
    if (existingVote) {
      const clearResult = await clearMccVote(supabase, { eventId: state.event.id, userId, sportId });
      if (clearResult.error) {
        setNotice(clearResult.error.message);
        void load();
        return;
      }
    }
    const result = await saveMccNoGo(supabase, { eventId: state.event.id, userId, sportId });
    if (result.error) {
      setNotice(result.error.message);
      void load();
    }
  }

  async function setRank(sportId: string, rank: VoteRank) {
    if (!state || !canInfluenceDecision(state.myAttendance?.status) || isDecided) return;
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
          user_id: userId,
          weight: rank === 1 ? 1 : rank === 2 ? 0.6 : 0.3,
          vote_rank: rank,
          created_at: new Date().toISOString(),
        };
    const optimisticProposal = {
      id: `optimistic-proposal-${sportId}`,
      event_id: state.event.id,
      sport_id: sportId,
      proposed_by: userId,
      note: null,
      created_at: new Date().toISOString(),
    };
    const nextState: MccEventState = {
      ...state,
      proposals: hasProposal ? state.proposals : [optimisticProposal, ...state.proposals],
      myVotes: [...state.myVotes.filter((vote) => vote.sport_id !== sportId && vote.sport_id !== replaced?.sport_id), updatedVote].sort((a, b) => a.vote_rank - b.vote_rank),
      votes: [...state.votes.filter((vote) => !(vote.user_id === userId && (vote.sport_id === sportId || vote.sport_id === replaced?.sport_id))), updatedVote],
    };
    setNotice(null);
    setState(nextState);
    if (replaced) {
      const clearResult = await clearMccVote(supabase, { eventId: state.event.id, userId, sportId: replaced.sport_id });
      if (clearResult.error) {
        setNotice(clearResult.error.message);
        void load();
        return;
      }
    }
    if (!hasProposal) {
      const proposalResult = await proposeSport(supabase, { eventId: state.event.id, sportId, proposedBy: userId, note: null });
      if (proposalResult.error) {
        setNotice(proposalResult.error.message);
        void load();
        return;
      }
    }
    const result = await saveMccVoteRank(supabase, { eventId: state.event.id, userId, sportId, rank });
    if (result.error) {
      setNotice(result.error.message);
      void load();
    }
  }

  if (!isExpanded) {
    return (
      <Reveal index={index}>
        <Pressable
          style={({ pressed }) => [
            styles.collapsed,
            { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface },
            attending
              ? {
                  opacity: 1,
                  borderColor: theme.mcc.accent,
                  backgroundColor: theme.mcc.accentFaint,
                  shadowColor: theme.mcc.accent,
                  shadowOpacity: 0.35,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 6 },
                }
              : styles.collapsedDim,
            pressed && styles.pressed,
          ]}
          onPress={() => setExpanded(true)}
        >
          <View
            style={[
              styles.collapsedIcon,
              { backgroundColor: theme.mcc.surfaceSoft, borderColor: theme.mcc.line },
              attending && { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine },
            ]}
          >
            {isDecided ? (
              <SportIconBadge sport={state.sports.find((sport) => sport.id === state.decision.selectedSportId)} size={36} />
            ) : attending ? (
              <MaterialCommunityIcons name="heart-pulse" size={22} color={theme.mcc.accent} />
            ) : (
              <MaterialCommunityIcons name="calendar-blank-outline" size={20} color={theme.mcc.textMuted} />
            )}
          </View>
          <View style={styles.collapsedText}>
            <Text style={[styles.collapsedTitle, { color: theme.mcc.textPrimary }]}>{heroTitle}</Text>
            <Text style={[styles.collapsedMeta, { color: theme.mcc.textSecondary }]} numberOfLines={1}>
              {formatEventDayDate(event.weekStartDate, event.eventDay)} · {isDecided ? phaseLabel : `Deine Wahl: ${myChoiceSummary}`}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-down" size={24} color={theme.mcc.textMuted} />
        </Pressable>
      </Reveal>
    );
  }

  return (
    <Reveal index={index} style={styles.wrap}>
      <SmoothReveal>
        <View style={styles.expandedInner}>
      <WeeklyEventHeroCard
        title={heroTitle}
        subtitle={
          isDecided
            ? `${secondaryDecisionName ? "Multi-Sport" : state.decisionText.decisionCharacterLabel}${decisionLocation ? ` · ${decisionLocation}` : ""}`
            : "Stimmt ab, der Club entscheidet fair."
        }
        status={phaseLabel}
        dateLabel={formatEventDayDate(event.weekStartDate, event.eventDay)}
        flowTarget={heroFlowTarget}
        weekTag={weekTag}
        chips={[
          { label: `${goingCount} + ${maybeCount} Dabei`, icon: "account-group-outline", tone: "neutral" },
          { label: `${votersCount} abgestimmt`, icon: "vote-outline", tone: "accent" },
          { label: attendanceLabel(state.myAttendance?.status), icon: "check-circle-outline", tone: canInfluenceDecision(state.myAttendance?.status) ? "success" : "neutral" },
        ]}
        ctaLabel={heroCtaLabel}
        onCtaPress={() => {
          if (isDecided && activeStep === "overview") {
            router.push("/chat");
            return;
          }
          if (activeStep === "overview") {
            setManualStep(canInfluenceDecision(state.myAttendance?.status) ? "sports" : "attendance");
            return;
          }
          setManualStep(activeStep);
        }}
      />

      {!eventPast ? (
        <FlowStepRail
          completed={isDecided}
          activeIndex={["attendance", "sports", "overview"].indexOf(activeStep)}
          onStepPress={(stepIndex) => {
            // Decided events no longer change votes — the rail just reveals the
            // collapsed details instead of reopening the voting panels.
            if (isDecided) {
              setDetailsOpen(true);
              return;
            }
            setManualStep((["attendance", "sports", "overview"] as const)[stepIndex]);
          }}
          steps={[
            { label: "Teilnahme", icon: "account-check-outline" },
            { label: "Sportwahl", icon: "vote-outline" },
            { label: "Überblick", icon: "trophy-outline" },
          ]}
        />
      ) : null}

      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {myFairness && (myFairness.ignoredWeeks > 0 || myFairness.fairnessDebt > 0) ? (
        <View style={[styles.fairnessNote, { borderColor: theme.mcc.strongLine, backgroundColor: theme.mcc.accentFaint }]}>
          <MaterialCommunityIcons name="scale-balance" size={20} color={theme.mcc.accent} />
          <View style={styles.fairnessText}>
            <Text style={[styles.fairnessTitle, { color: theme.mcc.textPrimary }]}>Fairness-Bonus aktiv</Text>
            <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>
              {myFairness.coveredByDecision
                ? "Deine zuletzt übergangenen Wünsche wurden hier berücksichtigt."
                : "Deine zuletzt übergangenen Wünsche sind vermerkt – beim nächsten Mal zählt deine Stimme stärker."}
            </Text>
          </View>
        </View>
      ) : null}

      {isDecided || eventPast ? (
        <Pressable
          style={({ pressed }) => [styles.detailsToggle, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }, pressed && styles.pressed]}
          onPress={() => setDetailsOpen((open) => !open)}
        >
          <MaterialCommunityIcons name={detailsOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.mcc.accent} />
          <Text style={[styles.detailsToggleText, { color: theme.mcc.textPrimary }]}>
            {detailsOpen ? "Details ausblenden" : isDecided ? "Entscheidung & Details anzeigen" : "Details anzeigen"}
          </Text>
        </Pressable>
      ) : null}

      {(isDecided || eventPast) && !detailsOpen ? null : (
      <Stage stepKey={`${event.id}:${activeStep}`}>
        {activeStep === "attendance" && !eventPast ? (
          <View style={[styles.panel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
            <Text style={[styles.panelKicker, { color: theme.mcc.accent }]}>Deine Teilnahme</Text>
            <Text style={[styles.panelTitle, { color: theme.mcc.textPrimary }]}>Bist du dabei?</Text>
            <View style={styles.optionStack}>
              {attendanceOptions.map((option, optionIndex) => {
                const active = state.myAttendance?.status === option.status;
                return (
                  <Reveal key={option.status} index={optionIndex}>
                    <MotionPressable
                      style={[
                        styles.option,
                        styles.optionRow,
                        { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft },
                        active && { borderColor: theme.mcc.accent, backgroundColor: theme.mcc.accentDeep },
                      ]}
                      pressedStyle={styles.pressed}
                      onPress={() => {
                        if (votingInputOpen) void chooseAttendance(option.status);
                      }}
                    >
                      <View style={styles.optionTextWrap}>
                        <Text style={[styles.optionTitle, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{option.title}</Text>
                        <Text style={[styles.optionBody, { color: active ? "#FFFFFF" : theme.mcc.textSecondary }]}>{option.body}</Text>
                      </View>
                      {active ? (
                        <SmoothReveal>
                          <View style={styles.optionCheck}>
                            <MaterialCommunityIcons name="check-bold" size={18} color={theme.mcc.accentDeep} />
                          </View>
                        </SmoothReveal>
                      ) : (
                        <View style={[styles.optionRadio, { borderColor: theme.mcc.line }]} />
                      )}
                    </MotionPressable>
                  </Reveal>
                );
              })}
            </View>
          </View>
        ) : null}

        {activeStep === "sports" && !eventPast ? (
          <View style={[styles.panel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
            <Text style={[styles.panelKicker, { color: theme.mcc.accent }]}>Deine Sportwahl</Text>
            <Text style={[styles.panelTitle, { color: theme.mcc.textPrimary }]}>Wähle deinen Mix</Text>
            <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart oder Standort suchen" />
            <View style={styles.voteStack}>
              {selectableSports.map((sport, sportIndex) => {
                const vote = state.myVotes.find((row) => row.sport_id === sport.id);
                const noGo = state.myNoGos.some((row) => row.sport_id === sport.id);
                const profileHint = profileSummary(state, sport.id);
                return (
                  <Reveal key={sport.id} index={sportIndex}>
                    <MotionPressable
                      style={[
                        styles.sportCard,
                        { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft },
                        vote && { borderColor: theme.mcc.accent, backgroundColor: theme.mcc.accentDeep },
                        noGo && { borderColor: "#ff8d7a", backgroundColor: "rgba(255,126,106,0.14)" },
                      ]}
                      pressedStyle={styles.pressed}
                    >
                      <SportIconBadge sport={sport} size={36} />
                      <View style={styles.sportTextWrap}>
                        <Text style={[styles.sportName, { color: vote ? "#FFFFFF" : theme.mcc.textPrimary }]}>{sport.name}</Text>
                        <Text style={[styles.sportMeta, { color: vote ? "#FFFFFF" : theme.mcc.textSecondary }]}>
                          {categoryLabel(sport.category)} · {intensityLabel(sport.intensity_level)}
                        </Text>
                        {profileHint ? <Text style={[styles.sportMeta, { color: vote ? "#FFFFFF" : theme.mcc.textSecondary }]}>{profileHint}</Text> : null}
                      </View>
                      <View style={styles.voteControls}>
                        {noGo ? null : (
                          <View style={styles.rankPicker}>
                            {voteRanks.map((rank) => (
                              <Pressable
                                key={rank}
                                style={[styles.rankDot, { backgroundColor: theme.mcc.surfaceSoft }, vote?.vote_rank === rank && styles.rankDotActive]}
                                onPress={() => {
                                  if (votingInputOpen) void setRank(sport.id, rank);
                                }}
                              >
                                <Text style={[styles.rankText, { color: theme.mcc.textSecondary }, vote?.vote_rank === rank && styles.rankTextActive]}>{rank}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                        {vote ? (
                          <Pressable
                            style={styles.removeVoteButton}
                            onPress={() => {
                              if (votingInputOpen) void chooseSport(sport.id);
                            }}
                          >
                            <MaterialCommunityIcons name="close" size={16} color="#FFFFFF" />
                          </Pressable>
                        ) : null}
                        <Pressable
                          style={noGo ? styles.noGoButton : styles.noGoGhost}
                          onPress={() => {
                            if (votingInputOpen) void toggleNoGo(sport.id);
                          }}
                        >
                          <Text style={noGo ? styles.noGoButtonText : [styles.noGoGhostText, { color: theme.mcc.textSecondary }]}>No-Go</Text>
                        </Pressable>
                      </View>
                    </MotionPressable>
                  </Reveal>
                );
              })}
            </View>
            {selectableSports.length === 0 ? <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>Keine Sportarten für diese Suche.</Text> : null}
            <PrimaryButton label="Weiter zum Überblick" onPress={() => state.myVotes.length > 0 && setManualStep("overview")} disabled={state.myVotes.length === 0} />
          </View>
        ) : null}

        {activeStep === "overview" || eventPast ? (
          <View style={[styles.panel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
            <Text style={[styles.panelKicker, { color: theme.mcc.accent }]}>{isDecided ? "Entscheidung" : "Deine Auswahl"}</Text>
            <Text style={[styles.panelTitle, { color: theme.mcc.textPrimary }]}>{isDecided ? decisionTitle : "Alles gespeichert"}</Text>
            {!isDecided ? (
              <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>
                Teilnahme und Stimmen sind gesichert. Die Sportart bleibt bis zur Auswertung eine Überraschung – du kannst deine Auswahl jederzeit anpassen.
              </Text>
            ) : null}
            {isDecided ? (
              <>
                <View style={styles.pillRow}>
                  {state.decisionText.resultLabels.map((label) => (
                    <View key={label} style={[styles.pill, { backgroundColor: theme.mcc.surfaceSoft }]}>
                      <Text style={[styles.pillText, { color: theme.mcc.accent }]}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>{state.event.decision_reason ?? state.decisionText.simpleExplanation}</Text>
                {homeActivityRows(state).map((activity) => (
                  <View key={activity.key} style={styles.activityRouteRow}>
                    <Text style={[styles.body, styles.activityRouteText, { color: theme.mcc.textPrimary }]}>{activity.label}</Text>
                    <MapRouteButton target={activity.mapTarget} compact />
                  </View>
                ))}
              </>
            ) : null}
            <View style={styles.detailGrid}>
              <Detail label="Teilnahme" value={attendanceLabel(state.myAttendance?.status)} />
              <Detail
                label="Deine Stimmen"
                value={
                  state.myAttendance?.status === "not_going"
                    ? "Nicht relevant"
                    : state.myVotes.length > 0
                      ? state.myVotes.map((vote) => `${vote.vote_rank}. ${sportName(state, vote.sport_id)}`).join(" · ")
                      : "Noch keine Stimme"
                }
              />
              {state.myNoGos.length > 0 ? <Detail label="No-Go" value={state.myNoGos.map((noGo) => sportName(state, noGo.sport_id)).join(", ")} /> : null}
            </View>
            {!isDecided && !eventPast ? (
              <View style={styles.actionRow}>
                <SecondaryButton label="Teilnahme ändern" onPress={() => setManualStep("attendance")} />
                {canInfluenceDecision(state.myAttendance?.status) ? <SecondaryButton label="Sport ändern" onPress={() => setManualStep("sports")} /> : null}
              </View>
            ) : null}
            {isDecided ? (
              <>
                <SecondaryButton label="Entscheidung im Detail" onPress={() => router.push({ pathname: "/events/[eventId]/decision", params: { eventId: event.id } })} />
                {!eventPast ? <PrimaryButton label="Zum Event-Chat" onPress={() => router.push("/chat")} /> : null}
              </>
            ) : null}
            {canManage && (isDecided || eventPast) ? (
              <View style={[styles.manage, { borderTopColor: theme.mcc.line }]}>
                <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>Verwaltung (Admin / Moderator / AP):</Text>
                <SecondaryButton label="Anwesenheit eintragen" onPress={() => router.push({ pathname: "/events/[eventId]/attendance", params: { eventId: event.id } })} />
                <SecondaryButton label="Ergebnisse eintragen" onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId: event.id } })} />
                {!eventCompleted ? <PrimaryButton label="Event abschließen" onPress={() => router.push({ pathname: "/events/[eventId]/close", params: { eventId: event.id } })} /> : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </Stage>
      )}
      {userDone ? (
        <Pressable style={styles.minimize} onPress={() => setExpanded(false)}>
          <MaterialCommunityIcons name="chevron-up" size={18} color={theme.mcc.textMuted} />
          <Text style={[styles.minimizeText, { color: theme.mcc.textMuted }]}>Minimieren</Text>
        </Pressable>
      ) : null}
        </View>
      </SmoothReveal>
    </Reveal>
  );
}

function Stage({ children, stepKey }: { children: ReactNode; stepKey: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, [opacity, stepKey, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.mcc.accentDeep }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.primaryButtonText, { color: "#FFFFFF" }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }, pressed && styles.pressed]} onPress={onPress}>
      <Text style={[styles.secondaryButtonText, { color: theme.mcc.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.detail, { borderTopColor: theme.mcc.line }]}>
      <Text style={[styles.detailLabel, { color: theme.mcc.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.mcc.textPrimary }]}>{value || "Noch offen"}</Text>
    </View>
  );
}

function computeUserDone(state: MccEventState, eventDay: EventDay, weekStartDate: string): boolean {
  const decided = state.event.status === "decided" || state.event.status === "completed" || isDecisionReleaseOpen(weekStartDate, eventDay);
  if (decided || isEventPast(weekStartDate, eventDay)) return true;
  const status = state.myAttendance?.status;
  if (status === "not_going") return true;
  if ((status === "going" || status === "maybe") && state.myVotes.length > 0) return true;
  return false;
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

function profileSummary(state: MccEventState, sportId: string): string {
  const profiles = state.sportProfiles.filter((profile) => profile.sport_id === sportId);
  if (profiles.length === 0) return "Noch kein konkretes Sportprofil";
  const locations = profiles.map((profile) => profile.location_name).filter(Boolean);
  const locationText = [...new Set(locations)].slice(0, 2).join(", ");
  return `${profiles.length} Profil${profiles.length === 1 ? "" : "e"}${locationText ? ` · ${locationText}` : ""}`;
}

function sportProfileMapTarget(profile: MccEventState["sportProfiles"][number]) {
  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    mapUrl: profile.map_url,
    label: [profile.location_name, profile.location_city, profile.postal_code].filter(Boolean).join(" "),
  };
}

function homeActivityRows(
  state: MccEventState,
): Array<{ key: string; label: string; mapTarget: { latitude?: number | null; longitude?: number | null; label?: string | null; mapUrl?: string | null } | null }> {
  if (state.eventActivities.length > 0) {
    return state.eventActivities.map((activity) => {
      const count = (activity.assigned_user_ids ?? []).length;
      const profile = state.sportProfiles.find((entry) => entry.id === activity.sport_profile_id);
      return {
        key: activity.id,
        label: `${activity.title}${count > 0 ? ` · ${count} Personen` : ""}`,
        mapTarget: profile ? sportProfileMapTarget(profile) : activity.location ? { label: activity.location } : null,
      };
    });
  }

  return state.decisionText.activityRows.map((activity) => {
    const profile = state.sportProfiles.find((entry) => entry.id === activity.profileId);
    const place = activity.locationName ?? activity.profileName;
    return {
      key: activity.profileId,
      label: `${activity.sportName} · ${place} · ${activity.participantCount} Personen`,
      mapTarget: profile ? sportProfileMapTarget(profile) : activity.locationName ? { label: activity.locationName } : null,
    };
  });
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  expandedInner: { gap: 14 },
  collapsed: { alignItems: "center", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  collapsedDim: { opacity: 0.5 },
  collapsedIcon: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  collapsedText: { flex: 1, minWidth: 0, gap: 2 },
  collapsedTitle: { fontSize: 17, fontWeight: "900" },
  collapsedMeta: { fontSize: 13, fontWeight: "700" },
  detailsToggle: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13 },
  detailsToggleText: { fontSize: 14, fontWeight: "900" },
  minimize: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 4, paddingVertical: 6 },
  minimizeText: { fontSize: 13, fontWeight: "900" },
  panel: {
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  panelKicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  panelTitle: { fontSize: 26, fontWeight: "900", letterSpacing: 0, lineHeight: 30 },
  body: { fontSize: 15, lineHeight: 22 },
  optionStack: { gap: 10 },
  option: { gap: 5, borderRadius: 18, borderWidth: 1, padding: 16 },
  optionRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  optionTextWrap: { flex: 1, minWidth: 0, gap: 4 },
  optionTitle: { fontSize: 18, fontWeight: "900" },
  optionBody: { fontSize: 14 },
  optionCheck: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, height: 30, justifyContent: "center", width: 30 },
  optionRadio: { borderRadius: 999, borderWidth: 2, height: 24, width: 24 },
  voteStack: { gap: 10 },
  sportCard: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12, borderRadius: 18, borderWidth: 1, padding: 15 },
  sportTextWrap: { flex: 1, gap: 3 },
  sportName: { fontSize: 17, fontWeight: "900" },
  sportMeta: { fontSize: 13 },
  voteControls: { alignItems: "center", gap: 7 },
  rankPicker: { flexDirection: "row", gap: 6 },
  rankDot: { alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 12 },
  rankDotActive: { backgroundColor: "#ffffff" },
  rankText: { fontWeight: "900" },
  rankTextActive: { color: "#05070b" },
  removeVoteButton: { alignItems: "center", borderRadius: 999, height: 28, justifyContent: "center", width: 28 },
  noGoButton: { borderRadius: 999, backgroundColor: "rgba(255,126,106,0.22)", paddingHorizontal: 10, paddingVertical: 8 },
  noGoButtonText: { color: "#ffb5a8", fontSize: 12, fontWeight: "900" },
  noGoGhost: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  noGoGhostText: { fontSize: 12, fontWeight: "900" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: "900" },
  detailGrid: { gap: 8 },
  detail: { borderTopWidth: 1, gap: 2, paddingTop: 10 },
  detailLabel: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  detailValue: { fontSize: 15, fontWeight: "800" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  manage: { borderTopWidth: 1, gap: 8, paddingTop: 12 },
  primaryButton: { alignItems: "center", borderRadius: 18, paddingVertical: 14 },
  primaryButtonText: { fontSize: 15, fontWeight: "900" },
  secondaryButton: { flexGrow: 1, minWidth: 132, alignItems: "center", borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12 },
  secondaryButtonText: { fontSize: 14, fontWeight: "900" },
  activityRouteRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  activityRouteText: { flex: 1, minWidth: 0 },
  fairnessNote: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  fairnessText: { flex: 1, minWidth: 0, gap: 3 },
  fairnessTitle: { fontSize: 14, fontWeight: "900" },
  notice: { borderRadius: 18, backgroundColor: "rgba(164,62,48,0.18)", padding: 12 },
  noticeText: { color: "#ffb5a8", fontSize: 14, fontWeight: "900", textAlign: "center" },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
  disabled: { opacity: 0.38 },
});
