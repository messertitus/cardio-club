import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  InlineError,
  LoadingSkeleton,
  MccBadge,
  MccBody,
  MccButton,
  MccCard,
  MccCardTitle,
  MccScreen,
  SuccessFlash,
} from "../../../src/components/MccDesign";
import { useAuth } from "../../../src/context/AuthContext";
import { useTheme } from "../../../src/context/ThemeContext";
import { supabase } from "../../../src/lib/supabase";
import {
  canCloseEvent,
  closeWeeklyEvent,
  getEventCloseReadiness,
  type EventCloseReadiness,
  type Row,
} from "../../../src/services";

export default function CloseEventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { loading, user } = useAuth();
  const [event, setEvent] = useState<Pick<Row<"weekly_events">, "status" | "starts_at"> | null>(null);
  const [readiness, setReadiness] = useState<EventCloseReadiness | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(0);

  useEffect(() => {
    void load();
  }, [eventId, user?.id]);

  async function load() {
    if (!user) return;
    setBusy(true);
    const [eventResult, readinessResult, allowedResult] = await Promise.all([
      supabase.from("weekly_events").select("status, starts_at").eq("id", eventId).single(),
      getEventCloseReadiness(supabase, eventId),
      canCloseEvent(supabase, eventId, user.id),
    ]);
    setEvent(eventResult.data ?? null);
    setReadiness(readinessResult.data);
    setAllowed(Boolean(allowedResult.data));
    setError(eventResult.error?.message ?? readinessResult.error?.message ?? allowedResult.error?.message ?? null);
    setBusy(false);
  }

  async function close() {
    setSaving(true);
    const result = await closeWeeklyEvent(supabase, eventId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setError(null);
    setSavedFlash((value) => value + 1);
    await load();
  }

  if (loading)
    return (
      <MccScreen>
        <LoadingSkeleton lines={4} />
      </MccScreen>
    );
  if (!user) return <Redirect href="/auth" />;

  const completed = event?.status === "completed";

  return (
    <MccScreen title="Event abschließen" kicker="Wrap-up" subtitle="Trag Ergebnisse und Anwesenheit ein. Erst danach kann das Event geschlossen und die nächste Woche freigegeben werden.">
      <SuccessFlash trigger={savedFlash} label="Event abgeschlossen" />
      <InlineError>{error}</InlineError>
      {busy ? <LoadingSkeleton lines={3} /> : null}

      {!busy && completed ? (
        <MccCard accent>
          <MccBadge tone="success" icon="check-decagram">
            Abgeschlossen
          </MccBadge>
          <MccCardTitle>Dieses Event ist abgeschlossen</MccCardTitle>
          <MccBody muted>Die nächste Cardiowoche kann jetzt starten.</MccBody>
          <MccButton label="Zur Übersicht" icon="home-outline" variant="secondary" onPress={() => router.replace("/")} />
        </MccCard>
      ) : null}

      {!busy && !completed ? (
        <>
          <ChecklistItem
            done={Boolean(readiness?.hasResults)}
            title="Ergebnisse eingetragen"
            body="Mindestens ein Ergebnis oder Kurzbericht ist gespeichert."
            actionLabel="Ergebnisse eintragen"
            onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId } })}
          />
          <ChecklistItem
            done={Boolean(readiness?.attendanceReviewed)}
            title="Anwesenheit geprüft"
            body="Für alle Teilnehmenden (Dabei/Vielleicht) ist die tatsächliche Anwesenheit erfasst."
            actionLabel="Anwesenheit prüfen"
            onPress={() => router.push({ pathname: "/events/[eventId]/attendance", params: { eventId } })}
          />

          <MccCard accent>
            <MccCardTitle>Abschließen</MccCardTitle>
            {!allowed ? (
              <MccBody muted>Nur Admins oder der Ansprechpartner vor Ort können das Event abschließen.</MccBody>
            ) : readiness?.canClose ? (
              <MccBody muted>Alles erledigt. Du kannst das Event jetzt abschließen.</MccBody>
            ) : (
              <MccBody muted>Ergebnisse und Anwesenheit müssen vollständig sein, bevor du abschließen kannst.</MccBody>
            )}
            <MccButton
              label="Event abschließen"
              icon="lock-check-outline"
              onPress={close}
              disabled={saving || !allowed || !readiness?.canClose}
            />
          </MccCard>
        </>
      ) : null}
    </MccScreen>
  );
}

function ChecklistItem({
  done,
  title,
  body,
  actionLabel,
  onPress,
}: {
  done: boolean;
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <MccCard>
      <View style={styles.row}>
        <View style={[styles.check, { backgroundColor: done ? theme.mcc.accentFaint : theme.mcc.surfaceSoft, borderColor: done ? theme.mcc.accent : theme.mcc.line }]}>
          <MaterialCommunityIcons name={done ? "check" : "circle-outline"} size={20} color={done ? theme.mcc.success : theme.mcc.textMuted} />
        </View>
        <View style={styles.rowText}>
          <MccCardTitle>{title}</MccCardTitle>
          <MccBody muted>{body}</MccBody>
        </View>
        <MccBadge tone={done ? "success" : "warning"}>{done ? "Fertig" : "Offen"}</MccBadge>
      </View>
      <MccButton label={actionLabel} icon="arrow-right" variant={done ? "secondary" : "primary"} onPress={onPress} />
    </MccCard>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
  rowText: { flex: 1, minWidth: 0 },
  check: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
});
