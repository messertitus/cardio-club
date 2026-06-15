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
const HOW: { icon: IconName; title: string; step: string; body: string }[] = [
  { icon: "account-check-outline", step: "1", title: "Wer ist dabei?", body: "Der Club schaut, wer zugesagt hat. Nur deren Stimmen zählen – ein festes Ja wiegt dabei etwas mehr als ein Vielleicht." },
  { icon: "format-list-numbered", step: "2", title: "Wünsche sammeln", body: "Aus euren Ranglisten wird je Sportart eine Punktzahl. Deine 1. Wahl bringt mehr als deine 3. – jede Stimme zählt, nicht nur die Mehrheit." },
  { icon: "hand-back-left-outline", step: "3", title: "No-Gos aussortieren", body: "Was als No-Go markiert ist, wird möglichst gar nicht erst gewählt – eine harte Grenze, kein Kann-man-ignorieren." },
  { icon: "puzzle-outline", step: "4", title: "Beste Kombination bauen", body: "Der Club probiert Kombinationen aus Sportart(en) und Standort(en) durch und nimmt die, die zusammen am meisten Leute glücklich macht." },
  { icon: "check-decagram-outline", step: "5", title: "Entscheiden & zeigen", body: "Die fairste Variante gewinnt und wird euch mit Standort und Details angezeigt." },
];

// Deeper, but still plain-language, factors the algorithm weighs.
const FACTORS: { icon: IconName; title: string; body: string }[] = [
  { icon: "sort", title: "Reihenfolge zählt", body: "Ranked Voting: höhere Plätze geben mehr Gewicht – fairer als nur eine Stimme pro Person." },
  { icon: "shield-check-outline", title: "No-Gos sind hart", body: "Eine Sportart mit vielen No-Gos wird nur im Notfall gewählt – niemand soll sich gezwungen fühlen." },
  { icon: "history", title: "Vernachlässigungs-Schutz", body: "Wer länger seine Lieblingssportart nicht bekommen hat, erhält etwas mehr Gewicht. So ist nicht immer dieselbe Gruppe dran." },
  { icon: "scale-balance", title: "Mehrheits-Schutz", body: "Eine klare Mehrheit wird nicht von einer kleinen Gruppe überstimmt – Fairness heißt nicht, Mehrheiten zu übergehen." },
  { icon: "map-marker-radius-outline", title: "Passt der Standort?", body: "Gruppengröße, Indoor/Outdoor und Wetter fließen ein – eine Sportart muss am Tag auch wirklich machbar sein." },
  { icon: "account-multiple-outline", title: "Manchmal mehrere Gruppen", body: "Wenn es passt, laufen parallele Sportarten – so bekommen mehr Leute ihre Wahl statt nur die größte Gruppe." },
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
            <MccCardTitle>In 5 Schritten zur Wahl</MccCardTitle>
            <View style={styles.rows}>
              {HOW.map((item) => (
                <StepRow key={item.title} step={item.step} title={item.title} body={item.body} />
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={2}>
          <MccCard>
            <MccBadge icon="tune-variant">Im Hintergrund</MccBadge>
            <MccCardTitle>Was fair abgewogen wird</MccCardTitle>
            <MccBody muted>
              Damit es wirklich fair ist – und nicht nur die größte oder lauteste Gruppe gewinnt – wägt der Club mehrere Dinge gegeneinander ab:
            </MccBody>
            <View style={styles.rows}>
              {FACTORS.map((item) => (
                <Row key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </View>
          </MccCard>
        </Reveal>

        <Reveal index={3}>
          <MccCard>
            <MccBadge icon="lightbulb-outline">Beispiel</MccBadge>
            <MccCardTitle>Zusammen statt getrennt</MccCardTitle>
            <MccBody muted>
              In der Abstimmung landen Beachvolleyball, Outdoor-Boxen und Schwimmen vorne. Statt drei Gruppen an drei Orten aufzuteilen, wählt der Club das Strandbad Horn – denn dort ist alles drei am selben Ort möglich. So macht jeder seinen Sport und trotzdem seid ihr gemeinsam unterwegs. Der Algorithmus sucht genau solche Standorte, an denen die gewählten Sportarten zusammenpassen.
            </MccBody>
          </MccCard>
        </Reveal>

        <Reveal index={4}>
          <MccCard>
            <MccBadge icon="heart-outline">Warum so?</MccBadge>
            <MccCardTitle>Fair statt laut</MccCardTitle>
            <MccBody muted>
              Statt endlosem Hin und Her im Chat trifft der Club die Wahl automatisch – nach klaren, gleichen Regeln für alle. Das schützt auch die, die mal in der Minderheit sind, und sorgt für Abwechslung. So fühlt sich jeder Cardiotag fair an.
            </MccBody>
          </MccCard>
        </Reveal>

        <Reveal index={5}>
          <MccCard>
            <MccBadge icon="clock-outline">Wann?</MccBadge>
            <MccCardTitle>Kurz vorher steht's fest</MccCardTitle>
            <MccBody muted>
              Du stimmst entspannt unter der Woche ab. Kurz vor dem Cardiotag entscheidet der Club – danach siehst du, welche Sportart an welchem Standort läuft. Kein Stress, keine Diskussion.
            </MccBody>
          </MccCard>
        </Reveal>

        <Reveal index={6}>
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

function StepRow({ step, title, body }: { step: string; title: string; body: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.stepBubble, { backgroundColor: theme.mcc.accentDeep }]}>
        <Text style={styles.stepBubbleText}>{step}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.mcc.textPrimary }]}>{title}</Text>
        <Text style={[styles.rowBody, { color: theme.mcc.textSecondary }]}>{body}</Text>
      </View>
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
  stepBubble: { alignItems: "center", borderRadius: 999, height: 28, justifyContent: "center", marginTop: 2, width: 28 },
  stepBubbleText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "900", lineHeight: 20 },
  rowBody: { fontSize: 13, lineHeight: 19 },
  cta: { alignItems: "center", borderRadius: 999, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 12, paddingHorizontal: 16, paddingVertical: 12 },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
});
