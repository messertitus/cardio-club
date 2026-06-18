import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { EventFlowCard, type WeekEvent } from "../src/components/EventFlowCard";
import { InstallHintCard } from "../src/components/InstallHintCard";
import { MotionBackground, ScreenLoader } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
import { MainHeader } from "../src/components/PageHeader";
import { useTour, useTourTarget } from "../src/components/TourGuide";
import { useAuth } from "../src/context/AuthContext";
import { useNavChrome } from "../src/context/NavChromeContext";
import { useTheme } from "../src/context/ThemeContext";
import { lookupCityByPostalCode } from "../src/lib/postalCity";
import { supabase } from "../src/lib/supabase";
import { hasSeenIntro, markIntroSeen } from "../src/services/introState";
import { readLocalCache, writeLocalCache } from "../src/services/localCache";
import {
  decideInstallHint,
  dismissInstallHintForever,
  isStandaloneDisplay,
  readInstallHintEnvironment,
  readInstallHintState,
  recordAppUsage,
  type InstallHintVariant,
} from "../src/services/pwaInstallHint";
import { APP_EVENTS, getMccWeekEvents, getMyProfile, prefetchSecondaryTabs, trackAppEvent, triggerDueFinalize, updateProfileCity, type Row } from "../src/services";
import { eventDayTitle, formatEventDayDate, getWeekStartDate, isEventVisibleWindow } from "../src/services/date";

const seenCityPromptUserIds = new Set<string>();
// One "install hint seen" breadcrumb per session, to avoid inflating the counter
// when the reveal effect re-runs.
const installHintSeenTracked = new Set<string>();
// One login counts once. We dedupe by the session access token (not the user id),
// so signing in again — even as the same user — counts as a new login, while a
// tab remount with the same token does not. Maps the token to the counted value
// so re-evaluating the hint never inflates the usage count.
const loginUsageCounts = new Map<string, number>();
// Immediate in-memory guard keyed by userId → the usage count the user just acted
// on. Covers the brief window before the persisted state is written, so the hint
// can't flash back. The durable backstop is the persisted handledAtCount/dismissed.
const installHintHandledCounts = new Map<string, number>();
// The 2s reveal delay is anchored to the first time we decided to show it for a
// login, so a remount continues the countdown instead of restarting it.
const installHintDecidedAt = new Map<string, number>();
const INSTALL_HINT_REVEAL_DELAY_MS = 2000;

export default function HomeScreen() {
  const { loading, user, session } = useAuth();
  const { theme } = useTheme();
  const { onScroll } = useNavChrome();
  const [events, setEvents] = useState<Row<"weekly_events">[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsCity, setNeedsCity] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [cityBusy, setCityBusy] = useState(false);
  const [citySkipped, setCitySkipped] = useState(false);
  const [showNextWeek, setShowNextWeek] = useState(false);
  const [myCity, setMyCity] = useState<string | null>(null);
  const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set());
  const [addedEventIds, setAddedEventIds] = useState<Set<string>>(new Set());
  const [otherCitiesOpen, setOtherCitiesOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  // The guided tour starts once, only after the location step is resolved
  // (saved or skipped). `cityStepDone` gates it; the seen-flag lives locally.
  const { start: startTour } = useTour();
  const homeTarget = useTourTarget("home-events", { scroll: false });
  const [cityStepDone, setCityStepDone] = useState(false);
  const introCheckedForUserRef = useRef<string | null>(null);
  const [installHintVariant, setInstallHintVariant] = useState<InstallHintVariant | null>(null);
  const installHintCountRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    // Fire the one-time 48h finalize for any due event (idempotent, throttled),
    // so the decision is persisted before the events are read/cached.
    void triggerDueFinalize(supabase);
    const cacheKey = `mcc.weekEvents.${user.id}`;
    const cached = await readLocalCache<Row<"weekly_events">[]>(cacheKey, 15 * 60 * 1000);
    if (cached) setEvents((current) => current ?? cached);
    setBusy(true);
    const result = await getMccWeekEvents(supabase);
    setBusy(false);
    if (result.error) {
      if (!cached) setNotice(result.error.message);
      return;
    }
    setNotice(null);
    setEvents(result.data.events);
    void writeLocalCache(cacheKey, result.data.events);

    // Events the user already joined (any city) stay on the home page.
    const { data: attendanceRows } = await supabase.from("attendance").select("event_id").eq("user_id", user.id);
    if (attendanceRows) setJoinedEventIds(new Set(attendanceRows.map((row) => row.event_id)));

    // Warm the Members + Chat caches in the background (once per session) so the
    // first switch to those tabs paints instantly instead of showing a spinner.
    void prefetchSecondaryTabs(supabase, user.id);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    async function loadProfileCity() {
      if (!user) return;
      try {
        const result = await getMyProfile(supabase, user.id);
        if (result.data) setMyCity(result.data.city ?? null);
        if (result.data && !result.data.city && !citySkipped && !seenCityPromptUserIds.has(user.id)) {
          setNeedsCity(true);
          setPostalCode(result.data.postal_code ?? "");
          setCity(result.data.city ?? "");
          return; // The city prompt is showing; it will unblock the tour on save/skip.
        }
      } catch {
        // Fall through — never let a profile read error trap the location step.
      }
      // City already known or prompt handled earlier: nothing blocks the tour.
      setCityStepDone(true);
    }

    void loadProfileCity();
  }, [citySkipped, user]);

  // Once the location step is settled, start the guided tour exactly once per
  // account. The "seen" flag is persisted locally (AsyncStorage → localStorage),
  // so after the first run it never appears again within the same context. We
  // mark it seen as it starts, so even closing the app mid-tour won't bring it
  // back.
  useEffect(() => {
    if (!user || !cityStepDone) return;
    if (introCheckedForUserRef.current === user.id) return;
    introCheckedForUserRef.current = user.id;
    void hasSeenIntro(user.id).then((seen) => {
      if (seen) return;
      void markIntroSeen(user.id);
      // The installed PWA has its own storage, separate from the browser tab, so
      // the "seen" flag set in the browser doesn't carry over. Don't replay the
      // tour in the installed PWA — the user already saw the intro in the browser
      // before installing.
      if (isStandaloneDisplay()) return;
      startTour();
    });
  }, [cityStepDone, startTour, user]);

  // Returning-user nudge: offer installing the PWA / enabling push. Counts one
  // app start per session, then lets the persisted state + runtime decide. Never
  // fires on the first login and never requests a permission on its own.
  // One login = one increment. The token changes on every sign-in, so a fresh
  // login counts even for the same user; a tab remount reuses the same token.
  const loginKey = session?.access_token ?? user?.id ?? "";

  // Depend only on loginKey: a stable login keeps the same token, so the effect
  // runs once per login instead of re-running on every auth-context object change.
  useEffect(() => {
    const activeUser = user;
    if (!activeUser) return;
    let active = true;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    const userId = activeUser.id;

    async function evaluateInstallHint() {
      let usageCount = loginUsageCounts.get(loginKey);
      if (usageCount === undefined) {
        usageCount = await recordAppUsage(userId);
        loginUsageCounts.set(loginKey, usageCount);
      }
      installHintCountRef.current = usageCount;
      // Immediate guard: the user just acted on exactly this count.
      if (installHintHandledCounts.get(userId) === usageCount) {
        if (active) setInstallHintVariant(null);
        return;
      }
      const state = await readInstallHintState(userId);
      const decision = decideInstallHint({ usageCount, state, env: readInstallHintEnvironment() });
      if (!active) return;
      if (!decision.show) {
        setInstallHintVariant(null);
        return;
      }
      // Surface after a short beat, anchored to the first decision so a remount
      // continues the countdown rather than restarting it.
      const decidedAt = installHintDecidedAt.get(loginKey) ?? Date.now();
      installHintDecidedAt.set(loginKey, decidedAt);
      const remaining = Math.max(0, INSTALL_HINT_REVEAL_DELAY_MS - (Date.now() - decidedAt));
      showTimer = setTimeout(() => {
        if (active && installHintHandledCounts.get(userId) !== usageCount) {
          setInstallHintVariant(decision.variant);
          if (!installHintSeenTracked.has(userId)) {
            installHintSeenTracked.add(userId);
            void trackAppEvent(supabase, APP_EVENTS.installHintSeen, { context: { variant: decision.variant } });
          }
        }
      }, remaining);
    }

    void evaluateInstallHint();
    return () => {
      active = false;
      if (showTimer) clearTimeout(showTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginKey]);

  // Close the modal and remember (in memory, keyed by stable userId) that this
  // login count was handled, so a re-run of the effect can't flash it back. The
  // login counter naturally moves past the trigger on the next app open, so no
  // durable flag is needed for "Später"/"Mehr erfahren".
  function markHintHandledAndClose() {
    const count = installHintCountRef.current;
    if (user && count !== null) installHintHandledCounts.set(user.id, count);
    setInstallHintVariant(null);
  }

  // "Später": hide for this login; it returns on the next trigger login.
  function dismissInstallHintLater() {
    markHintHandledAndClose();
  }

  // "Nicht mehr anzeigen": never show again (persisted).
  function dismissInstallHintForeverPress() {
    markHintHandledAndClose();
    if (user) {
      void dismissInstallHintForever(user.id);
      void trackAppEvent(supabase, APP_EVENTS.installHintDismissed);
    }
  }

  function openInstallGuide() {
    // The push-only reminder leads to the Push screen (enable push there); the
    // install hint leads to the install guide.
    const target = installHintVariant === "push-only" ? "/push" : "/install";
    markHintHandledAndClose();
    router.push(target);
  }

  async function updatePostalCode(value: string) {
    const nextPostalCode = value.replace(/\D/g, "").slice(0, 5);
    setPostalCode(nextPostalCode);
    if (nextPostalCode.length !== 5) return;
    const resolvedCity = await lookupCityByPostalCode(nextPostalCode);
    // Only auto-fill when we actually resolved a city — never guess a wrong one.
    if (resolvedCity) setCity(resolvedCity);
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
    setMyCity(city.trim());
    setCitySkipped(true);
    setNeedsCity(false);
    setCityStepDone(true);
    return true;
  }

  function skipCityPrompt() {
    if (user) seenCityPromptUserIds.add(user.id);
    setCitySkipped(true);
    setNeedsCity(false);
    setCityStepDone(true);
  }

  if (loading || (!events && busy)) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
        <MotionBackground />
        <View style={styles.appShell}>
          <View style={styles.screen}>
            <Header />
            <ScreenLoader />
          </View>
          <BottomNav active="event" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) return <Redirect href="/auth" />;

  // Events appear 7 days before they happen and disappear after the event day.
  const windowEvents = (events ?? []).filter((event) => isEventVisibleWindow(event.week_start_date, event.event_day));
  // Events are local: show the user's own city plus any event they joined or
  // added from another city. Unknown city → show everything. City matching is
  // tolerant of case/whitespace so "Konstanz " or "konstanz" still match.
  const normalizedMyCity = (myCity ?? "").trim().toLowerCase();
  const isVisibleEvent = (event: Row<"weekly_events">) =>
    !normalizedMyCity ||
    (event.city ?? "").trim().toLowerCase() === normalizedMyCity ||
    joinedEventIds.has(event.id) ||
    addedEventIds.has(event.id);
  const visibleEvents = windowEvents.filter(isVisibleEvent);
  const otherCityEvents = windowEvents.filter((event) => !isVisibleEvent(event));

  // Group by the actual calendar week. Using the earliest week present would make
  // next week wrongly read as "Diese Woche" once the current week's events are over.
  const currentWeekStart = getWeekStartDate();
  const thisWeekEvents = visibleEvents.filter((event) => event.week_start_date <= currentWeekStart);
  const nextWeekEvents = visibleEvents.filter((event) => event.week_start_date > currentWeekStart);
  const noEventsThisWeek = visibleEvents.length > 0 && thisWeekEvents.length === 0;
  const upcomingExpanded = showNextWeek || noEventsThisWeek;

  const otherCitiesList = [...new Set(otherCityEvents.map((event) => event.city ?? "Andere Stadt"))].sort((a, b) => a.localeCompare(b));
  const cityQuery = citySearch.trim().toLowerCase();
  const filteredOtherCities = otherCitiesList.filter((cityName) => !cityQuery || cityName.toLowerCase().includes(cityQuery));

  function toWeekEvent(event: Row<"weekly_events">): WeekEvent {
    return { id: event.id, eventDay: event.event_day, weekStartDate: event.week_start_date, status: event.status };
  }

  function addOtherCityEvent(eventId: string) {
    setAddedEventIds((current) => new Set(current).add(eventId));
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      <View style={styles.appShell}>
        <Animated.ScrollView
          style={styles.scrollFill}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={theme.mcc.textPrimary} />}
          contentContainerStyle={styles.screen}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <Header />

          {/* The tour spotlights the event area only — not the header/title. */}
          <View ref={homeTarget.ref} onLayout={homeTarget.onLayout} style={styles.eventsArea}>
          {notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {visibleEvents.length === 0 ? (
            <View style={[styles.panel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
              <Text style={[styles.panelTitle, { color: theme.mcc.textPrimary }]}>Noch kein Cardiotag</Text>
              <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>
                {otherCityEvents.length > 0
                  ? `In ${myCity ?? "deiner Stadt"} läuft gerade kein Cardiotag. Unten findest du Events anderer Städte – tritt einfach bei.`
                  : "Diese Woche wird gerade vorbereitet. Schau gleich nochmal vorbei."}
              </Text>
            </View>
          ) : null}

          {thisWeekEvents.length > 0 ? (
            <View style={styles.weekGroup}>
              <Text style={[styles.weekLabel, { color: theme.mcc.accent }]}>Diese Woche</Text>
              {thisWeekEvents.map((event, eventIndex) => (
                <EventFlowCard key={event.id} userId={user.id} index={eventIndex} event={toWeekEvent(event)} />
              ))}
            </View>
          ) : null}

          {noEventsThisWeek ? (
            <View style={styles.weekGroup}>
              <Text style={[styles.weekLabel, { color: theme.mcc.accent }]}>Diese Woche</Text>
              <View style={[styles.emptyHighlight, { borderColor: theme.mcc.strongLine, backgroundColor: theme.mcc.accentFaint, shadowColor: theme.mcc.accent }]}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.mcc.surface, borderColor: theme.mcc.strongLine }]}>
                  <MaterialCommunityIcons name="calendar-check" size={28} color={theme.mcc.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.mcc.textPrimary }]}>Diese Woche ist durch</Text>
                <Text style={[styles.body, { color: theme.mcc.textSecondary, textAlign: "center" }]}>
                  Keine offenen Cardiotage mehr. Die nächsten stehen unten schon bereit – die Abstimmung öffnet rechtzeitig.
                </Text>
              </View>
            </View>
          ) : null}

          {nextWeekEvents.length > 0 ? (
            <View style={styles.weekGroup}>
              <Pressable
                style={({ pressed }) => [styles.nextWeekToggle, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }, pressed && styles.pressed]}
                onPress={() => setShowNextWeek((open) => !open)}
              >
                <View style={[styles.nextWeekIcon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine }]}>
                  <MaterialCommunityIcons name="calendar-arrow-right" size={20} color={theme.mcc.accent} />
                </View>
                <View style={styles.nextWeekText}>
                  <Text style={[styles.nextWeekTitle, { color: theme.mcc.textPrimary }]}>Nächste Woche</Text>
                  <Text style={[styles.nextWeekMeta, { color: theme.mcc.textSecondary }]}>
                    {nextWeekEvents.length} {nextWeekEvents.length === 1 ? "Cardiotag" : "Cardiotage"} · Vorschau, Abstimmung öffnet rechtzeitig
                  </Text>
                </View>
                <MaterialCommunityIcons name={upcomingExpanded ? "chevron-up" : "chevron-down"} size={26} color={theme.mcc.textSecondary} />
              </Pressable>
              {upcomingExpanded
                ? nextWeekEvents.map((event, eventIndex) => <EventFlowCard key={event.id} userId={user.id} index={eventIndex} event={toWeekEvent(event)} />)
                : null}
            </View>
          ) : null}

          {otherCityEvents.length > 0 ? (
            <View style={styles.weekGroup}>
              <Pressable
                style={({ pressed }) => [styles.nextWeekToggle, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }, pressed && styles.pressed]}
                onPress={() => setOtherCitiesOpen((open) => !open)}
              >
                <View style={[styles.nextWeekIcon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine }]}>
                  <MaterialCommunityIcons name="map-marker-radius" size={20} color={theme.mcc.accent} />
                </View>
                <View style={styles.nextWeekText}>
                  <Text style={[styles.nextWeekTitle, { color: theme.mcc.textPrimary }]}>Events anderer Städte</Text>
                  <Text style={[styles.nextWeekMeta, { color: theme.mcc.textSecondary }]}>
                    {otherCitiesList.length} {otherCitiesList.length === 1 ? "Stadt" : "Städte"} · beitreten und mitstimmen
                  </Text>
                </View>
                <MaterialCommunityIcons name={otherCitiesOpen ? "chevron-up" : "chevron-down"} size={26} color={theme.mcc.textSecondary} />
              </Pressable>
              {otherCitiesOpen ? (
                <View style={styles.otherCitiesBody}>
                  <TextInput
                    value={citySearch}
                    onChangeText={setCitySearch}
                    placeholder="Stadt suchen"
                    placeholderTextColor={theme.mcc.textSecondary}
                    style={[styles.citySearch, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
                  />
                  {filteredOtherCities.map((cityName) => (
                    <View key={cityName} style={styles.otherCityGroup}>
                      <Text style={[styles.weekLabel, { color: theme.mcc.accent }]}>{cityName}</Text>
                      {otherCityEvents
                        .filter((event) => (event.city ?? "Andere Stadt") === cityName)
                        .map((event) => (
                          <View key={event.id} style={[styles.otherCityRow, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
                            <View style={styles.nextWeekText}>
                              <Text style={[styles.nextWeekTitle, { color: theme.mcc.textPrimary }]}>{eventDayTitle(event.event_day)}</Text>
                              <Text style={[styles.nextWeekMeta, { color: theme.mcc.textSecondary }]}>{formatEventDayDate(event.week_start_date, event.event_day)}</Text>
                            </View>
                            <Pressable
                              style={({ pressed }) => [styles.joinButton, { backgroundColor: theme.mcc.accentDeep }, pressed && styles.pressed]}
                              onPress={() => addOtherCityEvent(event.id)}
                            >
                              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                              <Text style={styles.joinButtonText}>Beitreten</Text>
                            </Pressable>
                          </View>
                        ))}
                    </View>
                  ))}
                  {filteredOtherCities.length === 0 ? (
                    <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>Keine Stadt gefunden.</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
          </View>
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
        {/* Shown like the start-up location prompt, but only for returning users
            (2nd / 5th login) and never while the city prompt is still open. A
            plain overlay (last child, above the nav) — conditionally rendered, so
            closing or navigating removes it instantly. */}
        {installHintVariant && !needsCity ? (
          <InstallHintCard
            variant={installHintVariant}
            onLearnMore={openInstallGuide}
            onLater={dismissInstallHintLater}
            onNeverShow={dismissInstallHintForeverPress}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Header() {
  const { theme } = useTheme();

  return (
    <MainHeader
      title="Events"
      actions={
        <Pressable style={[styles.historyButton, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => router.push("/events/history")}>
          <MaterialCommunityIcons name="history" size={24} color={theme.mcc.textPrimary} />
        </Pressable>
      }
    />
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
        <Animated.View style={[styles.cityCard, { backgroundColor: theme.mcc.surface, borderColor: theme.mcc.line, opacity, transform: [{ translateY }, { scale }] }]}>
          <Text style={[styles.cityKicker, { color: theme.mcc.accent }]}>Kurz dein Standort</Text>
          <Text style={[styles.cityTitle, { color: theme.mcc.textPrimary }]}>Aus welcher Stadt kommst du?</Text>
          <TextInput
            value={postalCode}
            onChangeText={onPostalCodeChange}
            placeholder="PLZ"
            placeholderTextColor={theme.mcc.textSecondary}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            style={[styles.cityInput, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
          />
          <TextInput
            value={city}
            onChangeText={onCityChange}
            placeholder="Stadt"
            placeholderTextColor={theme.mcc.textSecondary}
            autoCapitalize="words"
            style={[styles.cityInput, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
          />
          <Pressable
            style={[styles.cityButton, { backgroundColor: theme.mcc.accentDeep }, (postalCode.length < 5 || !city.trim() || busy) && styles.disabled]}
            onPress={() => {
              void onSave();
            }}
            disabled={postalCode.length < 5 || !city.trim() || busy}
          >
            <Text style={[styles.cityButtonText, { color: "#FFFFFF" }]}>{busy ? "Speichern…" : "Speichern"}</Text>
          </Pressable>
          <Pressable style={styles.citySkip} onPress={closeWithAnimation}>
            <Text style={[styles.citySkipText, { color: theme.mcc.textSecondary }]}>Später</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  appShell: { flex: 1 },
  scrollFill: { flex: 1 },
  screen: { flexGrow: 1, gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 },
  eventsArea: { gap: 16 },
  historyButton: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  weekGroup: { gap: 12 },
  weekLabel: { fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  nextWeekToggle: { alignItems: "center", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  nextWeekIcon: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  nextWeekText: { flex: 1, minWidth: 0 },
  nextWeekTitle: { fontSize: 17, fontWeight: "900" },
  nextWeekMeta: { fontSize: 13, fontWeight: "700" },
  otherCitiesBody: { gap: 12 },
  citySearch: { minHeight: 48, borderRadius: 16, borderWidth: 1, fontSize: 15, paddingHorizontal: 14, outlineStyle: "none" } as object,
  otherCityGroup: { gap: 8 },
  otherCityRow: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  joinButton: { alignItems: "center", borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 9 },
  joinButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  panel: { gap: 10, borderRadius: 24, borderWidth: 1, padding: 16 },
  emptyHighlight: {
    alignItems: "center",
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
  },
  emptyIcon: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 56, justifyContent: "center", width: 56 },
  emptyTitle: { fontSize: 19, fontWeight: "900" },
  panelTitle: { fontSize: 22, fontWeight: "900" },
  body: { fontSize: 15, lineHeight: 22 },
  notice: { borderRadius: 18, backgroundColor: "rgba(164,62,48,0.18)", padding: 12 },
  noticeText: { color: "#ffb5a8", fontSize: 14, fontWeight: "900", textAlign: "center" },
  cityOverlay: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 14, paddingBottom: 92, backgroundColor: "rgba(0,0,0,0.18)" },
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
  cityInput: { minHeight: 54, borderRadius: 18, borderWidth: 1, fontSize: 17, paddingHorizontal: 14, outlineStyle: "none" } as object,
  cityButton: { alignItems: "center", borderRadius: 18, paddingVertical: 15 },
  cityButtonText: { fontSize: 15, fontWeight: "900" },
  citySkip: { alignItems: "center", paddingVertical: 5 },
  citySkipText: { fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.38 },
});
