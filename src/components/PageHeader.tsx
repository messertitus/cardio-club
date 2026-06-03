import { Image, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";
import { BackButton } from "./BackButton";
import { ThemeToggle } from "./ThemeToggle";

const darkLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../../assets/mcc-logo-black-symbol-transparent.png");

export function PageHeader({
  kicker,
  title,
  titleMeta,
  showBack = true,
  showTheme = false,
  onBack,
  actions,
}: {
  kicker?: string;
  title: string;
  titleMeta?: string;
  showBack?: boolean;
  showTheme?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  const { mode, theme } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={mode === "dark" ? darkLogo : lightLogo} style={styles.logo} resizeMode="contain" />
        <View style={styles.textBlock}>
          {kicker ? <Text style={[styles.kicker, { color: theme.muted }]}>{kicker}</Text> : null}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {title}
            </Text>
            {titleMeta ? <Text style={[styles.titleMeta, { color: theme.muted }]}>{titleMeta}</Text> : null}
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        {actions}
        {showTheme ? <ThemeToggle /> : null}
        {showBack ? <BackButton onPress={onBack} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  brand: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 },
  logo: { height: 42, width: 42 },
  textBlock: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "800", lineHeight: 16 },
  titleRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: 0, lineHeight: 34 },
  titleMeta: { borderRadius: 999, fontSize: 13, fontWeight: "900", lineHeight: 18, opacity: 0.72 },
  actions: { alignItems: "center", flexDirection: "row", gap: 8 },
});
