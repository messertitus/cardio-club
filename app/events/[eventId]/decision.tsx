import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapRouteButton } from "../../../src/components/MapRouteButton";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import { supabase } from "../../../src/lib/supabase";
import {
  finalizeEventDecision,
  getEventDecisionPreview,
  listSportProfilesForSports,
  listSports,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";

export default function DecisionResultScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [decision, setDecision] = useState<EventDecisionPreview | null>(null);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);
  const presentation = useMemo(() => (decision ? buildDecisionPresentation(decision, sportNames) : null), [decision, sportNames]);

  useEffect(() => {
    void load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [sportsResult, decisionResult] = await Promise.all([
      listSports(supabase),
      getEventDecisionPreview(supabase, { eventId }),
    ]);
    const decisionSportIds = decisionResult.data ? [...new Set(decisionResult.data.activities.map((activity) => activity.sportId))] : [];
    const profilesResult = await listSportProfilesForSports(supabase, decisionSportIds);
    setSports(sportsResult.data ?? []);
    setSportProfiles(profilesResult.data ?? []);
    setDecision(decisionResult.data);
    setError(sportsResult.error?.message ?? decisionResult.error?.message ?? profilesResult.error?.message ?? null);
    setLoading(false);
  }

  async function finalize() {
    setSaving(true);
    const result = await finalizeEventDecision(supabase, { eventId });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setDecision(result.data.decision);
  }

  return (
    <Screen title="Entscheidung anzeigen" subtitle="Kurz erklärt, warum diese Woche genau diese Sportart vorgeschlagen wird.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      {decision && presentation ? (
        <>
          <Card>
            {presentation.resultLabels.map((label) => (
              <Pill key={label}>{label}</Pill>
            ))}
            <View style={styles.titleRow}>
              <SportIconBadge sport={sports.find((sport) => sport.id === decision.selectedSportId)} size={38} />
              <Text style={[ui.title, styles.titleText]}>{presentation.selectedSportName}</Text>
            </View>
            {presentation.secondarySportName ? <Text style={ui.cardTitle}>+ {presentation.secondarySportName}</Text> : null}
          </Card>

          <Card>
            <Text style={ui.cardTitle}>Warum diese Sportart?</Text>
            <Text style={ui.body}>{presentation.simpleExplanation}</Text>
            <Text style={ui.body}>Die Sportart von letzter Woche bekommt einen Rotations-Malus, wird aber nicht hart ausgeschlossen.</Text>
          </Card>

          {decision.mode === "multi_sport" ? (
            <Card>
              <Text style={ui.cardTitle}>Multi-Sport Event</Text>
              <Text style={ui.body}>Mehrere Sportprofile liegen nah genug beieinander, damit es ein gemeinsames Club-Event bleibt.</Text>
            </Card>
          ) : null}

          {decision.mode === "twin" ? (
            <Card>
              <Text style={ui.cardTitle}>Twin Event</Text>
              <Text style={ui.body}>Die Unterstützung ist klar geteilt. Die App empfiehlt zwei echte Gruppen statt einen faulen Kompromiss.</Text>
            </Card>
          ) : null}

          {presentation.activityRows.length > 0 ? (
            <Card>
              <Text style={ui.cardTitle}>Konkrete Aktivitäten</Text>
              {presentation.activityRows.map((activity) => {
                const profile = sportProfiles.find((entry) => entry.id === activity.profileId);
                return (
                  <View key={activity.profileId} style={styles.activityRow}>
                    <Text style={[ui.body, styles.activityText]}>
                      {activity.sportName}: {activity.profileName}
                      {activity.locationName ? ` · ${activity.locationName}` : ""} · {activity.participantCount} Personen
                      {activity.activityContactId ? " · AP hinterlegt" : ""}
                      {(activity.weatherNotes ?? []).length > 0 ? `\nWetter: ${(activity.weatherNotes ?? []).slice(0, 2).join(" ")}` : ""}
                      {(activity.practicalityNotes ?? []).length > 0 ? `\nMachbarkeit: ${(activity.practicalityNotes ?? []).slice(0, 2).join(" ")}` : ""}
                    </Text>
                    <MapRouteButton target={profile ? profileMapTarget(profile) : activity.locationName ? { label: activity.locationName } : null} compact />
                  </View>
                );
              })}
            </Card>
          ) : null}

          <Card>
            <Text style={ui.cardTitle}>Details</Text>
            <Text style={ui.body}>Die genaue Bewertung ist optional, falls ihr die Entscheidung prüfen wollt.</Text>
            <Button label={showScoreBreakdown ? "Bewertung ausblenden" : "Bewertung anzeigen"} variant="secondary" onPress={() => setShowScoreBreakdown((visible) => !visible)} />
            {showScoreBreakdown
              ? presentation.scoreRows.map((score) => (
                  <Text key={score.id} style={ui.body}>
                    {score.label} · {score.eventTyp}
                    {"\n"}Teilnahme {score.teilnahme} · Stimmen {score.stimmen} · Fairness {score.fairnessAusgleich} · Minderheit {score.minderheitenschutz}
                    {"\n"}Togetherness {score.togetherness} · Wetter {score.wetter} · Machbarkeit {score.machbarkeit} · Rotation {score.rotation} · Verlässlichkeit {score.verlaesslichkeit} · Gesamt {score.gesamt}
                  </Text>
                ))
              : null}
          </Card>

          <Button label="Entscheidung festlegen" onPress={finalize} disabled={saving || decision.mode === "none"} />
          <Text style={ui.muted}>Nur Admins können die wöchentliche Entscheidung endgültig festlegen.</Text>
          <Button label="Teilnahme öffnen" variant="secondary" onPress={() => router.push(`/events/${eventId}/attendance`)} />
          <Button label="Ergebnisse" variant="secondary" onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId } })} />
        </>
      ) : null}
    </Screen>
  );
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
  titleRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  titleText: { flex: 1, minWidth: 0 },
  activityRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  activityText: { flex: 1, minWidth: 0 },
});
