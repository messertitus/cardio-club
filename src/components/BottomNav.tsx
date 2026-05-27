import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type BottomNavKey = "event" | "chat" | "members" | "menu";

export function BottomNav({ active }: { active: BottomNavKey }) {
  const items = [
    { key: "event", label: "Event", href: "/" },
    { key: "chat", label: "Chat", href: "/chat" },
    { key: "members", label: "Mitglieder", href: "/members" },
    { key: "menu", label: "Menü", href: "/menu" },
  ] as const;

  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.item, active === item.key && styles.itemActive, pressed && styles.itemPressed]}
          onPress={() => router.push(item.href)}
        >
          <Text style={[styles.label, active === item.key && styles.labelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#05070b",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  item: {
    flex: 1,
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: "#ffffff",
  },
  itemPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
  label: {
    color: "#728197",
    fontSize: 12,
    fontWeight: "900",
  },
  labelActive: {
    color: "#05070b",
  },
});
