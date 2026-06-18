import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
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
import type { DecisionCharacter } from "../../../src/lib/decisionTypes";
import type { DecisionAdminSummary } from "../../../src/lib/decisionView";
import { supabase } from "../../../src/lib/supabase";
import {
  canCloseEvent,
  getEventDecisionPreview,
  isCurrentUserAdmin,
  listSportProfilesForSports,
  listSports,
  SCREEN_EVENTS,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";
import { useScreenView } from "../../../src/components/useScreenView";

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
  useScreenView(SCREEN_EVENTS.decision);
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

  // The decision now arrives from the server already sanitized and presentation-ready.
  const presentation = decision;

  useEffect(() => {
    void load();
  }, [eventId, user?.id]);

  async function load() {
    setLoading(true);
    const [sportsResult, adminResult, eventResult, manageResult] = await Promise.all([
      listSports(supabase),
      user ? isCurrentUserAdmin(supabase, user.id) : Promise.resolve({ data: false, error: null }),
      supabase.from("weekly_events").select("status, week_start_date, event_day").eq("id", eventId).single(),
      user ? canCloseEvent(supabase, eventId, user.id) : Promise.resolve({ data: false, error: null }),
    ]);

    // No live preview: the decision is shown only once it has actually been
    // finalized (status decided/completed). For a decided event the recompute uses
    // the frozen weather_snapshot, so it is deterministic and identical everywhere.
    const decided = eventResult.data?.status === "decided" || eventResult.data?.status === "completed";
    let decisionData: EventDecisionPreview | null = null;
    let decisionErrorMessage: string | null = null;
    let profileRows: Row<"sport_profiles">[] = [];
    if (decided) {
      const decisionResult = await getEventDecisionPreview(supabase, { eventId });
      decisionData = decisionResult.data;
      decisionErrorMessage = decisionResult.error?.message ?? null;
      const decisionSportIds = decisionData ? [...new Set(decisionData.activities.map((activity) => activity.sportId))] : [];
      const profilesResult = await listSportProfilesForSports(supabase, decisionSportIds);
      profileRows = profilesResult.data ?? [];
      decisionErrorMessage = decisionErrorMessage ?? profilesResult.error?.message ?? null;
    }

    setSports(sportsResult.data ?? []);
    setSportProfiles(profileRows);
    setEvent(eventResult.data ?? null);
    setDecision(decisionData);
    setIsAdmin(Boolean(adminResult.data));
    setCanManage(Boolean(manageResult.data));
    setError(sportsResult.error?.message ?? decisionErrorMessage ?? adminResult.error?.message ?? eventResult.error?.message ?? null);
    setLoading(false);
  }

  const decided = Boolean(event && (event.status === "decided" || event.status === "completed"));
  const showDecision = Boolean(decided && decision && presentation);
  const primarySport = decision ? sports.find((sport) => sport.id === decision.selectedSportId) : undefined;
  const secondarySport = decision?.secondarySportId ? sports.find((sport) => sport.id === decision.secondarySportId) : undefined;
  const isMulti = decision?.mode === "multi_sport" || decision?.mode === "twin";
  const visual = decision ? characterVisual(decision.decisionCharacter) : characterVisual("no_valid_decision");

  return (
    <MccScreen title="Entscheidung" kicker="Result" subtitle="Der Club entscheidet automatisch und fair — hier siehst du, warum.">
      <InlineError>{error}</InlineError>
      {loading ? <LoadingSkeleton lines={4} /> : null}

      {!loading && event && !decided ? (
        <MccCard accent>
          <MccBadge icon="calendar-clock-outline">Auswertung folgt</MccBadge>
          <MccCardTitle>Die Auswertung ist noch zu</MccCardTitle>
          <MccBody muted>Es wird abgestimmt, bis kurz vor dem Cardiotag. Der Algorithmus läuft einmal 48 Stunden vor dem Event und legt die Sport-Konstellation fest – dann erscheint hier automatisch die Entscheidung.</MccBody>
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

          {presentation.activities.length > 0 ? (
            <View style={styles.activityStack}>
              <MccCardTitle>Konkrete Aktivitäten</MccCardTitle>
              {presentation.activities.map((activity) => {
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

          {presentation.scoreComparison.length > 0 ? (
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
                ? presentation.scoreComparison.map((score) => (
                    <AnimatedScoreRow
                      key={score.id}
                      label={score.label}
                      value={String(score.relativePercent)}
                      detail={score.eventTyp}
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
              {showAdminDetails && decision.admin ? <AdminDecisionDetails admin={decision.admin} /> : null}
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

// Admin explainability is summarized on the server (counts + short notes only —
// no weights, fairness-debt or score formulas) and arrives via DecisionView.admin.
function AdminDecisionDetails({ admin }: { admin: DecisionAdminSummary }) {
  const { theme } = useTheme();

  return (
    <View style={styles.adminDetails}>
      {admin.voteSummaries.length > 0 ? (
        <View style={styles.adminStatGrid}>
          {admin.voteSummaries.map((entry) => (
            <StatTile key={entry.sportName} label={entry.sportName} value={`${entry.voters} Stimmen`} icon="vote-outline" tone="accent" />
          ))}
        </View>
      ) : null}
      <MccBody muted>
        Fairness: {admin.fairnessCovered} von {admin.fairnessTotal} relevanten Einträgen durch die Entscheidung abgedeckt.
      </MccBody>
      <MccBody muted>
        No-Gos: {admin.noGosResolved} gelöst · {admin.noGosUnresolved} offen · {admin.noGosIgnored} wegen Nicht-Teilnahme nicht hervorgehoben.
      </MccBody>
      {admin.weatherNotes.map((note) => (
        <MccBody key={note} muted style={{ color: theme.mcc.textSecondary }}>
          {note}
        </MccBody>
      ))}
      {admin.practicalNotes.map((reason) => (
        <MccBody key={reason} muted>
          {reason}
        </MccBody>
      ))}
      {admin.scoreRows.length > 0 ? (
        <View style={styles.adminScorecard}>
          <MccCardTitle>Scorecard (Testphase)</MccCardTitle>
          <MccBody muted>Vollständige Bewertung pro Option – nur für Admins sichtbar.</MccBody>
          {admin.scoreRows.map((row) => (
            <View key={row.id} style={styles.adminScoreRow}>
              <MccBody style={styles.adminScoreLabel}>
                {row.label} · {row.eventTyp} · Gesamt {round2(row.gesamt)}
              </MccBody>
              <MccBody muted style={styles.adminScoreDetail}>
                Teilnahme {round2(row.teilnahme)} · Stimmen {round2(row.stimmen)} · Fairness {round2(row.fairnessAusgleich)} · Minderheit{" "}
                {round2(row.minderheitenschutz)} · Gemeinsam {round2(row.togetherness)} · Wetter {round2(row.wetter)} · Machbarkeit{" "}
                {round2(row.machbarkeit)} · Kapazität {round2(row.standortKapazitaet)} · Kosten {round2(row.kosten)} · Rotation{" "}
                {round2(row.rotation)} · Verlässlichkeit {round2(row.verlaesslichkeit)} · No-Go {round2(row.noGoDruck)} · Modus{" "}
                {round2(row.modusBonus)}
              </MccBody>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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
  adminScorecard: { gap: 8, marginTop: 4 },
  adminScoreRow: { gap: 2 },
  adminScoreLabel: { fontWeight: "700" },
  adminScoreDetail: { fontSize: 12 },
});
