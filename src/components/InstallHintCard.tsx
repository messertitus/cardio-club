import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import type { InstallHintVariant } from "../services/pwaInstallHint";

// Short, variant-specific copy. The "install-and-push" line is the canonical
// message; the others drop whatever the runtime already covers so we never
// promise something the device can't do.
const COPY: Record<InstallHintVariant, { kicker: string; title: string; body: string }> = {
  "install-and-push": {
    kicker: "Tipp",
    title: "Hole dir jetzt die App-Version.",
    body: "Installiere Messers Cardio Club wie eine echte App und schalte Push ein – Abstimmungen, Entscheidungen und Events landen dann direkt bei dir.",
  },
  "install-only": {
    kicker: "Tipp",
    title: "Hole dir jetzt die App-Version.",
    body: "Lege Messers Cardio Club mit einem Tippen auf deinen Startbildschirm – eigenes Icon, Vollbild und immer griffbereit.",
  },
  "push-only": {
    kicker: "Tipp",
    title: "Verpasse nichts mehr.",
    body: "Schalte Push ein und werde bei Abstimmungen, Entscheidungen und Events sofort benachrichtigt.",
  },
};

// A calm bottom-sheet. It is a plain overlay View (NOT a React Native Modal):
// Modal renders into a document-root portal that can linger over the next screen
// after navigation. As a normal conditionally-rendered View, the parent removing
// it (or navigating away) makes it disappear instantly.
export function InstallHintCard({
  variant,
  onLearnMore,
  onLater,
  onNeverShow,
}: {
  variant: InstallHintVariant;
  onLearnMore: () => void;
  onLater: () => void;
  onNeverShow: () => void;
}) {
  const { theme } = useTheme();
  const copy = COPY[variant];
  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 160, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 170, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, translateY]);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Schließen" onPress={onLater} />
      <Animated.View
        style={[styles.card, { backgroundColor: theme.mcc.surface, borderColor: theme.mcc.line, opacity, transform: [{ translateY }, { scale }] }]}
      >
        <Text style={[styles.kicker, { color: theme.mcc.accent }]}>{copy.kicker}</Text>
        <Text style={[styles.title, { color: theme.mcc.textPrimary }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: theme.mcc.textSecondary }]}>{copy.body}</Text>

        <Pressable style={[styles.primary, { backgroundColor: theme.mcc.accentDeep }]} onPress={onLearnMore}>
          <Text style={[styles.primaryText, { color: "#FFFFFF" }]}>Mehr erfahren</Text>
        </Pressable>
        <Pressable style={styles.later} onPress={onLater}>
          <Text style={[styles.laterText, { color: theme.mcc.textSecondary }]}>Später</Text>
        </Pressable>
        <Pressable style={styles.never} onPress={onNeverShow}>
          <Text style={[styles.neverText, { color: theme.mcc.textMuted }]}>Nicht mehr anzeigen</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
    paddingBottom: 92,
    backgroundColor: "rgba(0,0,0,0.18)",
    zIndex: 50,
    elevation: 50,
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 430,
    gap: 10,
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 26, fontWeight: "900", lineHeight: 30 },
  body: { fontSize: 15, lineHeight: 22, marginBottom: 2 },
  primary: { alignItems: "center", borderRadius: 18, paddingVertical: 15 },
  primaryText: { fontSize: 15, fontWeight: "900" },
  later: { alignItems: "center", paddingVertical: 5 },
  laterText: { fontSize: 14, fontWeight: "900" },
  never: { alignItems: "center", paddingVertical: 2 },
  neverText: { fontSize: 12, fontWeight: "800" },
});
