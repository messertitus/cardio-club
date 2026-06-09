import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { MapRouteButton } from "../../../src/components/MapRouteButton";
import {
  AnimatedScoreRow,
  ConnectedSports,
  DecisionResultCard,
  InlineError,
  LoadingSkeleton,
  MccBadge,
  MccBody,
  MccButton,
  MccCard,
  MccCardTitle,
  MccScreen,
  NoGoNotice,
  StatTile,
  WhyNotAccordion,
} from "../../../src/components/MccDesign";
import { SportIcon, SportIconBadge } from "../../../src/components/SportIcon";
import { useAuth } from "../../../src/context/AuthContext";
import { useTheme } from "../../../src/context/ThemeContext";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import type { DecisionCharacter } from "../../../src/lib/fairConstellationSelection";
import { supabase } from "../../../src/lib/supabase";
import { isDecisionReleaseOpen } from "../../../src/services/date";
import {
  canCloseEvent,
  getEventDecisionPreview,
  isCurrentUserAdmin,
  listSportProfilesForSports,
  listSports,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type Tone = "accent" | "success" | "warning" | "danger" | "neutral";

function characterVisual(character: DecisionCharacter): { icon: IconName; tone: Tone } {
  switch (character) {
    case "clear_majority":
      return { icon: "trophy-outline", tone: "success" };
    case "majority_protected":
      return { icon: "shield-check-outline", tone: "success" };
    case "fairness_adjusted":
      return { icon: "scale-balance", tone: "accent" };
    case "practicality_adjusted":
      return { icon: "tools", tone: "warning" };
    case "weather_adjusted":
      return { icon: "weather-partly-cloudy", tone: "warning" };
    case "combined_event":
      return { icon: "vector-combine", tone: "accent" };
    case "split_groups":
      return { icon: "call-split", tone: "accent" };
    case "fallback":
      return { icon: "lightbulb-on-outline", tone: "warning" };
    default:
      return { icon: "help-circle-outline", tone: "neutral" };
  }
}

export default function DecisionResultScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [decision, setDecision] = useState<EventDecisionPreview | null>(null);
  const [event, setEvent] = useState<Pick<Row<"weekly_events">, "status" | "week_start_date" | "event_day"> | null>(null);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [sportProfiles, setSportProfiles] = useState<Row<"sport_profiles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showAdminDetails, setShowAdminDetails] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);
  const presentation = useMemo(() => (decision ? buildDecisionPresentation(decision, sportNames) : null), [decision, sportNames]);

  useEffect(() => {
    void load();
  }, [eventId, user?.id]);

  async function load() {
    setLoading(true);
    const [sportsResult, decisionResult, adminResult, eventResult, manageResult] = await Promise.all([
      listSports(supabase),
      getEventDecisionPreview(supabase, { eventId }),
      user ? isCurrentUserAdmin(supabase, user.id) : Promise.resolve({ data: false, error: null }),
      supabase.from("weekly_events").select("status, week_start_date, event_day").eq("id", eventId).single(),
      user ? canCloseEvent(supabase, eventId, user.id) : Promise.resolve({ data: false, error: null }),
    ]);
    const decisionSportIds = decisionResult.data ? [...new Set(decisionResult.data.activities.map((activity) => activity.sportId))] : [];
    const profilesResult = await listSportProfilesForSports(supabase, decisionSportIds);
    setSports(sportsResult.data ?? []);
    setSportProfiles(profilesResult.data ?? []);
    setEvent(eventResult.data ?? null);
    setDecision(decisionResult.data);
    setIsAdmin(Boolean(adminResult.data));
    setCanManage(Boolean(manageResult.data));
    setError(sportsResult.error?.message ?? decisionResult.error?.message ?? adminResult.error?.message ?? eventResult.error?.message ?? profilesResult.error?.message ?? null);
    setLoading(false);
  }

  const released = Boolean(event && isDecisionReleaseOpen(event.week_start_date, event.event_day));
  const showDecision = Boolean(decision && presentation && (isAdmin || !event || released));
  const primarySport = decision ? sports.find((sport) => sport.id === decision.selectedSportId) : undefined;
  const secondarySport = decision?.secondarySportId ? sports.find((sport) => sport.id === decision.secondarySportId) : undefined;
  const isMulti = decision?.mode === "multi_sport" || decision?.mode === "twin";
  const visual = decision ? characterVisual(decision.decisionCharacter) : characterVisual("no_valid_decision");
  const maxTotal = useMemo(
    () => (presentation ? Math.max(0, ...presentation.scoreRows.map((row) => row.gesamt)) : 0),
    [presentation],
  );

  return (
    <MccScreen title="Entscheidung" kicker="Result" subtitle="Der Club entscheidet automatisch und fair — hier siehst du, warum.">
      <InlineError>{error}</InlineError>
      {loading ? <LoadingSkeleton lines={4} /> : null}

      {!loading && event && !isAdmin && !released ? (
        <MccCard accent>
          <MccBadge icon="calendar-clock-outline">Donnerstag</MccBadge>
          <MccCardTitle>Die Auswertung ist noch zu</MccCardTitle>
          <MccBody muted>Montag bis Mittwoch ist Zeit für Teilnahme und Abstimmung. Am Donnerstag erscheint hier automatisch die Entscheidung.</MccBody>
          <MccButton label="Zur Abstimmung" icon="vote-outline" variant="secondary" onPress={() => router.push(`/events/${eventId}/vote`)} />
        </MccCard>
      ) : null}

      {showDecision && decision && presentation ? (
        <>
          <DecisionResultCard
            title={presentation.selectedSportName}
            subtitle={isMulti && presentation.secondarySportName ? `+ ${presentation.secondarySportName}` : undefined}
            icon={<SportIconBadge sport={primarySport} size={54} />}
          >
            <View style={styles.heroBadges}>
              <MccBadge tone={visual.tone} icon={visual.icon}>
                {presentation.decisionCharacterLabel}
              </MccBadge>
              {presentation.resultLabels
                .filter((label) => label !== presentation.decisionCharacterLabel)
                .slice(0, 3)
                .map((label) => (
                  <MccBadge key={label} tone="neutral">
                    {label}
                  </MccBadge>
                ))}
            </View>
            {isMulti && presentation.secondarySportName ? (
              <ConnectedSports
                mode={decision.mode === "twin" ? "twin" : "multi_sport"}
                primary={{ name: presentation.selectedSportName, icon: <SportIcon sport={primarySport} size={22} /> }}
                secondary={{ name: presentation.secondarySportName, icon: <SportIcon sport={secondarySport} size={22} /> }}
              />
            ) : null}
            <MccBody muted>{presentation.simpleExplanation}</MccBody>
          </DecisionResultCard>

          {presentation.multiSportExplanation ? (
            <MccCard>
              <MccBadge icon={decision.mode === "twin" ? "call-split" : "vector-combine"}>{decision.mode === "twin" ? "Getrennte Gruppen" : "Kombiniertes Event"}</MccBadge>
              <MccBody muted>{presentation.multiSportExplanation}</MccBody>
            </MccCard>
          ) : null}

          {presentation.activityRows.length > 0 ? (
            <View style={styles.activityStack}>
              <MccCardTitle>Konkrete Aktivitäten</MccCardTitle>
              {presentation.activityRows.map((activity) => {
                const profile = sportProfiles.find((entry) => entry.id === activity.profileId);
                const sport = sports.find((entry) => entry.id === activity.sportId);
                const notes = [...(activity.weatherNotes ?? []).slice(0, 1), ...(activity.practicalityNotes ?? []).slice(0, 1)];
                return (
                  <MccCard key={activity.profileId}>
                    <View style={styles.activityHead}>
                      <SportIconBadge sport={sport} size={40} />
                      <View style={styles.activityHeadText}>
                        <MccCardTitle>{activity.sportName}</MccCardTitle>
                        <MccBody muted>{activity.profileName}</MccBody>
                      </View>
                      <MccBadge tone={activity.role === "primary" ? "accent" : "neutral"}>
                        {activity.role === "primary" ? "Hauptaktivität" : "Zweite Aktivität"}
                      </MccBadge>
                    </View>
                    <View style={styles.activityMeta}>
                      <MccBadge tone="neutral" icon="account-group-outline">
                        {activity.participantCount} Personen
                      </MccBadge>
                      {activity.locationName ? (
                        <MccBadge tone="neutral" icon="map-marker-outline">
                          {activity.locationName}
                        </MccBadge>
                      ) : null}
                      {activity.activityContactId ? (
                        <MccBadge tone="success" icon="account-tie-outline">
                          AP hinterlegt
                        </MccBadge>
                      ) : null}
                    </View>
                    {notes.length > 0 ? (
                      <View style={styles.activityNotes}>
                        {notes.map((note) => (
                          <MccBody key={note} muted style={styles.activityNote}>
                            {note}
                          </MccBody>
                        ))}
                      </View>
                    ) : null}
                    <MapRouteButton target={profile ? profileMapTarget(profile) : activity.locationName ? { label: activity.locationName } : null} compact />
                  </MccCard>
                );
              })}
            </View>
          ) : null}

          <WhyNotAccordion title="Warum diese Entscheidung?" initiallyOpen>
            <MccBody muted>{presentation.simpleExplanation}</MccBody>
            {presentation.noGoSummary && presentation.noGoSummary !== "Keine No-Go-Konflikte." ? (
              <NoGoNotice>{presentation.noGoSummary}</NoGoNotice>
            ) : null}
          </WhyNotAccordion>

          {presentation.losingCandidateSummaries.length > 0 ? (
            <WhyNotAccordion title="Warum nicht eine andere Option?">
              {presentation.losingCandidateSummaries.map((summary) => (
                <View key={summary} style={styles.losingRow}>
                  <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.mcc.textMuted} style={styles.losingIcon} />
                  <MccBody muted style={styles.losingText}>
                    {summary}
                  </MccBody>
                </View>
              ))}
            </WhyNotAccordion>
          ) : null}

          {presentation.scoreRows.length > 0 ? (
            <MccCard>
              <MccCardTitle>Bewertung der Optionen</MccCardTitle>
              <MccBody muted>Relativer Gesamtwert im Vergleich zur stärksten Option – optional, falls ihr die Entscheidung nachvollziehen wollt.</MccBody>
              <MccButton
                label={showScoreBreakdown ? "Bewertung ausblenden" : "Bewertung anzeigen"}
                variant="secondary"
                icon={showScoreBreakdown ? "chevron-up" : "chevron-down"}
                onPress={() => setShowScoreBreakdown((visible) => !visible)}
              />
              {showScoreBreakdown
                ? presentation.scoreRows.slice(0, 5).map((score) => (
                    <AnimatedScoreRow
                      key={score.id}
                      label={score.label}
                      value={String(maxTotal > 0 ? Math.round((score.gesamt / maxTotal) * 100) : 0)}
                      detail={`${score.eventTyp} · Gesamtwert ${score.gesamt}`}
                    />
                  ))
                : null}
            </MccCard>
          ) : null}

          {isAdmin ? (
            <MccCard>
              <MccBadge tone="warning" icon="shield-account-outline">
                Admin
              </MccBadge>
              <MccCardTitle>Admin-Explainability</MccCardTitle>
              <MccBody muted>Zusätzliche Details sind zurückhaltend zusammengefasst und nur für Admins sichtbar.</MccBody>
              <MccButton
                label={showAdminDetails ? "Admin-Details ausblenden" : "Admin-Details anzeigen"}
                variant="secondary"
                icon={showAdminDetails ? "chevron-up" : "chevron-down"}
                onPress={() => setShowAdminDetails((visible) => !visible)}
              />
              {showAdminDetails ? <AdminDecisionDetails decision={decision} sportNames={sportNames} /> : null}
            </MccCard>
          ) : null}

          {canManage ? (
            <MccCard>
              <MccBadge tone="accent" icon="shield-account-outline">
                Verwaltung
              </MccBadge>
              <MccCardTitle>Nach dem Event</MccCardTitle>
              <MccBody muted>Anwesenheit und Ergebnisse eintragen — danach das Event abschließen. Nur für Admins, Moderatoren und Ansprechpartner.</MccBody>
              <MccButton label="Anwesenheit eintragen" icon="account-check-outline" variant="secondary" onPress={() => router.push({ pathname: "/events/[eventId]/attendance", params: { eventId } })} />
              <MccButton label="Ergebnisse eintragen" icon="trophy-outline" variant="secondary" onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId } })} />
              {event?.status !== "completed" ? (
                <MccButton label="Event abschließen" icon="lock-check-outline" onPress={() => router.push({ pathname: "/events/[eventId]/close", params: { eventId } })} />
              ) : null}
            </MccCard>
          ) : null}
        </>
      ) : null}
    </MccScreen>
  );
}

function AdminDecisionDetails({ decision, sportNames }: { decision: EventDecisionPreview; sportNames: Map<string, string> }) {
  const { theme } = useTheme();
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
  ]
    .filter(Boolean)
    .slice(0, 4);

  return (
    <View style={styles.adminDetails}>
      {voteRows.length > 0 ? (
        <View style={styles.adminStatGrid}>
          {voteRows.map((entry) => (
            <StatTile
              key={entry.sportId}
              label={entry.sportName ?? sportNames.get(entry.sportId) ?? entry.sportId}
              value={`${entry.uniqueVoters} Stimmen`}
              icon="vote-outline"
              tone="accent"
            />
          ))}
        </View>
      ) : null}
      <MccBody muted>
        Fairness: {fairnessCovered} von {fairnessTotal} relevanten Einträgen durch die Entscheidung abgedeckt.
      </MccBody>
      <MccBody muted>
        No-Gos: {resolvedNoGos} gelöst · {unresolvedNoGos} offen · {ignoredNoGos} wegen Nicht-Teilnahme nicht hervorgehoben.
      </MccBody>
      {weatherRows.map((entry) => (
        <MccBody key={entry.profileId} muted style={{ color: theme.mcc.textSecondary }}>
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
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activityStack: { gap: 12 },
  activityHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  activityHeadText: { flex: 1, minWidth: 0 },
  activityMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activityNotes: { gap: 4 },
  activityNote: { fontSize: 13 },
  losingRow: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  losingIcon: { marginTop: 3, opacity: 0.6 },
  losingText: { flex: 1, minWidth: 0 },
  adminDetails: { gap: 10 },
  adminStatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
