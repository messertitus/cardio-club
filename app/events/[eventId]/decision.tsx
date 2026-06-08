import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { MapRouteButton } from "../../../src/components/MapRouteButton";
import {
  DecisionResultCard,
  MccBadge,
  MccBody,
  MccButton,
  MccCard,
  MccCardTitle,
  MccScreen,
  NoGoNotice,
  WhyNotAccordion,
} from "../../../src/components/MccDesign";
import { SportIconBadge } from "../../../src/components/SportIcon";
import { ErrorText, LoadingState } from "../../../src/components/ui";
import { useAuth } from "../../../src/context/AuthContext";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import { supabase } from "../../../src/lib/supabase";
import { isDecisionReleaseOpen } from "../../../src/services/date";
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
  const [event, setEvent] = useState<Pick<Row<"weekly_events">, "status" | "week_start_date"> | null>(null);
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
    const [sportsResult, decisionResult, adminResult, eventResult] = await Promise.all([
      listSports(supabase),
      getEventDecisionPreview(supabase, { eventId }),
      user ? isCurrentUserAdmin(supabase, user.id) : Promise.resolve({ data: false, error: null }),
      supabase.from("weekly_events").select("status, week_start_date").eq("id", eventId).single(),
    ]);
    const decisionSportIds = decisionResult.data ? [...new Set(decisionResult.data.activities.map((activity) => activity.sportId))] : [];
    const profilesResult = await listSportProfilesForSports(supabase, decisionSportIds);
    setSports(sportsResult.data ?? []);
    setSportProfiles(profilesResult.data ?? []);
    setEvent(eventResult.data ?? null);
    setDecision(decisionResult.data);
    setIsAdmin(Boolean(adminResult.data));
    setError(sportsResult.error?.message ?? decisionResult.error?.message ?? adminResult.error?.message ?? eventResult.error?.message ?? profilesResult.error?.message ?? null);
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
    <MccScreen title="Entscheidung anzeigen" kicker="Result" subtitle="Kurz erklaert, warum diese Woche genau diese Aktivitaet vorgeschlagen wird.">
      <ErrorText>{error}</ErrorText>
      {loading ? <LoadingState /> : null}
      {event && !isAdmin && !isDecisionReleaseOpen(event.week_start_date) ? (
        <MccCard accent>
          <MccBadge icon="calendar-clock-outline">Donnerstag</MccBadge>
          <MccCardTitle>Die Auswertung ist noch zu</MccCardTitle>
          <MccBody muted>Montag bis Mittwoch ist Zeit fuer Teilnahme und Abstimmung. Am Donnerstag erscheint hier automatisch die Entscheidung.</MccBody>
          <MccButton label="Zur Abstimmung" icon="vote-outline" variant="secondary" onPress={() => router.push(`/events/${eventId}/vote`)} />
        </MccCard>
      ) : null}
      {decision && presentation && (isAdmin || !event || isDecisionReleaseOpen(event.week_start_date)) ? (
        <>
          <DecisionResultCard
            title={presentation.selectedSportName}
            subtitle={presentation.secondarySportName ? `+ ${presentation.secondarySportName}` : presentation.decisionCharacterLabel}
            labels={presentation.resultLabels}
            icon={<SportIconBadge sport={sports.find((sport) => sport.id === decision.selectedSportId)} size={54} />}
          >
            <MccBody muted>{presentation.decisionCharacterLabel}</MccBody>
          </DecisionResultCard>

          <WhyNotAccordion title="Warum diese Entscheidung?" initiallyOpen>
            <MccBody muted>{presentation.simpleExplanation}</MccBody>
          </WhyNotAccordion>

          {presentation.multiSportExplanation ? (
            <MccCard>
              <MccBadge icon={decision.mode === "twin" ? "call-split" : "vector-combine"}>{decision.mode === "twin" ? "Twin" : "Multi-Sport"}</MccBadge>
              <MccCardTitle>{decision.mode === "twin" ? "Getrennte Gruppen" : "Kombiniertes Event"}</MccCardTitle>
              <MccBody muted>{presentation.multiSportExplanation}</MccBody>
            </MccCard>
          ) : null}

          {presentation.noGoSummary && presentation.noGoSummary !== "Keine No-Go-Konflikte." ? (
            <NoGoNotice>{presentation.noGoSummary}</NoGoNotice>
          ) : null}

          {presentation.losingCandidateSummaries.length > 0 ? (
            <WhyNotAccordion title="Warum nicht eine andere Option?">
              {presentation.losingCandidateSummaries.map((summary) => (
                <MccBody key={summary} muted>
                  {summary}
                </MccBody>
              ))}
            </WhyNotAccordion>
          ) : null}

          {presentation.activityRows.length > 0 ? (
            <MccCard>
              <MccCardTitle>Konkrete Aktivitäten</MccCardTitle>
              {presentation.activityRows.map((activity) => {
                const profile = sportProfiles.find((entry) => entry.id === activity.profileId);
                return (
                  <View key={activity.profileId} style={styles.activityRow}>
                    <MccBody style={styles.activityText}>
                      {activity.sportName}: {activity.profileName}
                      {activity.locationName ? ` · ${activity.locationName}` : ""} · {activity.role === "primary" ? "Hauptaktivität" : "zweite Aktivität"} · {activity.participantCount} Personen
                      {activity.activityContactId ? " · AP hinterlegt" : ""}
                      {(activity.weatherNotes ?? []).length > 0 ? `\nWetter: ${(activity.weatherNotes ?? []).slice(0, 2).join(" ")}` : ""}
                      {(activity.practicalityNotes ?? []).length > 0 ? `\nMachbarkeit: ${(activity.practicalityNotes ?? []).slice(0, 2).join(" ")}` : ""}
                    </MccBody>
                    <MapRouteButton target={profile ? profileMapTarget(profile) : activity.locationName ? { label: activity.locationName } : null} compact />
                  </View>
                );
              })}
            </MccCard>
          ) : null}

          <MccCard>
            <MccCardTitle>Details</MccCardTitle>
            <MccBody muted>Die genaue Bewertung ist optional, falls ihr die Entscheidung pruefen wollt.</MccBody>
            <MccButton label={showScoreBreakdown ? "Bewertung ausblenden" : "Bewertung anzeigen"} variant="secondary" onPress={() => setShowScoreBreakdown((visible) => !visible)} />
            {showScoreBreakdown
              ? presentation.scoreRows.map((score) => (
                  <MccBody key={score.id} muted>
                    {score.label} · {score.eventTyp}
                    {"\n"}Teilnahme {score.teilnahme} · Stimmen {score.stimmen} · Fairness {score.fairnessAusgleich} · Minderheit {score.minderheitenschutz}
                    {"\n"}Togetherness {score.togetherness} · Wetter {score.wetter} · Machbarkeit {score.machbarkeit} · Kapazität {score.standortKapazitaet} · Kosten {score.kosten}
                    {"\n"}Rotation {score.rotation} · Verlässlichkeit {score.verlaesslichkeit} · No-Go-Druck {score.noGoDruck} · Modus {score.modusBonus} · Gesamt {score.gesamt}
                  </MccBody>
                ))
              : null}
          </MccCard>

          {isAdmin ? (
            <MccCard>
              <MccCardTitle>Admin-Explainability</MccCardTitle>
              <MccBody muted>Zusätzliche Details sind zurückhaltend zusammengefasst und nur für Admins sichtbar.</MccBody>
              <MccButton label={showAdminDetails ? "Admin-Details ausblenden" : "Admin-Details anzeigen"} variant="secondary" onPress={() => setShowAdminDetails((visible) => !visible)} />
              {showAdminDetails ? <AdminDecisionDetails decision={decision} sportNames={sportNames} /> : null}
            </MccCard>
          ) : null}

          <MccButton label="Entscheidung festlegen" icon="check-decagram-outline" onPress={finalize} disabled={saving || decision.mode === "none" || !isAdmin} />
          <MccBody muted>Nur Admins können die wöchentliche Entscheidung endgültig festlegen.</MccBody>
          <MccButton label="Teilnahme öffnen" icon="account-group-outline" variant="secondary" onPress={() => router.push(`/events/${eventId}/attendance`)} />
          <MccButton label="Ergebnisse" icon="trophy-outline" variant="secondary" onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId } })} />
        </>
      ) : null}
    </MccScreen>
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
        <MccBody muted>
          Stimmen: {voteRows.map((entry) => `${entry.sportName ?? sportNames.get(entry.sportId) ?? entry.sportId}: ${entry.uniqueVoters}`).join(" · ")}
        </MccBody>
      ) : null}
      <MccBody muted>
        Fairness: {fairnessCovered} von {fairnessTotal} relevanten Einträgen durch die Entscheidung abgedeckt.
      </MccBody>
      <MccBody muted>
        No-Gos: {resolvedNoGos} gelöst · {unresolvedNoGos} offen · {ignoredNoGos} wegen Nicht-Teilnahme nicht hervorgehoben.
      </MccBody>
      {weatherRows.map((entry) => (
        <MccBody key={entry.profileId} muted>
          Wetter {entry.profileName ?? entry.profileId}: {entry.excluded ? "ausgeschlossen" : "abgewogen"} · {entry.reasons.slice(0, 2).join(" ")}
        </MccBody>
      ))}
      {practicalRows.map((reason) => (
        <MccBody key={reason} muted>
          {reason}
        </MccBody>
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
  activityRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  activityText: { flex: 1, minWidth: 0 },
  adminDetails: { gap: 8 },
});
