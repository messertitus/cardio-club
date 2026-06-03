import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LabeledInput, SegmentedControl } from "../../../src/components/FormControls";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { supabase } from "../../../src/lib/supabase";
import { listEventActivities, listEventResults, upsertEventResult, type Row } from "../../../src/services";

export default function EventResultsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { loading, user } = useAuth();
  const [event, setEvent] = useState<Row<"weekly_events"> | null>(null);
  const [activities, setActivities] = useState<Row<"event_activities">[]>([]);
  const [results, setResults] = useState<Row<"event_results">[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [resultType, setResultType] = useState<Row<"event_results">["result_type"]>("summary");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [eventId]);

  async function load() {
    setBusy(true);
    const [eventResult, activitiesResult, resultsResult] = await Promise.all([
      supabase.from("weekly_events").select().eq("id", eventId).maybeSingle(),
      listEventActivities(supabase, eventId),
      listEventResults(supabase, eventId),
    ]);
    setEvent(eventResult.data ?? null);
    setActivities(activitiesResult.data ?? []);
    setResults(resultsResult.data ?? []);
    setActivityId((current) => current ?? activitiesResult.data?.[0]?.id ?? null);
    setError(eventResult.error?.message ?? activitiesResult.error?.message ?? resultsResult.error?.message ?? null);
    setBusy(false);
  }

  const canEnterResults = useMemo(() => {
    if (!event) return false;
    if (event.status === "completed") return true;
    if (!event.starts_at) return event.status === "decided";
    return new Date(event.starts_at).getTime() <= Date.now();
  }, [event]);

  async function saveResult() {
    if (!user || !event) return;
    const activity = activities.find((entry) => entry.id === activityId) ?? null;
    const result = await upsertEventResult(supabase, {
      eventId: event.id,
      activityId: activity?.id ?? null,
      sportId: activity?.sport_id ?? null,
      resultType,
      summary,
      userId: user.id,
    });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSummary("");
    await load();
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <Screen title="Spielergebnisse" subtitle="Wenn ein Event läuft oder vorbei ist, können Ergebnisse und kurze Zusammenfassungen gespeichert werden.">
      <ErrorText>{error}</ErrorText>
      {busy ? <LoadingState /> : null}
      {!busy && !canEnterResults ? (
        <Card>
          <Text style={ui.cardTitle}>Noch nicht freigeschaltet</Text>
          <Text style={ui.body}>Ergebnisse sind ab Eventstart sinnvoll. Bis dahin bleibt diese Seite nur lesend.</Text>
        </Card>
      ) : null}

      {canEnterResults ? (
        <Card>
          <Pill>Eintragen</Pill>
          {activities.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={ui.body}>Aktivität</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {activities.map((activity) => {
                  const active = activityId === activity.id;
                  return (
                    <Pressable key={activity.id} style={[ui.pill, active && { backgroundColor: "#ffffff" }]} onPress={() => setActivityId(activity.id)}>
                      <Text style={[ui.pillText, active && { color: "#05070b" }]}>{activity.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <SegmentedControl
            label="Art"
            value={resultType}
            onChange={setResultType}
            options={[
              { value: "summary", label: "Kurzbericht" },
              { value: "score", label: "Punkte" },
              { value: "ranking", label: "Ranking" },
            ]}
          />
          <LabeledInput label="Ergebnis" required value={summary} onChangeText={setSummary} placeholder="z. B. Team Blau gewinnt 21:18, 18:21, 15:12" multiline />
          <Button label="Speichern" onPress={saveResult} disabled={!summary.trim()} />
        </Card>
      ) : null}

      <Card>
        <Text style={ui.cardTitle}>Bisherige Ergebnisse</Text>
        {results.length === 0 ? <Text style={ui.body}>Noch keine Ergebnisse eingetragen.</Text> : null}
        {results.map((result) => {
          const activity = activities.find((entry) => entry.id === result.activity_id);
          return (
            <View key={result.id}>
              <Text style={ui.body}>
                {activity?.title ?? "Event"} - {resultTypeLabel(result.result_type)}
              </Text>
              <Text style={ui.body}>{result.summary}</Text>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function resultTypeLabel(type: Row<"event_results">["result_type"]): string {
  if (type === "score") return "Punkte";
  if (type === "ranking") return "Ranking";
  return "Kurzbericht";
}
