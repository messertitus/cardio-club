import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { EmptyState, MccBadge, MccBody, MccCard, MccCardTitle, MccScreen } from "../../../src/components/MccDesign";
import { ErrorText, LoadingState } from "../../../src/components/ui";
import { formatCardioSunday } from "../../../src/services/date";
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
    <MccScreen title="Event-Verlauf" kicker="History" subtitle="Ein kurzer Blick darauf, was zuletzt gewaehlt wurde.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      {!loading && events.length === 0 ? <EmptyState title="Noch kein Verlauf" /> : null}
      {events.map((event) => (
        <MccCard key={event.id}>
          <MccBadge icon="calendar-check-outline">{event.status}</MccBadge>
          <MccCardTitle>Cardiotag am {formatCardioSunday(event.starts_at ?? event.week_start_date)}</MccCardTitle>
          <MccBody>Typ: {eventTypeLabel(event.decision_type)}</MccBody>
          {event.decision_reason ? <MccBody muted>{event.decision_reason}</MccBody> : null}
        </MccCard>
      ))}
    </MccScreen>
  );
}

function eventTypeLabel(type: Row<"weekly_events">["decision_type"]): string {
  if (type === "multi_sport") return "Multi-Sport";
  if (type === "twin") return "Twin Event";
  if (type === "single") return "Single Event";
  return "noch offen";
}
