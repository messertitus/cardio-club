import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Button, Card, ErrorText, LoadingState, Screen, ui } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import { getClub, getCurrentWeeklyEvent, type Row } from "../../../src/services";

export default function ClubDashboardScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const [club, setClub] = useState<Row<"clubs"> | null>(null);
  const [event, setEvent] = useState<Row<"weekly_events"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [clubResult, eventResult] = await Promise.all([
        getClub(supabase, clubId),
        getCurrentWeeklyEvent(supabase, { clubId }),
      ]);

      if (!active) {
        return;
      }

      setClub(clubResult.data);
      setEvent(eventResult.data);
      setError(clubResult.error?.message ?? eventResult.error?.message ?? null);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [clubId]);

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen title={club?.name ?? "Club"} subtitle={club?.description ?? "Gemeinsamer Cardiotag ohne Wiederholung von letzter Woche."}>
      <ErrorText>{error}</ErrorText>
      <Card>
        <Text style={ui.cardTitle}>Diese Woche</Text>
        <Text style={ui.body}>
          {event ? `Status: ${event.status}` : "Für diese Woche gibt es noch kein Event."}
        </Text>
        <Button label="Diese Woche öffnen" onPress={() => router.push(`/clubs/${clubId}/event`)} />
      </Card>
      <Card>
        <Text style={ui.cardTitle}>Planung</Text>
        <Text style={ui.body}>Vorschläge sammeln, abstimmen und die faire Entscheidung anzeigen.</Text>
        {event ? (
          <>
            <Button label="Sportart vorschlagen" variant="secondary" onPress={() => router.push(`/events/${event.id}/propose`)} />
            <Button label="Abstimmen" variant="secondary" onPress={() => router.push(`/events/${event.id}/vote`)} />
            <Button label="Entscheidung anzeigen" variant="secondary" onPress={() => router.push(`/events/${event.id}/decision`)} />
          </>
        ) : null}
      </Card>
      <Button label="Event-Verlauf" variant="secondary" onPress={() => router.push(`/clubs/${clubId}/history`)} />
    </Screen>
  );
}
