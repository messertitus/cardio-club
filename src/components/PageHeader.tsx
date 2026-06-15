import { Image, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";
import { BackButton } from "./BackButton";
import { ThemeToggle } from "./ThemeToggle";

const darkLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");
const lightLogo = require("../../assets/mcc-logo-black-symbol-transparent.png");

export function MainHeader({ title, actions }: { title?: string; actions?: ReactNode }) {
  const { mode, theme } = useTheme();
  return (
    <View style={mainStyles.header}>
      <View style={mainStyles.brand}>
        <Image source={mode === "dark" ? darkLogo : lightLogo} style={mainStyles.logo} resizeMode="contain" />
        <View style={mainStyles.textBlock}>
          <Text style={[mainStyles.kicker, { color: theme.mcc.textSecondary }]} numberOfLines={1}>
            Messers Cardio Club
          </Text>
          <Text style={[mainStyles.title, !title && mainStyles.titleBrand, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
            {title ?? "MCC"}
          </Text>
        </View>
      </View>
      <View style={mainStyles.actions}>
        {actions}
        <ThemeToggle />
      </View>
    </View>
  );
}

const mainStyles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", marginTop: -8 },
  brand: { alignItems: "center", flex: 1, flexDirection: "row", gap: 12, minWidth: 0 },
  logo: { height: 52, width: 52 },
  textBlock: { flex: 1, minWidth: 0, marginTop: -6 },
  kicker: { fontSize: 12, fontWeight: "800", lineHeight: 14 },
  title: { fontSize: 30, fontWeight: "900", letterSpacing: 0, lineHeight: 41, marginTop: -2, paddingBottom: 2 },
  titleBrand: { fontSize: 34, fontWeight: "900", letterSpacing: 6, lineHeight: 44 },
  actions: { alignItems: "center", flexDirection: "row", gap: 8 },
});

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
          {kicker ? <Text style={[styles.kicker, { color: theme.mcc.accent }]}>{kicker}</Text> : null}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.mcc.textPrimary }]} numberOfLines={2}>
              {title}
            </Text>
            {titleMeta ? <Text style={[styles.titleMeta, { color: theme.mcc.textMuted }]}>{titleMeta}</Text> : null}
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
  title: { fontSize: 30, fontWeight: "900", letterSpacing: 0, lineHeight: 40 },
  titleMeta: { borderRadius: 999, fontSize: 13, fontWeight: "900", lineHeight: 18, opacity: 0.72 },
  actions: { alignItems: "center", flexDirection: "row", gap: 8 },
});
