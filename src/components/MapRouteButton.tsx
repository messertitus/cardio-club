import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";

export type MapTarget = {
  latitude?: number | null;
  longitude?: number | null;
  label?: string | null;
  mapUrl?: string | null;
};

export function MapRouteButton({ target, compact = false }: { target?: MapTarget | null; compact?: boolean }) {
  const { theme } = useTheme();
  const url = buildMapUrl(target);
  if (!url) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft },
        pressed && styles.pressed,
      ]}
      onPress={() => {
        void Linking.openURL(url);
      }}
    >
      <MaterialCommunityIcons name="map-marker-outline" size={compact ? 16 : 18} color={theme.mcc.accent} />
      {!compact ? <Text style={[styles.text, { color: theme.mcc.textPrimary }]}>Karte</Text> : null}
    </Pressable>
  );
}

export function buildRouteUrl(target?: MapTarget | null): string | null {
  return buildMapUrl(target);
}

export function buildMapUrl(target?: MapTarget | null): string | null {
  if (!target) return null;
  if (typeof target.latitude === "number" && typeof target.longitude === "number" && Number.isFinite(target.latitude) && Number.isFinite(target.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${target.latitude},${target.longitude}`)}`;
  }
  const query = target.label?.trim();
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return target.mapUrl?.trim() || null;
}

const styles = StyleSheet.create({
  button: { alignItems: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 36, paddingHorizontal: 10, paddingVertical: 7 },
  compact: { height: 36, minHeight: 36, paddingHorizontal: 0, width: 36 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  text: { fontSize: 12, fontWeight: "900" },
});
