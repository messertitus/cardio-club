import { Image, StyleSheet } from "react-native";

const logo = require("../../assets/mcc-logo-white-symbol-transparent.png");

export function BrandBackground() {
  return <Image source={logo} style={styles.logo} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  logo: {
    position: "absolute",
    right: -128,
    top: 76,
    width: 390,
    height: 390,
    opacity: 0.05,
  },
});
