import { router } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

export type BottomNavKey = "event" | "chat" | "members" | "menu";

export function BottomNav({ active }: { active: BottomNavKey }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const compact = width < 360;
  const items = [
    { key: "event", label: "Event", href: "/" },
    { key: "chat", label: "Chat", href: "/chat" },
    { key: "members", label: compact ? "Team" : "Mitglieder", href: "/members" },
    { key: "menu", label: "Menü", href: "/menu" },
  ] as const;

  return (
    <View style={[styles.outer, { borderTopColor: theme.mcc.line, backgroundColor: theme.mcc.surface, paddingBottom: 6 + insets.bottom }]}>
      <View style={styles.wrap}>
        {items.map((item) => {
          const isActive = active === item.key;

          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => router.push(item.href)}
            >
              <View style={[styles.activeLine, { backgroundColor: isActive ? theme.mcc.accent : "transparent" }]} />
              <Text style={[styles.label, compact && styles.labelCompact, { color: isActive ? theme.mcc.textPrimary : theme.mcc.textMuted }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderTopWidth: 1,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 6,
  },
  wrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingTop: 8,
    paddingBottom: 7,
  },
  itemPressed: {
    opacity: 0.68,
  },
  activeLine: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 999,
  },
  label: {
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  labelCompact: {
    fontSize: 11,
  },
});
