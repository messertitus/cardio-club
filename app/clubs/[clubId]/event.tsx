import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapRouteButton } from "../../../src/components/MapRouteButton";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { Button, Card, ErrorText, Field, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import {
  createWeeklyEvent,
  getCurrentWeeklyEvent,
  listEventActivities,
  listSportProfilesForSports,
  listSports,
  type Row,
} from "../../../src/services";

export default function CurrentWeeklyEventScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const [event, setEvent] = useState<Row<"weekly_events"> | null>(null);
  const [eventActivities, setEventActivities] = useState<Row<"event_activities">[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [clubId]);

  async function load() {
    setLoading(true);
    const eventResult = await getCurrentWeeklyEvent(supabase, { clubId });
    const [activitiesResult, sportsResult] = eventResult.data
      ? await Promise.all([listEventActivities(supabase, eventResult.data.id), listSports(supabase)])
      : [{ data: [] as Row<"event_activities">[], error: null }, await listSports(supabase)];

    const profileSportIds = [...new Set((activitiesResult.data ?? []).map((activity) => activity.sport_id))];
    const profilesResult = profileSportIds.length > 0 ? await listSportProfilesForSports(supabase, profileSportIds) : { data: [] as Row<"sport_profiles">[], error: null };

    setEvent(eventResult.data);
    setEventActivities(activitiesResult.data ?? []);
    setSports(sportsResult.data ?? []);
    setSportProfiles(profilesResult.data ?? []);
    setError(eventResult.error?.message ?? activitiesResult.error?.message ?? sportsResult.error?.message ?? profilesResult.error?.message ?? null);
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
            <Text style={ui.cardTitle}>{event.decision_type ? eventTypeLabel(event.decision_type) : event.selected_sport_id ? "Sportart entschieden" : "Noch offen"}</Text>
            <Text style={ui.body}>Woche ab {event.week_start_date}</Text>
            {event.location ? <Text style={ui.body}>Ort: {event.location}</Text> : null}
            {event.starts_at ? <Text style={ui.body}>Zeit: {new Date(event.starts_at).toLocaleString("de-DE")}</Text> : null}
            {event.notes ? <Text style={ui.body}>{event.notes}</Text> : null}
            {eventActivities.length > 0 ? (
              <>
                <Text style={ui.body}>Aktivitäten:</Text>
                {eventActivities.map((activity) => {
                  const sport = sports.find((entry) => entry.id === activity.sport_id);
                  const profile = sportProfiles.find((entry) => entry.id === activity.sport_profile_id);
                  return (
                    <View key={activity.id} style={styles.activityRow}>
                      <SportIconBadge sport={sport} size={34} />
                      <Text style={[ui.body, styles.activityText]}>
                        {activity.title || sportName(sports, activity.sport_id)}
                        {activity.location ? ` · ${activity.location}` : ""}
                        {(activity.assigned_user_ids ?? []).length > 0 ? ` · ${(activity.assigned_user_ids ?? []).length} Personen` : ""}
                      </Text>
                      <MapRouteButton target={profile ? profileMapTarget(profile) : activity.location ? { label: activity.location } : null} compact />
                    </View>
                  );
                })}
              </>
            ) : null}
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

function eventTypeLabel(type: Row<"weekly_events">["decision_type"]): string {
  if (type === "multi_sport") return "Multi-Sport Event";
  if (type === "twin") return "Twin Event";
  if (type === "single") return "Single Event";
  return "Noch offen";
}

function sportName(sports: Row<"sports">[], sportId: string): string {
  return sports.find((sport) => sport.id === sportId)?.name ?? "Sportart";
}

function profileMapTarget(profile: Row<"sport_profiles">) {
  return {
    latitude: profile.latitude,
    longitude: profile.longitude,
    mapUrl: profile.map_url,
    label: [profile.location_name, profile.location_city, profile.postal_code].filter(Boolean).join(" "),
  };
}

const styles = StyleSheet.create({
  activityRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  activityText: { flex: 1, minWidth: 0 },
});
