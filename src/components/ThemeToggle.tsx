import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  const progress = useRef(new Animated.Value(mode === "light" ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: mode === "light" ? 1 : 0,
      damping: 18,
      stiffness: 190,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [mode, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [2, 28] });
  const trackColor = progress.interpolate({ inputRange: [0, 1], outputRange: ["#2c313a", "#e9edf3"] });
  const thumbColor = progress.interpolate({ inputRange: [0, 1], outputRange: ["#f7f8fb", "#ffffff"] });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: mode === "light" }}
      accessibilityLabel="Design wechseln"
      onPress={toggleTheme}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: thumbColor, transform: [{ translateX }] }]}>
          <View style={[styles.thumbDetail, mode === "light" && styles.thumbDetailLight]} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 58,
    height: 32,
    borderRadius: 999,
    padding: 2,
    justifyContent: "center",
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  thumbDetail: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#2c313a",
    opacity: 0.9,
  },
  thumbDetailLight: {
    width: 12,
    height: 12,
    backgroundColor: "#f3b233",
  },
});
