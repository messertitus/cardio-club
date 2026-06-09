import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { EventFlowCard, type WeekEvent } from "../src/components/EventFlowCard";
import { MotionBackground, ScreenLoader } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
import { MainHeader } from "../src/components/PageHeader";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { lookupCityByPostalCode } from "../src/lib/postalCity";
import { supabase } from "../src/lib/supabase";
import { readLocalCache, writeLocalCache } from "../src/services/localCache";
import { getMccWeekEvents, getMyProfile, updateProfileCity, type Row } from "../src/services";

const seenCityPromptUserIds = new Set<string>();

export default function HomeScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [events, setEvents] = useState<Row<"weekly_events">[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsCity, setNeedsCity] = useState(false);
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [cityBusy, setCityBusy] = useState(false);
  const [citySkipped, setCitySkipped] = useState(false);
  const [showNextWeek, setShowNextWeek] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
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
    setCitySkipped(true);
    setNeedsCity(false);
    return true;
  }

  function skipCityPrompt() {
    if (user) seenCityPromptUserIds.add(user.id);
    setCitySkipped(true);
    setNeedsCity(false);
  }

  if (loading || (!events && busy)) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
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

  const weeks = events ? [...new Set(events.map((event) => event.week_start_date))] : [];
  const thisWeekStart = weeks[0];
  const thisWeekEvents = (events ?? []).filter((event) => event.week_start_date === thisWeekStart);
  const nextWeekEvents = (events ?? []).filter((event) => event.week_start_date !== thisWeekStart);

  function toWeekEvent(event: Row<"weekly_events">): WeekEvent {
    return { id: event.id, eventDay: event.event_day, weekStartDate: event.week_start_date, status: event.status };
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      <View style={styles.appShell}>
        <Animated.ScrollView
          refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={theme.mcc.textPrimary} />}
          contentContainerStyle={styles.screen}
        >
          <Header />

          {notice ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {events && events.length === 0 ? (
            <View style={[styles.panel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
              <Text style={[styles.panelTitle, { color: theme.mcc.textPrimary }]}>Noch kein Cardiotag</Text>
              <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>Diese Woche wird gerade vorbereitet. Schau gleich nochmal vorbei.</Text>
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
                    {nextWeekEvents.length} {nextWeekEvents.length === 1 ? "Cardiotag" : "Cardiotage"} · jetzt schon vorab abstimmen
                  </Text>
                </View>
                <MaterialCommunityIcons name={showNextWeek ? "chevron-up" : "chevron-down"} size={26} color={theme.mcc.textSecondary} />
              </Pressable>
              {showNextWeek
                ? nextWeekEvents.map((event, eventIndex) => <EventFlowCard key={event.id} userId={user.id} index={eventIndex} event={toWeekEvent(event)} />)
                : null}
            </View>
          ) : null}
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

function Header() {
  const { theme } = useTheme();

  return (
    <MainHeader
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
  screen: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  historyButton: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  weekGroup: { gap: 12 },
  weekLabel: { fontSize: 13, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  nextWeekToggle: { alignItems: "center", borderRadius: 20, borderWidth: 1, flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  nextWeekIcon: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  nextWeekText: { flex: 1, minWidth: 0 },
  nextWeekTitle: { fontSize: 17, fontWeight: "900" },
  nextWeekMeta: { fontSize: 13, fontWeight: "700" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  panel: { gap: 10, borderRadius: 24, borderWidth: 1, padding: 16 },
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
