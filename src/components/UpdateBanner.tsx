import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

// A calm, dismissible "new version available" hint. It only appears after the
// service worker reports a fresh deployment (mcc:update-ready, web only) and
// never reloads on its own — the user taps "Aktualisieren" when it suits them,
// so no reload ever interrupts a vote or a form.
export function UpdateBanner() {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.addEventListener) return;
    const onUpdate = () => setVisible(true);
    window.addEventListener("mcc:update-ready", onUpdate);
    return () => window.removeEventListener("mcc:update-ready", onUpdate);
  }, []);

  if (!visible) return null;

  function reload() {
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.banner, { backgroundColor: theme.mcc.surfaceRaised, borderColor: theme.mcc.strongLine, shadowColor: theme.mcc.shadow }]}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={18} color={theme.mcc.accent} />
        <Text style={[styles.text, { color: theme.mcc.textPrimary }]} numberOfLines={2}>
          Neue Version verfügbar.
        </Text>
        <Pressable style={[styles.action, { backgroundColor: theme.mcc.accentDeep }]} onPress={reload}>
          <Text style={styles.actionText}>Aktualisieren</Text>
        </Pressable>
        <Pressable hitSlop={8} style={styles.close} onPress={() => setVisible(false)} accessibilityLabel="Schließen">
          <MaterialCommunityIcons name="close" size={18} color={theme.mcc.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 12, left: 0, right: 0, alignItems: "center", paddingHorizontal: 12, zIndex: 60, elevation: 60 },
  banner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  text: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "900" },
  action: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  close: { alignItems: "center", height: 28, justifyContent: "center", width: 28 },
});
