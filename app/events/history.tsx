import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { DetailLine } from "../../src/components/FormControls";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../src/components/ui";
import { useAuth } from "../../src/context/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { getMccEventState, listEventActivities, listEventHistory, listEventResults, listSports, type Row } from "../../src/services";

type EventWithActivities = {
  event: Row<"weekly_events">;
  activities: Row<"event_activities">[];
  results: Row<"event_results">[];
};

export default function EventHistoryScreen() {
  const { loading, user } = useAuth();
  const [events, setEvents] = useState<EventWithActivities[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setBusy(true);
      const state = await getMccEventState(supabase, user.id);
      if (state.error) {
        setError(state.error.message);
        setBusy(false);
        return;
      }
      const [historyResult, sportsResult] = await Promise.all([listEventHistory(supabase, state.data.clubId), listSports(supabase)]);
      if (historyResult.error || sportsResult.error) {
        setError(historyResult.error?.message ?? sportsResult.error?.message ?? null);
        setBusy(false);
        return;
      }
      const [activityResults, resultResults] = await Promise.all([
        Promise.all(historyResult.data.map((event) => listEventActivities(supabase, event.id))),
        Promise.all(historyResult.data.map((event) => listEventResults(supabase, event.id))),
      ]);
      setEvents(
        historyResult.data.map((event, index) => ({
          event,
          activities: activityResults[index]?.data ?? [],
          results: resultResults[index]?.data ?? [],
        })),
      );
      setSports(sportsResult.data);
      setBusy(false);
    }

    void load();
  }, [user]);

  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <Screen title="Vergangene Events" subtitle="Entscheidungen, konkrete Aktivitäten und Details rückwirkend ansehen.">
      <Button label="Zurück" variant="ghost" onPress={() => router.back()} />
      <ErrorText>{error}</ErrorText>
      {busy ? <LoadingState /> : null}
      {!busy && events.length === 0 ? <Text style={ui.body}>Noch keine Events.</Text> : null}
      {events.map(({ event, activities, results }) => {
        const opened = expandedEventId === event.id;
        return (
          <Card key={event.id}>
            <Pill>{eventTypeLabel(event.decision_type)}</Pill>
            <Text style={ui.cardTitle}>Woche ab {event.week_start_date}</Text>
            <Text style={ui.body}>{event.decision_reason ?? "Noch keine Entscheidung gespeichert."}</Text>
            {activities.slice(0, opened ? activities.length : 2).map((activity) => (
              <View key={activity.id}>
                <Text style={ui.body}>
                  {activity.title || sportNames.get(activity.sport_id) || "Aktivität"}
                  {activity.location ? ` - ${activity.location}` : ""}
                </Text>
              </View>
            ))}
            {opened ? (
              <>
                <DetailLine label="Status" value={event.status} />
                <DetailLine label="Zeit" value={event.starts_at ? new Date(event.starts_at).toLocaleString("de-DE") : null} />
                <DetailLine label="Ort" value={event.location} />
                <DetailLine label="Notizen" value={event.notes} />
                <DetailLine label="Aktivitäten" value={activities.length ? `${activities.length}` : "0"} />
                <DetailLine label="Ergebnisse" value={results.length ? results.map((result) => result.summary).join(" | ") : "Noch keine"} />
              </>
            ) : null}
            <Button label={opened ? "Weniger" : "Details"} variant="secondary" onPress={() => setExpandedEventId(opened ? null : event.id)} />
          </Card>
        );
      })}
    </Screen>
  );
}

function eventTypeLabel(type: Row<"weekly_events">["decision_type"]): string {
  if (type === "multi_sport") return "Multi-Sport";
  if (type === "twin") return "Twin Event";
  if (type === "single") return "Single Event";
  return "Offen";
}
