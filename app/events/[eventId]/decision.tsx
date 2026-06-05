import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapRouteButton } from "../../../src/components/MapRouteButton";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import { supabase } from "../../../src/lib/supabase";
import {
  finalizeEventDecision,
  getEventDecisionPreview,
  isCurrentUserAdmin,
  listSportProfilesForSports,
  listSports,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";

export default function DecisionResultScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const [decision, setDecision] = useState<EventDecisionPreview | null>(null);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);
  const presentation = useMemo(() => (decision ? buildDecisionPresentation(decision, sportNames) : null), [decision, sportNames]);

  useEffect(() => {
    void load();
  }, [eventId, user?.id]);

  async function load() {
    setLoading(true);
    const [sportsResult, decisionResult, adminResult] = await Promise.all([
      listSports(supabase),
      getEventDecisionPreview(supabase, { eventId }),
      user ? isCurrentUserAdmin(supabase, user.id) : Promise.resolve({ data: false, error: null }),
    ]);
    const decisionSportIds = decisionResult.data ? [...new Set(decisionResult.data.activities.map((activity) => activity.sportId))] : [];
    const profilesResult = await listSportProfilesForSports(supabase, decisionSportIds);
    setSports(sportsResult.data ?? []);
    setSportProfiles(profilesResult.data ?? []);
    setDecision(decisionResult.data);
    setIsAdmin(Boolean(adminResult.data));
    setError(sportsResult.error?.message ?? decisionResult.error?.message ?? adminResult.error?.message ?? profilesResult.error?.message ?? null);
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
    <Screen title="Entscheidung anzeigen" subtitle="Kurz erklärt, warum diese Woche genau diese Aktivität vorgeschlagen wird.">
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
            <Text style={ui.body}>{presentation.decisionCharacterLabel}</Text>
          </Card>

          <Card>
            <Text style={ui.cardTitle}>Warum diese Entscheidung?</Text>
            <Text style={ui.body}>{presentation.simpleExplanation}</Text>
          </Card>

          {presentation.multiSportExplanation ? (
            <Card>
              <Text style={ui.cardTitle}>{decision.mode === "twin" ? "Getrennte Gruppen" : "Kombiniertes Event"}</Text>
              <Text style={ui.body}>{presentation.multiSportExplanation}</Text>
            </Card>
          ) : null}

          {presentation.noGoSummary && presentation.noGoSummary !== "Keine No-Go-Konflikte." ? (
            <Card>
              <Text style={ui.cardTitle}>No-Gos berücksichtigt</Text>
              <Text style={ui.body}>{presentation.noGoSummary}</Text>
            </Card>
          ) : null}

          {presentation.losingCandidateSummaries.length > 0 ? (
            <Card>
              <Text style={ui.cardTitle}>Warum nicht eine andere Option?</Text>
              {presentation.losingCandidateSummaries.map((summary) => (
                <Text key={summary} style={ui.body}>
                  {summary}
                </Text>
              ))}
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
                      {activity.locationName ? ` · ${activity.locationName}` : ""} · {activity.role === "primary" ? "Hauptaktivität" : "zweite Aktivität"} · {activity.participantCount} Personen
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
                    {"\n"}Togetherness {score.togetherness} · Wetter {score.wetter} · Machbarkeit {score.machbarkeit} · Kapazität {score.standortKapazitaet} · Kosten {score.kosten}
                    {"\n"}Rotation {score.rotation} · Verlässlichkeit {score.verlaesslichkeit} · No-Go-Druck {score.noGoDruck} · Modus {score.modusBonus} · Gesamt {score.gesamt}
                  </Text>
                ))
              : null}
          </Card>

          {isAdmin ? (
            <Card>
              <Text style={ui.cardTitle}>Admin-Explainability</Text>
              <Text style={ui.body}>Zusätzliche Details sind zurückhaltend zusammengefasst und nur für Admins sichtbar.</Text>
              <Button label={showAdminDetails ? "Admin-Details ausblenden" : "Admin-Details anzeigen"} variant="secondary" onPress={() => setShowAdminDetails((visible) => !visible)} />
              {showAdminDetails ? <AdminDecisionDetails decision={decision} sportNames={sportNames} /> : null}
            </Card>
          ) : null}

          <Button label="Entscheidung festlegen" onPress={finalize} disabled={saving || decision.mode === "none" || !isAdmin} />
          <Text style={ui.muted}>Nur Admins können die wöchentliche Entscheidung endgültig festlegen.</Text>
          <Button label="Teilnahme öffnen" variant="secondary" onPress={() => router.push(`/events/${eventId}/attendance`)} />
          <Button label="Ergebnisse" variant="secondary" onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId } })} />
        </>
      ) : null}
    </Screen>
  );
}

function AdminDecisionDetails({ decision, sportNames }: { decision: EventDecisionPreview; sportNames: Map<string, string> }) {
  const voteRows = decision.explainability.voteSummaryBySport.slice(0, 4);
  const fairnessCovered = decision.explainability.fairnessByUser.filter((entry) => entry.coveredByDecision).length;
  const fairnessTotal = decision.explainability.fairnessByUser.length;
  const unresolvedNoGos = decision.noGoBreakdown.unresolved.length;
  const resolvedNoGos = decision.noGoBreakdown.resolvedByAlternative.length;
  const ignoredNoGos = decision.noGoBreakdown.ignoredBecauseNotGoing.length;
  const weatherRows = decision.explainability.weatherReasons.filter((entry) => entry.excluded || entry.reasons.length > 0).slice(0, 3);
  const practicalRows = [
    ...decision.explainability.capacityReasons.map((entry) => entry.reason),
    ...decision.explainability.costReasons.map((entry) => entry.reason),
    ...decision.explainability.practicalityReasons.flatMap((entry) => entry.reasons),
  ].filter(Boolean).slice(0, 4);

  return (
    <View style={styles.adminDetails}>
      {voteRows.length > 0 ? (
        <Text style={ui.body}>
          Stimmen: {voteRows.map((entry) => `${entry.sportName ?? sportNames.get(entry.sportId) ?? entry.sportId}: ${entry.uniqueVoters}`).join(" · ")}
        </Text>
      ) : null}
      <Text style={ui.body}>
        Fairness: {fairnessCovered} von {fairnessTotal} relevanten Einträgen durch die Entscheidung abgedeckt.
      </Text>
      <Text style={ui.body}>
        No-Gos: {resolvedNoGos} gelöst · {unresolvedNoGos} offen · {ignoredNoGos} wegen Nicht-Teilnahme nicht hervorgehoben.
      </Text>
      {weatherRows.map((entry) => (
        <Text key={entry.profileId} style={ui.body}>
          Wetter {entry.profileName ?? entry.profileId}: {entry.excluded ? "ausgeschlossen" : "abgewogen"} · {entry.reasons.slice(0, 2).join(" ")}
        </Text>
      ))}
      {practicalRows.map((reason) => (
        <Text key={reason} style={ui.body}>
          {reason}
        </Text>
      ))}
    </View>
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
  adminDetails: { gap: 8 },
});
