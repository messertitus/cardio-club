import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
} from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { APP_EVENTS } from "../lib/analyticsEvents";
import { trackAppEvent } from "../services/analytics";
import { markIntroSeen } from "../services/introState";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type Rect = { x: number; y: number; width: number; height: number };

// A single guided step. `nav` (if set) is the route we push when the user
// advances — that is how the tour walks across screens. `targetKey` is the
// highlighted element; the bottom-nav keys live on every screen at the same
// position, so they never flicker between screens.
type TourStep = {
  targetKey: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  praise: string;
  icon: IconName;
  // When this step becomes active, the tour navigates to this route first so the
  // real page is already on screen before the spotlight lands on it.
  navTo?: string;
  // Optional steps auto-skip when their target isn't on screen (e.g. the event
  // card on an empty week), so the tour never stalls on a missing element.
  optional?: boolean;
  // While this step is active, the first event card mirrors this flow step so
  // the matching panel (attendance / sports) is on screen to be highlighted.
  previewStep?: "attendance" | "sports";
  // Renders a playful, date-aware title ("Bist du dabei am …?").
  askAttend?: boolean;
  // Content steps: the highlight is fully pass-through so the page underneath
  // stays scrollable and tappable (e.g. the long sports list). Advance via the
  // "Weiter" button. Nav-tab steps leave this off so a tap on the tab advances.
  passThrough?: boolean;
};

const STEPS: TourStep[] = [
  {
    targetKey: "home-events",
    kicker: "Start",
    title: "Dein Homescreen",
    body: "Hier siehst du den aktuellen Cardio-Tag und den Status der Woche.",
    cta: "Weiter",
    praise: "Los geht's!",
    icon: "home-variant-outline",
    passThrough: true,
  },
  {
    targetKey: "event-attendance-0",
    kicker: "Schritt 1 · Teilnahme",
    title: "Bist du dabei?",
    body: "Sag zuerst Bescheid: dabei, vielleicht oder diesmal nicht. Nur als Teilnehmer:in zählt deine Stimme.",
    cta: "Weiter",
    praise: "Stark!",
    icon: "account-check-outline",
    optional: true,
    askAttend: true,
    previewStep: "attendance",
    passThrough: true,
  },
  {
    targetKey: "event-sports-0",
    kicker: "Schritt 2 · Sportwahl",
    title: "Setz deine Prioritäten",
    body: "Wähl die Sportarten, die du dir für {date} am meisten wünschst, und vergib Rang 1–3 – Rang 1 ist dein Favorit. Was nicht passt, markierst du als No-Go: z. B. wenn dir das Equipment fehlt oder du wirklich keine Lust darauf hast.",
    cta: "Weiter",
    praise: "Cool!",
    icon: "vote-outline",
    optional: true,
    previewStep: "sports",
    passThrough: true,
  },
  {
    targetKey: "nav-chat",
    kicker: "Chat",
    title: "Sprecht euch ab",
    body: "Im Chat klärt ihr Fragen und Details zum Event. Hier kommst du rein.",
    cta: "Weiter",
    praise: "Weiter so!",
    icon: "forum-outline",
  },
  {
    targetKey: "nav-members",
    kicker: "Mitglieder",
    title: "Wer ist im Club",
    body: "Hier siehst du alle Mitglieder – mit Stadt, Rolle und Profil.",
    cta: "Weiter",
    praise: "Top!",
    icon: "account-group-outline",
  },
  {
    targetKey: "ideas-create",
    kicker: "Mitmachen",
    title: "Bring den Club voran",
    body: "Hier schlägst du neue Sportarten und Standorte vor. Davon lebt der Club: Je mehr gute Ideen ihr eintragt, desto abwechslungsreicher werden die Wochen!",
    cta: "Los geht's",
    praise: "Willkommen!",
    icon: "lightbulb-on-outline",
    navTo: "/ideas",
  },
];

type TourContextValue = {
  active: boolean;
  activeKey: string | null;
  measureNonce: number;
  // The flow step the event card should mirror while the tour walks the vote.
  previewStep: "attendance" | "sports" | null;
  // The first event card reports its date label so a step can ask about it.
  eventLabel: string | null;
  setEventLabel: (label: string | null) => void;
  start: () => void;
  reportTarget: (key: string, rect: Rect) => void;
  clearTarget: (key: string) => void;
};

const TourContext = createContext<TourContextValue>({
  active: false,
  activeKey: null,
  measureNonce: 0,
  previewStep: null,
  eventLabel: null,
  setEventLabel: () => undefined,
  start: () => undefined,
  reportTarget: () => undefined,
  clearTarget: () => undefined,
});

export function useTour() {
  return useContext(TourContext);
}

// Attach the returned `ref`/`onLayout` to any element you want the tour to be
// able to spotlight. Reports the on-screen rect while the tour is active and
// re-measures whenever the step changes or the layout shifts.
export function useTourTarget(key: string, options?: { scroll?: boolean }) {
  // Fixed elements (e.g. the bottom nav) pass scroll:false so we never try to
  // scroll them into view — that would yank a non-scrollable bar and jump.
  const scrollEnabled = options?.scroll !== false;
  const { active, activeKey, measureNonce, reportTarget, clearTarget } = useTour();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      // Hidden/back-stacked screens (display:none on web) report a 0-sized box;
      // ignoring those keeps the spotlight on the visible screen only.
      if (width > 0 && height > 0) reportTarget(key, { x, y, width, height });
    });
  }, [key, reportTarget]);

  useEffect(() => {
    if (!active) return undefined;
    measure();
    // Re-measure a few times so navigation/layout/scroll settling lands the
    // spotlight (the last tick covers a smooth scrollIntoView finishing).
    const timers = [60, 220, 520, 820].map((delay) => setTimeout(measure, delay));
    return () => timers.forEach(clearTimeout);
  }, [active, measureNonce, measure]);

  // When this element becomes the active step's target and is partly off-screen,
  // scroll it into view (web/PWA only). Skipped for already-visible or fixed
  // targets so the page doesn't jump around. The RNW ref is the DOM node.
  useEffect(() => {
    if (!active || activeKey !== key || !scrollEnabled || typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((_x, y, _w, h) => {
      if (h <= 0) return;
      const viewportHeight = window.innerHeight || 0;
      if (y >= 0 && y + h <= viewportHeight) return; // already fully visible
      const dom = node as unknown as { scrollIntoView?: (o?: { behavior?: string; block?: string }) => void };
      dom.scrollIntoView?.({ behavior: "smooth", block: "center" });
    });
  }, [active, activeKey, key, scrollEnabled]);

  useEffect(() => () => clearTarget(key), [clearTarget, key]);

  return { ref, onLayout: measure };
}

export function TourProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [measureNonce, setMeasureNonce] = useState(0);
  const [targets, setTargets] = useState<Record<string, Rect>>({});
  const [eventLabel, setEventLabel] = useState<string | null>(null);
  const activeRef = useRef(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const reportTarget = useCallback((key: string, rect: Rect) => {
    setTargets((current) => {
      const previous = current[key];
      if (previous && previous.x === rect.x && previous.y === rect.y && previous.width === rect.width && previous.height === rect.height) {
        return current;
      }
      return { ...current, [key]: rect };
    });
  }, []);

  const clearTarget = useCallback((key: string) => {
    setTargets((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const finish = useCallback(() => {
    activeRef.current = false;
    if (user) {
      void markIntroSeen(user.id);
      void trackAppEvent(supabase, APP_EVENTS.onboardingCompleted);
    }
    setActive(false);
    setIndex(0);
    indexRef.current = 0;
  }, [user]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    indexRef.current = 0;
    setIndex(0);
    setActive(true);
    setMeasureNonce((nonce) => nonce + 1);
  }, []);

  const advance = useCallback(() => {
    if (indexRef.current >= STEPS.length - 1) {
      finish();
      return;
    }
    const nextIndex = indexRef.current + 1;
    const nextStep = STEPS[nextIndex];
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    // Navigate as we ENTER the step, so the destination page is already on
    // screen when its spotlight appears (no extra click needed).
    if (nextStep?.navTo) router.push(nextStep.navTo as never);
    setMeasureNonce((nonce) => nonce + 1);
  }, [finish]);

  // Re-measure on viewport resize (web) so the spotlight tracks the layout.
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    if (active) setMeasureNonce((nonce) => nonce + 1);
  }, [active, width, height]);

  // Re-measure while the user scrolls (web) so the spotlight follows its target
  // — the tour stays scrollable when a panel runs past the screen edge.
  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setMeasureNonce((nonce) => nonce + 1);
      });
    };
    // Capture phase so scrolls inside nested scroll containers are caught too.
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [active]);

  const activeKey = active ? STEPS[index]?.targetKey ?? null : null;
  const previewStep = active ? STEPS[index]?.previewStep ?? null : null;
  const value = useMemo<TourContextValue>(
    () => ({ active, activeKey, measureNonce, previewStep, eventLabel, setEventLabel, start, reportTarget, clearTarget }),
    [active, activeKey, clearTarget, eventLabel, measureNonce, previewStep, reportTarget, start],
  );

  return (
    <TourContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {active ? (
          <TourOverlay step={STEPS[index]} index={index} total={STEPS.length} rect={targets[STEPS[index].targetKey]} eventLabel={eventLabel} onAdvance={advance} onSkip={finish} />
        ) : null}
      </View>
    </TourContext.Provider>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);
  return reduced;
}

function TourOverlay({
  step,
  index,
  total,
  rect,
  eventLabel,
  onAdvance,
  onSkip,
}: {
  step: TourStep;
  index: number;
  total: number;
  rect?: Rect;
  eventLabel: string | null;
  onAdvance: () => void;
  onSkip: () => void;
}) {
  const { mode } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  // Fully neutral, grey palette so the tour reads as its own layer rather than
  // another blue app surface. `point` is the single high-contrast tone used for
  // the spotlight ring, arrow and CTA — greyscale, no brand blue.
  const ui =
    mode === "dark"
      ? { scrim: "rgba(16,17,20,0.78)", card: "#24262c", line: "rgba(255,255,255,0.14)", title: "#F3F4F6", body: "#B4B8C0", faint: "rgba(255,255,255,0.08)", dot: "rgba(255,255,255,0.24)", point: "#F4F5F7", pointInk: "#1B1E24" }
      : { scrim: "rgba(34,36,41,0.42)", card: "#FFFFFF", line: "rgba(17,18,21,0.12)", title: "#1B1E24", body: "#5C616B", faint: "rgba(17,18,21,0.05)", dot: "rgba(17,18,21,0.18)", point: "#23252b", pointInk: "#FFFFFF" };
  const title = step.askAttend ? (eventLabel ? `Bist du dabei am ${eventLabel}?` : "Bist du dabei?") : step.title;
  const body = step.body.replace("{date}", eventLabel ?? "diese Woche");
  const pulse = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  // Feedback phase: on advance the step card hides and a short praise message
  // shows in its place; only then does the next step appear.
  const [feedback, setFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Beacon pulse around the spotlight + the pointing arrow bounce.
  useEffect(() => {
    if (reduced) return undefined;
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const bounceAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();
    bounceAnim.start();
    return () => {
      pulseAnim.stop();
      bounceAnim.stop();
    };
  }, [bounce, pulse, reduced]);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  // Advance with a short feedback beat: hide the card, show the praise, then
  // move on (navigation in onAdvance happens after the beat).
  const handleAdvance = useCallback(() => {
    if (feedback) return;
    setFeedbackText(step.praise);
    setFeedback(true);
    feedbackAnim.setValue(0);
    Animated.spring(feedbackAnim, { toValue: 1, damping: 15, stiffness: 190, useNativeDriver: true }).start();
    feedbackTimer.current = setTimeout(() => {
      setFeedback(false);
      onAdvance();
    }, 760);
  }, [feedback, feedbackAnim, onAdvance, step.praise]);

  // Optional steps auto-skip when their target never shows up (e.g. the event
  // card is missing on an empty week), so the tour never stalls.
  useEffect(() => {
    if (!step.optional || rect || feedback) return undefined;
    const timer = setTimeout(onAdvance, 900);
    return () => clearTimeout(timer);
  }, [feedback, onAdvance, rect, step]);

  const pad = 10;
  // Clamp the spotlight to stay on screen. A tall target (e.g. the home feed)
  // gets its top portion highlighted so the spotlight always sits on a real
  // element and never balloons to a full-screen, centered box.
  const maxHoleH = height * 0.46;
  const hole = rect
    ? {
        x: Math.max(6, rect.x - pad),
        y: Math.max(6, rect.y - pad),
        w: Math.min(width - 12, rect.width + pad * 2),
        h: Math.min(rect.height + pad * 2, maxHoleH),
      }
    : null;
  // Only fall back to a centered card while the target is still being measured.
  const centered = !hole;
  // Put the tooltip above the target when the spotlight sits in the lower half.
  const tooltipAbove = hole ? hole.y + hole.h / 2 > height * 0.55 : false;
  const dim = ui.scrim;

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.35] });
  const arrowShift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, tooltipAbove ? 8 : -8] });
  const feedbackScale = feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {hole ? (
        <>
          {/* Four dim panels framing the spotlight hole. pointerEvents="none" so
              scroll/touch passes through to the page underneath — the tour stays
              scrollable and the spotlight tracks the target as it moves. */}
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, top: 0, left: 0, right: 0, height: Math.max(0, hole.y) }]} />
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }]} />
          <View pointerEvents="none" style={[styles.dim, { backgroundColor: dim, top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderColor: ui.point, shadowColor: ui.point, opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />

          {/* Content steps stay fully pass-through (scroll + tap the real page);
              you advance with "Weiter". Nav-tab steps keep a transparent tap
              target so a tap on the highlight advances the tour. */}
          {step.passThrough ? null : (
            <Pressable accessibilityRole="button" onPress={handleAdvance} style={[styles.tapTarget, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]} />
          )}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.arrow,
              {
                left: hole.x + hole.w / 2 - 17,
                top: tooltipAbove ? hole.y - 40 : hole.y + hole.h + 6,
                backgroundColor: ui.point,
                transform: [{ translateY: arrowShift }],
              },
            ]}
          >
            <MaterialCommunityIcons name={tooltipAbove ? "chevron-down" : "chevron-up"} size={24} color={ui.pointInk} />
          </Animated.View>
        </>
      ) : (
        // Target not measured yet (just navigated): dim everything, keep the card.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.tooltipWrap,
          centered
            ? { top: Math.max(80, Math.min(height * 0.28, height - 320)) }
            : tooltipAbove
              ? { bottom: Math.min(height - 120, Math.max(24, height - hole!.y + 16)) }
              : { top: Math.min(height - 300, Math.max(80, hole!.y + hole!.h + 16)) },
        ]}
      >
        {feedback ? (
          <Animated.View
            style={[styles.feedbackCard, { backgroundColor: ui.card, borderColor: ui.line, shadowColor: "#000000", opacity: feedbackAnim, transform: [{ scale: feedbackScale }] }]}
          >
            <View style={[styles.feedbackTick, { backgroundColor: "#22C55E" }]}>
              <MaterialCommunityIcons name="check-bold" size={22} color="#FFFFFF" />
            </View>
            <Text style={[styles.feedbackText, { color: ui.title }]}>{feedbackText}</Text>
          </Animated.View>
        ) : (
          <View style={[styles.card, { backgroundColor: ui.card, borderColor: ui.line, shadowColor: "#000000" }]}>
            <View style={styles.topRow}>
              <View style={styles.dots}>
                {Array.from({ length: total }).map((_, dotIndex) => (
                  <View
                    key={dotIndex}
                    style={[styles.dot, { backgroundColor: dotIndex === index ? ui.point : ui.dot, width: dotIndex === index ? 22 : 7 }]}
                  />
                ))}
              </View>
              <Pressable hitSlop={10} onPress={onSkip} accessibilityRole="button">
                <Text style={[styles.skip, { color: ui.body }]}>Tour beenden</Text>
              </Pressable>
            </View>

            <View style={styles.headRow}>
              <View style={[styles.iconBadge, { backgroundColor: ui.faint, borderColor: ui.line }]}>
                <MaterialCommunityIcons name={step.icon} size={22} color={ui.title} />
              </View>
              <View style={styles.headText}>
                <Text style={[styles.kicker, { color: ui.body }]}>{step.kicker}</Text>
                <Text style={[styles.title, { color: ui.title }]}>{title}</Text>
              </View>
            </View>

            <Text style={[styles.body, { color: ui.body }]}>{body}</Text>

            <MccTourButton label={step.cta} onPress={handleAdvance} backgroundColor={ui.point} textColor={ui.pointInk} />
          </View>
        )}
      </View>
    </View>
  );
}

function MccTourButton({ label, onPress, backgroundColor, textColor }: { label: string; onPress: () => void; backgroundColor: string; textColor: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.975, damping: 18, stiffness: 220, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }).start()}
    >
      <Animated.View style={[styles.button, { backgroundColor, transform: [{ scale }] }]}>
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color={textColor} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { position: "absolute" },
  ring: { position: "absolute", borderRadius: 20, borderWidth: 2.5, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  tapTarget: { position: "absolute", borderRadius: 16 },
  arrow: { position: "absolute", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  tooltipWrap: { position: "absolute", left: 0, right: 0, paddingHorizontal: 14, alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 430,
    gap: 12,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowOpacity: 0.26,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  topRow: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  dots: { alignItems: "center", flexDirection: "row", gap: 6 },
  dot: { borderRadius: 999, height: 7 },
  skip: { fontSize: 13, fontWeight: "900" },
  headRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  iconBadge: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontSize: 22, fontWeight: "900", lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 22 },
  button: { alignItems: "center", borderRadius: 16, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 16 },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  feedbackCard: {
    width: "100%",
    maxWidth: 430,
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowOpacity: 0.26,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  feedbackTick: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", width: 38 },
  feedbackText: { fontSize: 20, fontWeight: "900" },
});
