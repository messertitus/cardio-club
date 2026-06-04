import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SearchField } from "../../../src/components/FormControls";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
import { listEventProposals, listSports, proposeSport, type Row } from "../../../src/services";

export default function ProposeSportScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [proposals, setProposals] = useState<Row<"sport_proposals">[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSportId, setSavingSportId] = useState<string | null>(null);
  const [sportSearch, setSportSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const proposedSportIds = useMemo(() => new Set(proposals.map((proposal) => proposal.sport_id)), [proposals]);
  const filteredSports = useMemo(() => {
    const query = sportSearch.trim().toLowerCase();
    if (!query) return sports;
    return sports.filter((sport) =>
      [sport.name, sport.category, sport.intensity_level, sport.combinable_tags?.join(" ")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [sportSearch, sports]);

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [sportsResult, proposalsResult] = await Promise.all([
      listSports(supabase),
      listEventProposals(supabase, eventId),
    ]);
    setSports(sportsResult.data ?? []);
    setProposals(proposalsResult.data ?? []);
    setError(sportsResult.error?.message ?? proposalsResult.error?.message ?? null);
    setLoading(false);
  }

  async function submit(sportId: string) {
    if (!user) {
      router.replace("/auth");
      return;
    }

    setSavingSportId(sportId);
    const result = await proposeSport(supabase, {
      eventId,
      sportId,
      proposedBy: user.id,
    });
    setSavingSportId(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    await load();
  }

  return (
    <Screen title="Sportart vorschlagen" subtitle="Nur vorgeschlagene Sportarten können diese Woche gewinnen.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      <SearchField value={sportSearch} onChangeText={setSportSearch} placeholder="Sportart suchen" />
      {!loading && filteredSports.length === 0 ? <Text style={ui.body}>Keine Sportarten für diese Suche.</Text> : null}
      {filteredSports.map((sport) => {
        const proposed = proposedSportIds.has(sport.id);

        return (
          <Card key={sport.id}>
            <Pill>{sport.category}</Pill>
            <View style={styles.sportTitleRow}>
              <SportIconBadge sport={sport} size={36} />
              <Text style={[ui.cardTitle, styles.sportTitleText]}>{sport.name}</Text>
            </View>
            <Text style={ui.body}>
              {sport.intensity_level} · {sport.location_type}
            </Text>
            <Button
              label={proposed ? "Bereits vorgeschlagen" : "Vorschlagen"}
              variant={proposed ? "secondary" : "primary"}
              disabled={proposed || savingSportId === sport.id}
              onPress={() => submit(sport.id)}
            />
          </Card>
        );
      })}
      <Button label="Weiter zur Abstimmung" variant="secondary" onPress={() => router.push(`/events/${eventId}/vote`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sportTitleRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  sportTitleText: { flex: 1, minWidth: 0 },
});
