import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Text } from "react-native";
import { Button, Card, ErrorText, LoadingState, Pill, Screen, ui } from "../../../src/components/ui";
import { buildDecisionPresentation } from "../../../src/lib/decisionPresentation";
import { supabase } from "../../../src/lib/supabase";
import {
  createSubgroupsFromDecision,
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

  const sportsById = useMemo(() => new Map(sports.map((sport) => [sport.id, sport])), [sports]);
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

    if (!result.error && result.data.decision.mode === "subgroups") {
      await createSubgroupsFromDecision(supabase, {
        eventId,
        decision: result.data.decision,
      });
    }

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
            <Text style={ui.body}>Die Sportart von letzter Woche wurde dabei nicht erneut zugelassen.</Text>
          </Card>

          {decision.mode === "combined" ? (
            <Card>
              <Text style={ui.cardTitle}>Gemeinsamer Cardiotag</Text>
              <Text style={ui.body}>Beide Sportarten haben starken Rückhalt und passen als gemeinsamer Plan zusammen.</Text>
            </Card>
          ) : null}

          {decision.mode === "subgroups" ? (
            <Card>
              <Text style={ui.cardTitle}>Untergruppen</Text>
              <Text style={ui.body}>Die Unterstützung ist klar geteilt. Die App empfiehlt getrennte Gruppen statt einen faulen Kompromiss.</Text>
              {decision.subgroups?.map((group) => (
                <Text key={group.sportId} style={ui.body}>
                  {sportsById.get(group.sportId)?.name ?? group.sportId}: {group.userIds.length} Personen
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
                  <Card key={score.sportId}>
                    <Text style={ui.cardTitle}>{score.sportName}</Text>
                    <Text style={ui.body}>Stimmen: {score.stimmen}</Text>
                    <Text style={ui.body}>Fairness-Ausgleich: {score.fairnessAusgleich}</Text>
                    <Text style={ui.body}>Abwechslung: {score.abwechslung}</Text>
                    <Text style={ui.body}>Wiederholungsabzug: {score.wiederholungsabzug}</Text>
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
