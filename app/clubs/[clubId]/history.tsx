import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, InlineError, LoadingSkeleton, MccBadge, MccBody, MccCard, MccCardTitle, MccScreen } from "../../../src/components/MccDesign";
import { Reveal } from "../../../src/components/Motion";
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
      <InlineError>{error}</InlineError>
      {loading ? <LoadingSkeleton lines={3} /> : null}
      {!loading && events.length === 0 ? <EmptyState title="Noch kein Verlauf" /> : null}
      {events.map((event, index) => (
        <Reveal key={event.id} index={index}>
          <MccCard>
            <View style={styles.badgeRow}>
              <MccBadge icon={eventTypeIcon(event.decision_type)} tone={event.decision_type ? "accent" : "neutral"}>
                {eventTypeLabel(event.decision_type)}
              </MccBadge>
              <MccBadge icon={event.status === "completed" ? "check-decagram" : "calendar-blank-outline"} tone={event.status === "completed" ? "success" : "neutral"}>
                {event.status === "completed" ? "Abgeschlossen" : event.status}
              </MccBadge>
            </View>
            <MccCardTitle>Cardiotag am {formatCardioSunday(event.starts_at ?? event.week_start_date)}</MccCardTitle>
            {event.decision_reason ? <MccBody muted>{event.decision_reason}</MccBody> : null}
          </MccCard>
        </Reveal>
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

function eventTypeIcon(type: Row<"weekly_events">["decision_type"]): ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (type === "multi_sport") return "vector-combine";
  if (type === "twin") return "call-split";
  if (type === "single") return "trophy-outline";
  return "calendar-blank-outline";
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
