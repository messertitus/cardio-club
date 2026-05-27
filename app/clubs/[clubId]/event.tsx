import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Button, Card, ErrorText, Field, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import { createWeeklyEvent, getCurrentWeeklyEvent, type Row } from "../../../src/services";

export default function CurrentWeeklyEventScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const [event, setEvent] = useState<Row<"weekly_events"> | null>(null);
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [clubId]);

  async function load() {
    setLoading(true);
    const result = await getCurrentWeeklyEvent(supabase, { clubId });
    setEvent(result.data);
    setError(result.error?.message ?? null);
    setLoading(false);
  }

  async function createEvent() {
    setSaving(true);
    setError(null);
    const result = await createWeeklyEvent(supabase, {
      clubId,
      location: location || null,
      startsAt: startsAt || null,
      notes: notes || null,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setEvent(result.data);
  }

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen title="Diese Woche" subtitle="Plane den gemeinsamen Cardiotag und halte die Entscheidung sichtbar.">
      <ErrorText>{error}</ErrorText>
      {event ? (
        <>
          <Card>
            <Pill>{event.status}</Pill>
            <Text style={ui.cardTitle}>{event.selected_sport_id ? "Sportart entschieden" : "Noch offen"}</Text>
            <Text style={ui.body}>Woche ab {event.week_start_date}</Text>
            {event.location ? <Text style={ui.body}>Ort: {event.location}</Text> : null}
            {event.starts_at ? <Text style={ui.body}>Zeit: {new Date(event.starts_at).toLocaleString("de-DE")}</Text> : null}
            {event.notes ? <Text style={ui.body}>{event.notes}</Text> : null}
          </Card>
          <Button label="Sportart vorschlagen" onPress={() => router.push(`/events/${event.id}/propose`)} />
          <Button label="Abstimmen" variant="secondary" onPress={() => router.push(`/events/${event.id}/vote`)} />
          <Button label="Entscheidung anzeigen" variant="secondary" onPress={() => router.push(`/events/${event.id}/decision`)} />
          <Button label="Teilnahme" variant="secondary" onPress={() => router.push(`/events/${event.id}/attendance`)} />
        </>
      ) : (
        <Card>
          <Text style={ui.cardTitle}>Event anlegen</Text>
          <Field label="Ort" value={location} onChangeText={setLocation} placeholder="See, Park, Halle..." />
          <Field label="Startzeit" value={startsAt} onChangeText={setStartsAt} placeholder="2026-05-12T18:00:00+02:00" />
          <Field label="Notizen" value={notes} onChangeText={setNotes} placeholder="Locker, gemeinsam, danach optional Kaffee." multiline />
          <Button label="Diese Woche erstellen" onPress={createEvent} disabled={saving} />
        </Card>
      )}
    </Screen>
  );
}
