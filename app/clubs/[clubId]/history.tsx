import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Card, EmptyState, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import { listEventHistory, type Row } from "../../../src/services";

export default function EventHistoryScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const [events, setEvents] = useState<Row<"weekly_events">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await listEventHistory(supabase, clubId);
      setEvents(result.data ?? []);
      setError(result.error?.message ?? null);
      setLoading(false);
    }

    load();
  }, [clubId]);

  return (
    <Screen title="Event-Verlauf" subtitle="Ein kurzer Blick darauf, was zuletzt gewählt wurde.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      {!loading && events.length === 0 ? <EmptyState title="Noch kein Verlauf" /> : null}
      {events.map((event) => (
        <Card key={event.id}>
          <Pill>{event.status}</Pill>
          <Text style={ui.cardTitle}>Woche ab {event.week_start_date}</Text>
          <Text style={ui.body}>Typ: {eventTypeLabel(event.decision_type)}</Text>
          {event.decision_reason ? <Text style={ui.body}>{event.decision_reason}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

function eventTypeLabel(type: Row<"weekly_events">["decision_type"]): string {
  if (type === "multi_sport") return "Multi-Sport";
  if (type === "twin") return "Twin Event";
  if (type === "single") return "Single Event";
  return "noch offen";
}
