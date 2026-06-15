import { router } from "expo-router";
import { useEffect } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavChrome } from "../context/NavChromeContext";
import { useTheme } from "../context/ThemeContext";
import { useTourTarget } from "./TourGuide";

export type BottomNavKey = "event" | "chat" | "members" | "menu";

type NavItemData = { key: BottomNavKey; label: string; href: string; tourKey?: string };

// Web-only frosted-glass backdrop; ignored on native (typed loosely on purpose).
const webBlur: object =
  Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object) : {};

export function BottomNav({ active }: { active: BottomNavKey }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { mode, theme } = useTheme();
  const { scale, reset } = useNavChrome();
  const compact = width < 360;

  // Full size whenever a screen with the nav mounts.
  useEffect(() => {
    reset();
  }, [reset]);

  const items: NavItemData[] = [
    { key: "event", label: "Event", href: "/" },
    { key: "chat", label: "Chat", href: "/chat", tourKey: "nav-chat" },
    { key: "members", label: compact ? "Team" : "Mitglieder", href: "/members", tourKey: "nav-members" },
    { key: "menu", label: "Menü", href: "/menu", tourKey: "nav-menu" },
  ];

  const pillBackground = mode === "dark" ? "rgba(10,18,31,0.62)" : "rgba(255,255,255,0.66)";

  return (
    <View style={[styles.layer, { paddingBottom: insets.bottom + 6 }]}>
      <Animated.View
        style={[
          styles.pill,
          webBlur,
          { backgroundColor: pillBackground, borderColor: theme.mcc.line, transform: [{ scale }] },
        ]}
      >
        {items.map((item) => (
          <NavItem key={item.key} item={item} active={active === item.key} compact={compact} />
        ))}
      </Animated.View>
    </View>
  );
}

function NavItem({ item, active, compact }: { item: NavItemData; active: boolean; compact: boolean }) {
  const { theme } = useTheme();
  // Registers this tab as a guided-tour target (no-op when the tour is idle).
  // scroll:false — the nav bar is fixed, so never scroll it into view.
  const tourTarget = useTourTarget(item.tourKey ?? `nav-${item.key}`, { scroll: false });

  return (
    <Pressable
      ref={tourTarget.ref}
      onLayout={tourTarget.onLayout}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => router.push(item.href as never)}
    >
      <View style={[styles.activeDot, { backgroundColor: active ? theme.mcc.accent : "transparent" }]} />
      <Text style={[styles.label, compact && styles.labelCompact, { color: active ? theme.mcc.textPrimary : theme.mcc.textMuted }]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // In-flow floating layer: a transparent strip at the bottom of the screen that
  // centers the pill, with see-through side margins around it.
  layer: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  pill: {
    width: "100%",
    maxWidth: 460,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 4,
    overflow: "hidden",
    // Soft lift off the content.
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 2,
    paddingVertical: 8,
  },
  itemPressed: { opacity: 0.6 },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  label: {
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  labelCompact: { fontSize: 11 },
});
