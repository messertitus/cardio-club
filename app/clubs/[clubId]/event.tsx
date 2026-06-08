import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MapRouteButton } from "../../../src/components/MapRouteButton";
import { MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen, SundayRibbon } from "../../../src/components/MccDesign";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { ErrorText, Field, LoadingState } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import { formatCardioSunday, getCardioSundayDate } from "../../../src/services/date";
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
      startsAt: startsAt || defaultSundayStartIso(),
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
      <MccScreen>
        <LoadingState />
      </MccScreen>
    );
  }

  return (
    <MccScreen title="Diese Woche" kicker="Club Event" subtitle="Plane den Cardiotag am Sonntag und halte die Entscheidung sichtbar.">
      <ErrorText>{error}</ErrorText>
      {event ? (
        <>
          <MccCard accent>
            <MccBadge icon="calendar-star">{event.status}</MccBadge>
            <MccCardTitle>{event.decision_type ? eventTypeLabel(event.decision_type) : event.selected_sport_id ? "Sportart entschieden" : "Noch offen"}</MccCardTitle>
            <SundayRibbon date={formatCardioSunday(event.starts_at ?? event.week_start_date)} />
            {event.location ? <MccBody>Ort: {event.location}</MccBody> : null}
            {event.starts_at ? <MccBody muted>Zeit: {new Date(event.starts_at).toLocaleString("de-DE")}</MccBody> : null}
            {event.notes ? <MccBody muted>{event.notes}</MccBody> : null}
            {eventActivities.length > 0 ? (
              <>
                <MccBody>Aktivitaeten:</MccBody>
                {eventActivities.map((activity) => {
                  const sport = sports.find((entry) => entry.id === activity.sport_id);
                  const profile = sportProfiles.find((entry) => entry.id === activity.sport_profile_id);
                  return (
                    <View key={activity.id} style={styles.activityRow}>
                      <SportIconBadge sport={sport} size={34} />
                      <MccBody style={styles.activityText}>
                        {activity.title || sportName(sports, activity.sport_id)}
                        {activity.location ? ` - ${activity.location}` : ""}
                        {(activity.assigned_user_ids ?? []).length > 0 ? ` - ${(activity.assigned_user_ids ?? []).length} Personen` : ""}
                      </MccBody>
                      <MapRouteButton target={profile ? profileMapTarget(profile) : activity.location ? { label: activity.location } : null} compact />
                    </View>
                  );
                })}
              </>
            ) : null}
          </MccCard>
          <MccButton label="Sportart vorschlagen" icon="lightbulb-on-outline" onPress={() => router.push(`/events/${event.id}/propose`)} />
          <MccButton label="Abstimmen" icon="vote-outline" variant="secondary" onPress={() => router.push(`/events/${event.id}/vote`)} />
          <MccButton label="Entscheidung anzeigen" icon="trophy-outline" variant="secondary" onPress={() => router.push(`/events/${event.id}/decision`)} />
          <MccButton label="Teilnahme" icon="account-group-outline" variant="secondary" onPress={() => router.push(`/events/${event.id}/attendance`)} />
        </>
      ) : (
        <MccCard accent>
          <MccBadge icon="plus-circle-outline">Sonntag</MccBadge>
          <MccCardTitle>Event anlegen</MccCardTitle>
          <SundayRibbon date={formatCardioSunday(defaultSundayStartIso())} />
          <Field label="Ort" value={location} onChangeText={setLocation} placeholder="See, Park, Halle..." />
          <Field label="Startzeit" value={startsAt} onChangeText={setStartsAt} placeholder={defaultSundayStartIso()} />
          <Field label="Notizen" value={notes} onChangeText={setNotes} placeholder="Locker, gemeinsam, danach optional Kaffee." multiline />
          <MccButton label="Sonntag erstellen" icon="calendar-plus" onPress={createEvent} disabled={saving} />
        </MccCard>
      )}
    </MccScreen>
  );
}

function defaultSundayStartIso(): string {
  const sunday = getCardioSundayDate();
  sunday.setUTCHours(16, 0, 0, 0);
  return sunday.toISOString();
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
