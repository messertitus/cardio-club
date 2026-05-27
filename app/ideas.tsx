import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { Button, LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import { listSportIdeas, listSports, suggestSportIdea, type Row } from "../src/services";

export default function IdeasScreen() {
  const { loading, user } = useAuth();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [ideas, setIdeas] = useState<Row<"sport_ideas">[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const [sportsResult, ideasResult] = await Promise.all([listSports(supabase), listSportIdeas(supabase)]);
    setBusy(false);
    if (sportsResult.data) setSports(sportsResult.data);
    if (ideasResult.data) setIdeas(ideasResult.data);
    if (sportsResult.error || ideasResult.error) setMessage(sportsResult.error?.message ?? ideasResult.error?.message ?? null);
  }

  useEffect(() => {
    if (user) void load();
  }, [user]);

  async function addIdea() {
    if (!user || !name.trim()) return;

    setMessage(null);
    const result = await suggestSportIdea(supabase, { userId: user.id, name, note, location, preferredTime });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setName("");
    setNote("");
    setLocation("");
    setPreferredTime("");
    setMessage("Idee eingereicht.");
    await load();
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Sportideen</Text>
          <Text style={styles.title}>Neue Aktivität vorschlagen</Text>
          {message ? <Text style={styles.notice}>{message}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Idee</Text>
            <SoftInput value={name} onChangeText={setName} placeholder="Name, z. B. Rudern" returnKeyType="next" />
            <SoftInput value={location} onChangeText={setLocation} placeholder="Ort, falls bekannt" returnKeyType="next" />
            <SoftInput value={preferredTime} onChangeText={setPreferredTime} placeholder="Uhrzeit, falls bekannt" returnKeyType="next" />
            <SoftInput value={note} onChangeText={setNote} placeholder="Kurz beschreiben" multiline returnKeyType="done" />
            <Button label="Einreichen" onPress={addIdea} disabled={!name.trim() || busy} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aktive Sportarten</Text>
            <View style={styles.sportGrid}>
              {sports.map((sport) => (
                <View key={sport.id} style={styles.sportPill}>
                  <Text style={styles.sportPillText}>{sport.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Warteschlange</Text>
            {ideas.length === 0 ? <Text style={styles.body}>Noch keine neuen Ideen.</Text> : null}
            {ideas.map((idea) => (
              <Pressable key={idea.id} style={styles.ideaRow}>
                <View style={styles.ideaText}>
                  <Text style={styles.ideaName}>{idea.name}</Text>
                  {idea.location || idea.preferred_time ? (
                    <Text style={styles.ideaMeta}>{[idea.location, idea.preferred_time].filter(Boolean).join(" · ")}</Text>
                  ) : null}
                  {idea.note ? <Text style={styles.ideaNote}>{idea.note}</Text> : null}
                </View>
                <Text style={styles.ideaStatus}>{idea.status === "pending" ? "wartet" : idea.status}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function SoftInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor="#728197" style={styles.input} {...props} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { gap: 16, padding: 18, paddingBottom: 34 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "900", letterSpacing: 0, lineHeight: 38 },
  notice: { color: "#5eead4", fontSize: 14, fontWeight: "900" },
  card: {
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  cardTitle: { color: "#ffffff", fontSize: 20, fontWeight: "900" },
  body: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
  sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sportPill: { borderRadius: 999, backgroundColor: "rgba(77,163,255,0.16)", paddingHorizontal: 10, paddingVertical: 8 },
  sportPillText: { color: "#8fc7ff", fontSize: 13, fontWeight: "900" },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    outlineStyle: "none",
  } as object,
  ideaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 11,
  },
  ideaText: { flex: 1, gap: 3 },
  ideaName: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  ideaMeta: { color: "#8fc7ff", fontSize: 13, fontWeight: "800" },
  ideaNote: { color: "#9aa7b8", fontSize: 13, lineHeight: 18 },
  ideaStatus: { color: "#5eead4", fontSize: 13, fontWeight: "900" },
});
