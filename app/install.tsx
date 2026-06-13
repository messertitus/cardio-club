import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ComponentProps } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { MccBadge, MccBody, MccCard, MccCardTitle, MccScreen } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
import { useTheme } from "../src/context/ThemeContext";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

// Real screenshots of the iPhone flow (web-optimized PNGs ~75 KB each).
const IOS_STEPS: { shot: number; title: string }[] = [
  { shot: require("../assets/install/ios-1-menu.png"), title: "Browser-Menü öffnen (unten rechts)." },
  { shot: require("../assets/install/ios-2-share.png"), title: "Auf „Teilen“ tippen." },
  { shot: require("../assets/install/ios-3-add.png"), title: "„Zum Home-Bildschirm“ wählen." },
  { shot: require("../assets/install/ios-4-confirm.png"), title: "„Hinzufügen“ tippen – fertig." },
];

const ANDROID_STEPS: { icon: IconName; text: string }[] = [
  { icon: "dots-vertical", text: "In Chrome oben rechts auf das Menü ⋮ tippen." },
  { icon: "cellphone-arrow-down", text: "„App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen." },
  { icon: "check-bold", text: "Mit „Installieren“ bestätigen." },
];

const BENEFITS: { icon: IconName; title: string; body: string }[] = [
  { icon: "rocket-launch-outline", title: "Schneller Start", body: "Eigenes Icon auf dem Homescreen." },
  { icon: "fullscreen", title: "Vollbild", body: "Mehr Platz, keine Browser-Leiste." },
  { icon: "cellphone-check", title: "Wie eine echte App", body: "Direkt los, kein Suchen im Browser." },
];

export default function InstallScreen() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <MccScreen
        title="App installieren"
        kicker="Anleitung"
        subtitle="Einmal zum Homescreen hinzufügen – danach öffnest du sie wie eine normale App."
        bottomInset={96}
      >
        <Reveal>
          <MccCard accent>
            <MccBadge icon="star-outline">Warum?</MccBadge>
            <MccCardTitle>Warum installieren?</MccCardTitle>
            <View style={styles.rows}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.title} style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine }]}>
                    <MaterialCommunityIcons name={benefit.icon} size={18} color={theme.mcc.accent} />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={[styles.benefitTitle, { color: theme.mcc.textPrimary }]}>{benefit.title}</Text>
                    <Text style={[styles.rowText, { color: theme.mcc.textSecondary }]}>{benefit.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={1}>
          <MccCard>
            <MccBadge icon="apple">iPhone & iPad · in 4 Schritten</MccBadge>
            <View style={styles.grid}>
              {IOS_STEPS.map((step, index) => (
                <View key={step.title} style={styles.cell}>
                  <View style={styles.shotFrame}>
                    <Image source={step.shot} style={[styles.shot, { borderColor: theme.mcc.line }]} resizeMode="contain" accessibilityLabel={step.title} />
                    <View style={[styles.stepNum, { backgroundColor: theme.mcc.accentDeep, borderColor: theme.mcc.background }]}>
                      <Text style={styles.stepNumText}>{index + 1}</Text>
                    </View>
                  </View>
                  <Text style={[styles.cellText, { color: theme.mcc.textSecondary }]}>{step.title}</Text>
                </View>
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={2}>
          <MccCard>
            <MccBadge icon="android">Android</MccBadge>
            <View style={styles.rows}>
              {ANDROID_STEPS.map((step) => (
                <View key={step.text} style={styles.row}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine }]}>
                    <MaterialCommunityIcons name={step.icon} size={18} color={theme.mcc.accent} />
                  </View>
                  <Text style={[styles.rowText, { color: theme.mcc.textPrimary }]}>{step.text}</Text>
                </View>
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={3}>
          <MccCard>
            <MccBadge icon="information-outline">Gut zu wissen</MccBadge>
            <MccCardTitle>Nur einmal nötig</MccCardTitle>
            <MccBody muted>
              Du installierst die App nur einmal. Danach öffnest du sie über das Symbol auf dem Homescreen wie eine normale App.
            </MccBody>
            <View style={[styles.hint, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
              <MaterialCommunityIcons name="lifebuoy" size={16} color={theme.mcc.accent} />
              <Text style={[styles.hintText, { color: theme.mcc.textSecondary }]}>
                Kein Button? Öffne die aktuelle Seite direkt in Safari (iPhone) oder Chrome (Android) – nicht in einem In-App-Browser – und lade sie neu.
              </Text>
            </View>
          </MccCard>
        </Reveal>
      </MccScreen>
      <BottomNav active="menu" />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 16 },
  cell: { width: "47%", gap: 8 },
  shotFrame: { position: "relative" },
  shot: { width: "100%", aspectRatio: 330 / 715, borderRadius: 16, borderWidth: 1 },
  stepNum: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    left: -6,
    position: "absolute",
    top: -6,
    width: 26,
  },
  stepNumText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  cellText: { fontSize: 13, fontWeight: "800", lineHeight: 18 },
  rows: { gap: 10 },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
  rowIcon: { alignItems: "center", borderRadius: 12, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  rowText: { flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  benefitText: { flex: 1, minWidth: 0, gap: 1 },
  benefitTitle: { fontSize: 15, fontWeight: "900", lineHeight: 20 },
  hint: { alignItems: "flex-start", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, padding: 12 },
  hintText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
});
