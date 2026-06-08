import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

const darkLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../../assets/mcc-logo-color-symbol.png");

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type Tone = "accent" | "success" | "warning" | "danger" | "neutral";
type MccTokens = ReturnType<typeof useTheme>["theme"]["mcc"];

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

function toneColor(tone: Tone, tokens: MccTokens) {
  if (tone === "success") return tokens.success;
  if (tone === "warning") return tokens.warning;
  if (tone === "danger") return tokens.danger;
  if (tone === "neutral") return tokens.textMuted;
  return tokens.accent;
}

export function MccScreen({
  children,
  title,
  subtitle,
  kicker,
  scroll = true,
  bottomInset = 36,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  kicker?: string;
  scroll?: boolean;
  bottomInset?: number;
}) {
  const { theme } = useTheme();
  const content = (
    <View style={[styles.screenContent, { paddingBottom: bottomInset }]}>
      {title ? <MccHero kicker={kicker} title={title} subtitle={subtitle} compact /> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function MotionBackground() {
  const { mode, theme } = useTheme();
  const reduced = useReducedMotion();
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 5200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 5200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift, reduced]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [10, -12] });
  const scale = drift.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.backgroundBase, { backgroundColor: theme.mcc.background }]} />
      <Animated.Image
        source={mode === "dark" ? darkLogo : lightLogo}
        resizeMode="contain"
        style={[
          styles.backgroundLogo,
          {
            opacity: mode === "dark" ? 0.09 : 0.12,
            transform: [{ translateX }, { translateY }, { scale }],
          },
        ]}
      />
    </View>
  );
}

export function MccHero({
  kicker,
  title,
  subtitle,
  children,
  compact = false,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      {kicker ? <Text style={[styles.kicker, { color: theme.mcc.accent }]}>{kicker}</Text> : null}
      <Text style={[styles.heroTitle, compact && styles.heroTitleCompact, { color: theme.mcc.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.heroSubtitle, { color: theme.mcc.textSecondary }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function MccCard({
  children,
  accent = false,
  animatedLine,
  style,
}: {
  children: ReactNode;
  accent?: boolean;
  animatedLine?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const showAnimatedLine = animatedLine ?? accent;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? theme.mcc.surfaceRaised : theme.mcc.surface,
          borderColor: accent ? theme.mcc.strongLine : theme.mcc.line,
          shadowColor: theme.mcc.shadow,
        },
        style,
      ]}
    >
      {showAnimatedLine ? <PulseLine /> : null}
      {children}
    </View>
  );
}

export function MccButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const color = variant === "primary" ? "#FFFFFF" : variant === "danger" ? theme.mcc.danger : theme.mcc.textPrimary;
  const backgroundColor =
    variant === "primary" ? theme.mcc.accentDeep : variant === "danger" ? theme.mcc.dangerSoft : variant === "ghost" ? "transparent" : theme.mcc.surfaceSoft;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.975, damping: 18, stiffness: 220, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }).start()}
    >
      <Animated.View
        style={[
          styles.button,
          { backgroundColor, borderColor: variant === "primary" ? "transparent" : theme.mcc.line, opacity: disabled ? 0.45 : 1, transform: [{ scale }] },
          style,
        ]}
      >
        {icon ? <MaterialCommunityIcons name={icon} size={18} color={color} /> : null}
        <Text style={[styles.buttonText, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function MccBadge({ children, tone = "accent", icon }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  const { theme } = useTheme();
  const color = toneColor(tone, theme.mcc);
  return (
    <View style={[styles.badge, { backgroundColor: tone === "neutral" ? theme.mcc.surfaceSoft : theme.mcc.accentFaint, borderColor: `${color}55` }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={13} color={color} /> : null}
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

export function MccCardTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  return <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }, style]}>{children}</Text>;
}

export function MccBody({ children, muted = false, style }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  return <Text style={[styles.bodyText, { color: muted ? theme.mcc.textSecondary : theme.mcc.textPrimary }, style]}>{children}</Text>;
}

export function PulseLine() {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 2600, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-140, 180] });

  return (
    <View pointerEvents="none" style={styles.pulseClip}>
      <View style={[styles.pulseTrack, { backgroundColor: theme.mcc.line }]} />
      <Animated.View style={[styles.pulseSignal, { backgroundColor: theme.mcc.accent, transform: [{ translateX }] }]} />
    </View>
  );
}

export function CardioRing({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduced]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });

  return (
    <View style={[styles.cardioRing, { borderColor: theme.mcc.strongLine, backgroundColor: theme.mcc.accentFaint }]}>
      <Animated.View style={[styles.cardioRingPulse, { borderColor: theme.mcc.accent, opacity, transform: [{ scale }] }]} />
      <MaterialCommunityIcons name="heart-pulse" size={31} color={theme.mcc.accent} />
      <View style={styles.pulseBars}>
        <View style={[styles.pulseBar, { backgroundColor: theme.mcc.accent }]} />
        <View style={[styles.pulseBar, styles.pulseBarTall, { backgroundColor: theme.mcc.accent }]} />
        <View style={[styles.pulseBar, { backgroundColor: theme.mcc.accent }]} />
      </View>
    </View>
  );
}

function OrbitingArc({ size = 38 }: { size?: number }) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1050, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [reduced, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={[
        styles.orbitArc,
        {
          height: size,
          width: size,
          borderTopColor: theme.mcc.accent,
          borderRightColor: theme.mcc.accent,
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

export function FlowStepRail({
  steps,
  activeIndex,
}: {
  steps: Array<{ label: string; icon?: IconName }>;
  activeIndex: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.flowRail, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
      {steps.map((step, index) => {
        const active = index <= activeIndex;
        return (
          <View key={step.label} style={styles.flowStep}>
            <View style={[styles.flowNode, { backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surfaceSoft, borderColor: active ? theme.mcc.accent : theme.mcc.line }]}>
              {index === activeIndex ? <OrbitingArc size={40} /> : null}
              <MaterialCommunityIcons name={step.icon ?? "circle-small"} size={15} color={active ? "#FFFFFF" : theme.mcc.textMuted} />
            </View>
            <Text style={[styles.flowLabel, { color: active ? theme.mcc.textPrimary : theme.mcc.textMuted }]} numberOfLines={1}>
              {step.label}
            </Text>
            {index < steps.length - 1 ? <View style={[styles.flowConnector, { backgroundColor: index < activeIndex ? theme.mcc.accent : theme.mcc.line }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function SundayRibbon({ date }: { date: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.sundayRibbon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine }]}>
      <MaterialCommunityIcons name="calendar-star" size={18} color={theme.mcc.accent} />
      <View style={styles.flexText}>
        <Text style={[styles.sundayLabel, { color: theme.mcc.accent }]}>Cardiotag</Text>
        <Text style={[styles.sundayDate, { color: theme.mcc.textPrimary }]}>{date}</Text>
      </View>
    </View>
  );
}

export function WeeklyEventHeroCard({
  title,
  subtitle,
  status,
  chips,
  ctaLabel,
  onCtaPress,
  dateLabel,
  flowTarget,
}: {
  title: string;
  subtitle?: string;
  status: string;
  chips: Array<{ label: string; tone?: Tone; icon?: IconName }>;
  ctaLabel?: string;
  onCtaPress?: () => void;
  dateLabel?: string;
  flowTarget?: { label: string; icon?: IconName; tone?: Tone };
}) {
  const { theme } = useTheme();
  return (
    <MccCard accent animatedLine={false} style={styles.weeklyHero}>
      <HeroFlowSignal target={flowTarget} />
      <View style={styles.weeklyTop}>
        <View style={styles.flexText}>
          <MccBadge icon="pulse" tone="accent">
            Diese Woche
          </MccBadge>
          <Text style={[styles.weeklyTitle, { color: theme.mcc.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.weeklySubtitle, { color: theme.mcc.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        <CardioRing label="Pulse" value="MCC" />
      </View>
      {dateLabel ? <SundayRibbon date={dateLabel} /> : null}
      <View style={styles.metricGrid}>
        <HeroMetric label={status} icon="check-decagram" tone="success" />
        {chips.map((chip) => (
          <HeroMetric key={chip.label} label={chip.label} tone={chip.tone ?? "neutral"} icon={chip.icon} />
        ))}
      </View>
      {ctaLabel ? <MccButton label={ctaLabel} icon="arrow-right" onPress={onCtaPress} /> : null}
    </MccCard>
  );
}

function HeroFlowSignal({ target }: { target?: { label: string; icon?: IconName; tone?: Tone } }) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const targetColor = theme.mcc.accent;

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 2200, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);

  if (reduced) return null;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-180, 420] });
  const opacity = progress.interpolate({ inputRange: [0, 0.12, 0.84, 1], outputRange: [0, 1, 1, 0] });
  const targetOpacity = target ? 0.78 : 0.42;

  return (
    <View pointerEvents="none" style={styles.heroFlowLayer}>
      <View style={[styles.heroFlowTrack, { backgroundColor: theme.mcc.line, opacity: targetOpacity }]} />
      <Animated.View style={[styles.heroFlowSweep, { backgroundColor: targetColor, opacity, shadowColor: targetColor, transform: [{ translateX }] }]} />
    </View>
  );
}

function HeroMetric({ label, icon, tone }: { label: string; icon?: IconName; tone: Tone }) {
  const { theme } = useTheme();
  const color = toneColor(tone, theme.mcc);
  const [value, ...rest] = label.split(" ");
  const caption = rest.join(" ");

  return (
    <View style={[styles.heroMetric, { borderColor: `${color}55`, backgroundColor: tone === "neutral" ? theme.mcc.surfaceSoft : theme.mcc.accentFaint }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={color} /> : null}
      <View style={styles.heroMetricText}>
        <Text style={[styles.heroMetricValue, { color }]}>{value}</Text>
        {caption ? (
          <Text style={[styles.heroMetricLabel, { color: theme.mcc.textSecondary }]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function SportVoteCard({
  children,
  title,
  meta,
  selected = false,
  blocked = false,
  icon,
  right,
  index = 0,
}: {
  children?: ReactNode;
  title: string;
  meta?: string;
  selected?: boolean;
  blocked?: boolean;
  icon?: ReactNode;
  right?: ReactNode;
  index?: number;
}) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, delay: Math.min(index, 8) * 35, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: Math.min(index, 8) * 35, damping: 18, stiffness: 150, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const borderColor = blocked ? theme.mcc.danger : selected ? theme.mcc.accent : theme.mcc.line;
  const backgroundColor = blocked ? theme.mcc.dangerSoft : selected ? theme.mcc.accentSoft : theme.mcc.surface;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <MccCard style={[styles.voteCard, { backgroundColor, borderColor }]}>
        <View style={styles.voteTop}>
          {icon}
          <View style={styles.flexText}>
            <Text style={[styles.voteTitle, { color: selected ? theme.mcc.textPrimary : theme.mcc.textPrimary }]}>{title}</Text>
            {meta ? <Text style={[styles.voteMeta, { color: selected ? theme.mcc.textSecondary : theme.mcc.textSecondary }]}>{meta}</Text> : null}
          </View>
          {right}
        </View>
        {children}
      </MccCard>
    </Animated.View>
  );
}

export function DecisionResultCard({
  title,
  subtitle,
  labels,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  labels?: string[];
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <MccCard accent>
      <View style={styles.decisionTop}>
        {icon}
        <View style={styles.flexText}>
          <Text style={[styles.decisionKicker, { color: theme.mcc.accent }]}>Cardio Club entscheidet</Text>
          <Text style={[styles.decisionTitle, { color: theme.mcc.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[styles.decisionSubtitle, { color: theme.mcc.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {labels?.length ? (
        <View style={styles.badgeRow}>
          {labels.map((label) => (
            <MccBadge key={label}>{label}</MccBadge>
          ))}
        </View>
      ) : null}
      {children}
    </MccCard>
  );
}

export function WhyNotAccordion({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <MccCard>
      <Pressable style={styles.accordionHeader} onPress={() => setOpen((visible) => !visible)}>
        <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>{title}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={theme.mcc.textSecondary} />
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </MccCard>
  );
}

export function NoGoNotice({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.noGoNotice, { backgroundColor: theme.mcc.dangerSoft, borderColor: `${theme.mcc.danger}66` }]}>
      <MaterialCommunityIcons name="shield-alert-outline" size={18} color={theme.mcc.danger} />
      <Text style={[styles.noticeText, { color: theme.mcc.textSecondary }]}>{children}</Text>
    </View>
  );
}

export function AnimatedScoreRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const { theme } = useTheme();
  const width = useMemo(() => `${Math.max(8, Math.min(100, Number(value) || 0))}%`, [value]);
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreHeader}>
        <Text style={[styles.scoreLabel, { color: theme.mcc.textPrimary }]}>{label}</Text>
        <Text style={[styles.scoreValue, { color: theme.mcc.accent }]}>{value}</Text>
      </View>
      <View style={[styles.scoreTrack, { backgroundColor: theme.mcc.surfaceSoft }]}>
        <View style={[styles.scoreFill, { backgroundColor: theme.mcc.accent, width } as ViewStyle]} />
      </View>
      {detail ? <Text style={[styles.scoreDetail, { color: theme.mcc.textSecondary }]}>{detail}</Text> : null}
    </View>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  const { theme } = useTheme();
  return (
    <MccCard>
      {Array.from({ length: lines }).map((_, index) => (
        <View key={index} style={[styles.skeletonLine, { width: `${88 - index * 14}%`, backgroundColor: theme.mcc.surfaceSoft } as ViewStyle]} />
      ))}
      <ActivityIndicator color={theme.mcc.accent} />
    </MccCard>
  );
}

export function EmptyState({ title, body, icon = "calendar-blank-outline" }: { title: string; body?: string; icon?: IconName }) {
  const { theme } = useTheme();
  return (
    <MccCard style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.line }]}>
        <MaterialCommunityIcons name={icon} size={26} color={theme.mcc.accent} />
      </View>
      <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary, textAlign: "center" } as TextStyle]}>{title}</Text>
      {body ? <Text style={[styles.bodyText, { color: theme.mcc.textSecondary, textAlign: "center" } as TextStyle]}>{body}</Text> : null}
    </MccCard>
  );
}

export const mccText = StyleSheet.create({
  cardTitle: { fontSize: 19, fontWeight: "900", lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  muted: { fontSize: 13, lineHeight: 19 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  screenContent: { gap: 16, paddingHorizontal: 16, paddingTop: 16 },
  backgroundBase: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  backgroundLogo: {
    height: 500,
    position: "absolute",
    right: -94,
    top: 70,
    width: 500,
  },
  hero: { gap: 8, paddingVertical: 8 },
  heroCompact: { paddingTop: 2, paddingBottom: 4 },
  kicker: { fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  heroTitle: { fontSize: 34, fontWeight: "900", letterSpacing: 0, lineHeight: 39 },
  heroTitleCompact: { fontSize: 30, lineHeight: 34 },
  heroSubtitle: { fontSize: 15, lineHeight: 22 },
  card: {
    gap: 13,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  cardTitle: { fontSize: 19, fontWeight: "900", lineHeight: 24 },
  bodyText: { fontSize: 15, lineHeight: 22 },
  button: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  buttonText: { fontSize: 14, fontWeight: "900" },
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  pulseClip: { height: 4, left: 14, overflow: "hidden", position: "absolute", right: 14, top: 0 },
  pulseTrack: { height: 1, opacity: 0.7, position: "absolute", top: 2, width: "100%" },
  pulseSignal: { borderRadius: 999, height: 4, opacity: 0.9, width: 130 },
  cardioRing: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 74,
    justifyContent: "center",
    overflow: "hidden",
    width: 74,
  },
  cardioRingPulse: {
    position: "absolute",
    width: 62,
    height: 62,
    borderRadius: 999,
    borderWidth: 2,
  },
  pulseBars: { alignItems: "flex-end", bottom: 13, flexDirection: "row", gap: 2, height: 10, position: "absolute" },
  pulseBar: { borderRadius: 999, height: 5, opacity: 0.75, width: 3 },
  pulseBarTall: { height: 10 },
  cardioRingValue: { fontSize: 15, fontWeight: "900", lineHeight: 18 },
  cardioRingLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" },
  orbitArc: {
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    borderRadius: 999,
    borderWidth: 3,
    position: "absolute",
  },
  flowRail: {
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  flowStep: { alignItems: "center", flex: 1, gap: 5, minWidth: 0, position: "relative" },
  flowNode: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 28, justifyContent: "center", width: 28, zIndex: 2 },
  flowLabel: { fontSize: 10, fontWeight: "900", maxWidth: "100%", textTransform: "uppercase" },
  flowConnector: { height: 2, left: "64%", position: "absolute", right: "-36%", top: 13, zIndex: 1 },
  sundayRibbon: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sundayLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  sundayDate: { fontSize: 15, fontWeight: "900", lineHeight: 20 },
  weeklyHero: { overflow: "visible", paddingTop: 18 },
  weeklyTop: { alignItems: "flex-start", flexDirection: "row", gap: 14, justifyContent: "space-between" },
  weeklyTitle: { fontSize: 30, fontWeight: "900", letterSpacing: 0, lineHeight: 34, marginTop: 8 },
  weeklySubtitle: { fontSize: 15, lineHeight: 22 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroMetric: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 9, minHeight: 48, minWidth: 136, paddingHorizontal: 12, paddingVertical: 9 },
  heroMetricText: { flex: 1, minWidth: 0 },
  heroMetricValue: { fontSize: 14, fontWeight: "900", lineHeight: 17 },
  heroMetricLabel: { fontSize: 10, fontWeight: "900", lineHeight: 13, textTransform: "uppercase" },
  heroFlowLayer: { height: 4, left: 18, overflow: "hidden", position: "absolute", right: 18, top: 0 },
  heroFlowTrack: { height: 1, left: 0, position: "absolute", right: 0, top: 1.5 },
  heroFlowSweep: { borderRadius: 999, height: 4, shadowOpacity: 0.55, shadowRadius: 13, width: 180 },
  statusRing: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 58, justifyContent: "center", width: 58 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flexText: { flex: 1, minWidth: 0 },
  voteCard: { padding: 14 },
  voteTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  voteTitle: { fontSize: 17, fontWeight: "900", lineHeight: 22 },
  voteMeta: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  decisionTop: { alignItems: "center", flexDirection: "row", gap: 12 },
  decisionKicker: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
  decisionTitle: { fontSize: 30, fontWeight: "900", lineHeight: 34 },
  decisionSubtitle: { fontSize: 16, fontWeight: "800", lineHeight: 22 },
  accordionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  accordionBody: { gap: 8 },
  noGoNotice: { alignItems: "flex-start", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 9, padding: 12 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: "800", lineHeight: 19 },
  scoreRow: { gap: 7 },
  scoreHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  scoreLabel: { flex: 1, fontSize: 14, fontWeight: "900" },
  scoreValue: { fontSize: 13, fontWeight: "900" },
  scoreTrack: { borderRadius: 999, height: 7, overflow: "hidden" },
  scoreFill: { borderRadius: 999, height: "100%" },
  scoreDetail: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  skeletonLine: { borderRadius: 999, height: 14 },
  emptyState: { alignItems: "center" },
  emptyIcon: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 54, justifyContent: "center", width: 54 },
});
