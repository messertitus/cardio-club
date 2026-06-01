import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

const darkLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../../assets/mcc-logo-color-symbol.png");

export function BrandBackground() {
  const { mode } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={mode === "dark" ? darkLogo : lightLogo} style={[styles.logo, { opacity: mode === "dark" ? 0.045 : 0.07 }]} resizeMode="contain" />
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
});
