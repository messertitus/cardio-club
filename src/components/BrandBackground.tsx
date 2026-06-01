import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const darkLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../../assets/mcc-logo-color-symbol.png");

export function BrandBackground() {
  const { mode, theme } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={mode === "dark" ? darkLogo : lightLogo} style={[styles.logo, { opacity: mode === "dark" ? 0.045 : 0.07 }]} resizeMode="contain" />
      <View style={[styles.line, { backgroundColor: theme.accent, opacity: mode === "dark" ? 0.16 : 0.12 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    position: "absolute",
    right: -138,
    top: 72,
    width: 400,
    height: 400,
  },
  line: {
    position: "absolute",
    right: 24,
    top: 98,
    width: 86,
    height: 3,
    borderRadius: 999,
  },
});
