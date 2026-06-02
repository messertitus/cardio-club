import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../context/ThemeContext";

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      style={({ pressed }) => [styles.button, { borderColor: theme.border, backgroundColor: theme.softSurface }, pressed && styles.pressed]}
      onPress={onPress ?? (() => router.back())}
    >
      <Text style={[styles.arrow, { color: theme.text }]}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
  },
  arrow: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 32,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});
