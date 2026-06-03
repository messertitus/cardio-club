import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import { supabase } from "../../../src/lib/supabase";
import {
  finalizeEventDecision,
  getEventDecisionPreview,
  listSports,
  type EventDecisionPreview,
  type Row,
} from "../../../src/services";

export default function DecisionResultScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [decision, setDecision] = useState<EventDecisionPreview | null>(null);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);
  const presentation = useMemo(
    () => (decision ? buildDecisionPresentation(decision, sportNames) : null),
    [decision, sportNames],
  );

  useEffect(() => {
    load();
  }, [eventId]);

  async function load() {
    setLoading(true);
    const [sportsResult, decisionResult] = await Promise.all([
      listSports(supabase),
      getEventDecisionPreview(supabase, { eventId }),
    ]);
    setSports(sportsResult.data ?? []);
    setDecision(decisionResult.data);
    setError(sportsResult.error?.message ?? decisionResult.error?.message ?? null);
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
            <Text style={ui.title}>{presentation.selectedSportName}</Text>
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
              {presentation.activityRows.map((activity) => (
                <Text key={activity.profileId} style={ui.body}>
                  {activity.sportName}: {activity.profileName}
                  {activity.locationName ? ` · ${activity.locationName}` : ""} · {activity.participantCount} Personen
                </Text>
              ))}
            </Card>
          ) : null}

          <Card>
            <Text style={ui.cardTitle}>Details</Text>
            <Text style={ui.body}>Die genaue Bewertung ist optional, falls ihr die Entscheidung prüfen wollt.</Text>
            <Button
              label={showScoreBreakdown ? "Bewertung ausblenden" : "Bewertung anzeigen"}
              variant="secondary"
              onPress={() => setShowScoreBreakdown((visible) => !visible)}
            />
            {showScoreBreakdown
              ? presentation.scoreRows.map((score) => (
                  <Card key={score.id}>
                    <Text style={ui.cardTitle}>{score.label}</Text>
                    <Text style={ui.body}>Typ: {score.eventTyp}</Text>
                    <Text style={ui.body}>Teilnahme: {score.teilnahme}</Text>
                    <Text style={ui.body}>Stimmen: {score.stimmen}</Text>
                    <Text style={ui.body}>Fairness-Ausgleich: {score.fairnessAusgleich}</Text>
                    <Text style={ui.body}>Minderheitenschutz: {score.minderheitenschutz}</Text>
                    <Text style={ui.body}>Togetherness: {score.togetherness}</Text>
                    <Text style={ui.body}>Wetter: {score.wetter}</Text>
                    <Text style={ui.body}>Machbarkeit: {score.machbarkeit}</Text>
                    <Text style={ui.body}>Rotation: {score.rotation}</Text>
                    <Text style={ui.body}>Verlässlichkeit: {score.verlaesslichkeit}</Text>
                    <Text style={ui.body}>Gesamt: {score.gesamt}</Text>
                  </Card>
                ))
              : null}
          </Card>

          <Button label="Entscheidung festlegen" onPress={finalize} disabled={saving || decision.mode === "none"} />
          <Text style={ui.muted}>Nur Admins können die wöchentliche Entscheidung endgültig festlegen.</Text>
          <Button label="Teilnahme öffnen" variant="secondary" onPress={() => router.push(`/events/${eventId}/attendance`)} />
        </>
      ) : null}
    </Screen>
  );
}
