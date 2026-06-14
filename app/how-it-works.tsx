import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ComponentProps } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { MccBadge, MccBody, MccCard, MccCardTitle, MccScreen } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
import { useTheme } from "../src/context/ThemeContext";
import { useScreenView } from "../src/components/useScreenView";
import { SCREEN_EVENTS } from "../src/services";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

// What the member does — kept to the three inputs the decision actually uses.
const YOUR_PART: { icon: IconName; title: string; body: string }[] = [
  { icon: "hand-wave-outline", title: "Bist du dabei?", body: "Sag, ob du zum Cardiotag kommst. Nur wer dabei ist, zählt mit." },
  { icon: "format-list-numbered", title: "Deine Wunsch-Sportarten", body: "Wähle, was dir Spaß macht – in deiner Reihenfolge. Ganz oben = am liebsten." },
  { icon: "hand-back-left-outline", title: "Deine No-Gos", body: "Markiere, was für dich gar nicht geht. Das wird respektiert." },
];

// How the club decides — plain language, no weights or formulas.
const HOW: { icon: IconName; title: string; body: string }[] = [
  { icon: "account-group-outline", title: "Nur Teilnehmende zählen", body: "Die Wahl richtet sich nach denen, die wirklich kommen." },
  { icon: "scale-balance", title: "Jede Stimme fair gewichtet", body: "Nicht nur die lauteste Mehrheit gewinnt – deine Reihenfolge fließt ein." },
  { icon: "shield-check-outline", title: "No-Gos werden geschützt", body: "Niemand wird zu etwas gedrängt, das gar nicht passt." },
  { icon: "history", title: "Wer lange nicht dran war, kommt zum Zug", body: "So bleibt es abwechslungsreich und niemand wird dauerhaft übergangen." },
];

export default function HowItWorksScreen() {
  const { theme } = useTheme();
  useScreenView(SCREEN_EVENTS.howItWorks);

  return (
    <View style={{ flex: 1 }}>
      <MccScreen
        title="So entscheidet der Club"
        kicker="Fair für alle"
        subtitle="Kurz erklärt, wie aus euren Stimmen ein fairer Cardiotag wird."
        bottomInset={96}
      >
        <Reveal>
          <MccCard accent>
            <MccBadge icon="vote-outline">Dein Teil</MccBadge>
            <MccCardTitle>Du gibst den Ton an</MccCardTitle>
            <View style={styles.rows}>
              {YOUR_PART.map((item) => (
                <Row key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={1}>
          <MccCard>
            <MccBadge icon="cog-outline">So läuft's</MccBadge>
            <MccCardTitle>Wie der Club entscheidet</MccCardTitle>
            <View style={styles.rows}>
              {HOW.map((item) => (
                <Row key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={2}>
          <MccCard>
            <MccBadge icon="heart-outline">Warum so?</MccBadge>
            <MccCardTitle>Fair statt laut</MccCardTitle>
            <MccBody muted>
              Statt endlosem Hin und Her im Chat trifft der Club die Wahl automatisch – nach klaren, gleichen Regeln für alle. Das schützt auch die, die mal in der Minderheit sind, und sorgt für Abwechslung. So fühlt sich jeder Cardiotag fair an.
            </MccBody>
          </MccCard>
        </Reveal>

        <Reveal index={3}>
          <MccCard>
            <MccBadge icon="clock-outline">Wann?</MccBadge>
            <MccCardTitle>Kurz vorher steht's fest</MccCardTitle>
            <MccBody muted>
              Du stimmst entspannt unter der Woche ab. Kurz vor dem Cardiotag entscheidet der Club – danach siehst du, welche Sportart an welchem Standort läuft. Kein Stress, keine Diskussion.
            </MccBody>
          </MccCard>
        </Reveal>

        <Reveal index={4}>
          <MccCard accent>
            <MccBadge icon="rocket-launch-outline">Jetzt du</MccBadge>
            <MccCardTitle>Deine Stimme bewegt was</MccCardTitle>
            <MccBody muted>
              Je mehr mitmachen, desto besser trifft der Club die Wahl für alle. Stimm ab – es dauert nur einen Moment.
            </MccBody>
            <Pressable
              style={({ pressed }) => [styles.cta, { backgroundColor: theme.mcc.accentDeep }, pressed && styles.ctaPressed]}
              onPress={() => router.push("/")}
            >
              <MaterialCommunityIcons name="check-decagram-outline" size={18} color="#FFFFFF" />
              <Text style={styles.ctaText}>Jetzt abstimmen</Text>
            </Pressable>
          </MccCard>
        </Reveal>
      </MccScreen>
      <BottomNav active="menu" />
    </View>
  );
}

function Row({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: theme.mcc.accentFaint, borderColor: theme.mcc.strongLine }]}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.mcc.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.mcc.textPrimary }]}>{title}</Text>
        <Text style={[styles.rowBody, { color: theme.mcc.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 12, marginTop: 4 },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  rowIcon: { alignItems: "center", borderRadius: 12, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "900", lineHeight: 20 },
  rowBody: { fontSize: 13, lineHeight: 19 },
  cta: { alignItems: "center", borderRadius: 999, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 12, paddingHorizontal: 16, paddingVertical: 12 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
