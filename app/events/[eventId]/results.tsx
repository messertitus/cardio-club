import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LabeledInput, SegmentedControl } from "../../../src/components/FormControls";
import { MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen } from "../../../src/components/MccDesign";
import { ErrorText, LoadingState } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { useTheme } from "../../../src/context/ThemeContext";
import { supabase } from "../../../src/lib/supabase";
import { listEventActivities, listEventResults, upsertEventResult, type Row } from "../../../src/services";

export default function EventResultsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { loading, user } = useAuth();
  const { theme } = useTheme();
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
    <MccScreen title="Spielergebnisse" kicker="Recap" subtitle="Wenn ein Event laeuft oder vorbei ist, koennen Ergebnisse und kurze Zusammenfassungen gespeichert werden.">
      <ErrorText>{error}</ErrorText>
      {busy ? <LoadingState /> : null}
      {!busy && !canEnterResults ? (
        <MccCard>
          <MccCardTitle>Noch nicht freigeschaltet</MccCardTitle>
          <MccBody muted>Ergebnisse sind ab Eventstart sinnvoll. Bis dahin bleibt diese Seite nur lesend.</MccBody>
        </MccCard>
      ) : null}

      {canEnterResults ? (
        <MccCard accent>
          <MccBadge icon="trophy-outline">Eintragen</MccBadge>
          {activities.length > 0 ? (
            <View style={{ gap: 8 }}>
              <MccBody>Aktivität</MccBody>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {activities.map((activity) => {
                  const active = activityId === activity.id;
                  return (
                    <Pressable
                      key={activity.id}
                      style={{
                        backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surfaceSoft,
                        borderColor: active ? theme.mcc.accent : theme.mcc.line,
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                      onPress={() => setActivityId(activity.id)}
                    >
                      <Text style={{ color: active ? "#FFFFFF" : theme.mcc.textPrimary, fontSize: 12, fontWeight: "900" }}>{activity.title}</Text>
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
          <MccButton label="Speichern" icon="content-save-outline" onPress={saveResult} disabled={!summary.trim()} />
        </MccCard>
      ) : null}

      <MccCard>
        <MccCardTitle>Bisherige Ergebnisse</MccCardTitle>
        {results.length === 0 ? <MccBody muted>Noch keine Ergebnisse eingetragen.</MccBody> : null}
        {results.map((result) => {
          const activity = activities.find((entry) => entry.id === result.activity_id);
          return (
            <View key={result.id}>
              <MccBody>
                {activity?.title ?? "Event"} - {resultTypeLabel(result.result_type)}
              </MccBody>
              <MccBody muted>{result.summary}</MccBody>
            </View>
          );
        })}
      </MccCard>
    </MccScreen>
  );
}

function resultTypeLabel(type: Row<"event_results">["result_type"]): string {
  if (type === "score") return "Punkte";
  if (type === "ranking") return "Ranking";
  return "Kurzbericht";
}
