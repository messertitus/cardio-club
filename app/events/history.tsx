import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { BackButton } from "../../src/components/BackButton";
import { DetailLine } from "../../src/components/FormControls";
import { InlineError, LoadingSkeleton, MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen, ScreenLoader } from "../../src/components/MccDesign";
import { Reveal } from "../../src/components/Motion";
import { SportIconBadge } from "../../src/components/SportIcon";
import { formatBerlinDateTime, formatCardioSunday, isEventPast } from "../../src/services/date";
import { useAuth } from "../../src/context/AuthContext";
import { supabase } from "../../src/lib/supabase";
import { canCloseEvent, getMccEventState, listEventActivities, listEventHistory, listEventResults, listSports, SCREEN_EVENTS, type Row } from "../../src/services";
import { useScreenView } from "../../src/components/useScreenView";

type EventWithActivities = {
  event: Row<"weekly_events">;
  activities: Row<"event_activities">[];
  results: Row<"event_results">[];
};

export default function EventHistoryScreen() {
  const { loading, user } = useAuth();
  useScreenView(SCREEN_EVENTS.history);
  const [events, setEvents] = useState<EventWithActivities[]>([]);
  const [sports, setSports] = useState<Row<"sports">[]>([]);
  // Past, not-yet-completed events the current user (admin / mod / AP) may close.
  const [manageableEventIds, setManageableEventIds] = useState<Set<string>>(new Set());
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      setBusy(true);
      const state = await getMccEventState(supabase, user.id);
      if (state.error) {
        setError(state.error.message);
        setBusy(false);
        return;
      }
      const [historyResult, sportsResult] = await Promise.all([listEventHistory(supabase, state.data.clubId), listSports(supabase)]);
      if (historyResult.error || sportsResult.error) {
        setError(historyResult.error?.message ?? sportsResult.error?.message ?? null);
        setBusy(false);
        return;
      }
      const [activityResults, resultResults] = await Promise.all([
        Promise.all(historyResult.data.map((event) => listEventActivities(supabase, event.id))),
        Promise.all(historyResult.data.map((event) => listEventResults(supabase, event.id))),
      ]);
      setEvents(
        historyResult.data.map((event, index) => ({
          event,
          activities: activityResults[index]?.data ?? [],
          results: resultResults[index]?.data ?? [],
        })),
      );
      setSports(sportsResult.data);
      setBusy(false);

      // For past, not-yet-completed events, find which ones this user may still
      // close (admin / event contact / activity AP) so the archive can offer the
      // attendance/results/close actions where a wrap-up is still pending.
      const pending = historyResult.data.filter(
        (event) => event.status !== "completed" && event.status !== "cancelled" && isEventPast(event.week_start_date, event.event_day),
      );
      if (pending.length > 0) {
        const closable = await Promise.all(pending.map((event) => canCloseEvent(supabase, event.id, user.id)));
        setManageableEventIds(new Set(pending.filter((_, index) => closable[index]?.data).map((event) => event.id)));
      }
    }

    void load();
  }, [user]);

  const sportNames = useMemo(() => new Map(sports.map((sport) => [sport.id, sport.name])), [sports]);

  // The archive only shows events that are done: skipped, completed, or past.
  const archived = useMemo(
    () => events.filter(({ event }) => event.status === "cancelled" || event.status === "completed" || isEventPast(event.week_start_date, event.event_day)),
    [events],
  );

  if (loading)
    return (
      <MccScreen>
        <ScreenLoader />
      </MccScreen>
    );
  if (!user) return <Redirect href="/auth" />;

  return (
    <MccScreen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <MccCardTitle>Vergangene Events</MccCardTitle>
          <MccBody muted>Entscheidungen, konkrete Aktivitäten und Details rückwirkend ansehen.</MccBody>
        </View>
        <BackButton onPress={() => router.back()} />
      </View>
      <InlineError>{error}</InlineError>
      {busy ? <LoadingSkeleton lines={3} /> : null}
      {!busy && archived.length === 0 ? <MccBody muted>Noch keine vergangenen Events.</MccBody> : null}
      {archived.map(({ event, activities, results }, index) => {
        const opened = expandedEventId === event.id;
        const skipped = event.status === "cancelled";
        const decisionSports = [event.selected_sport_id, event.secondary_sport_id]
          .map((id) => (id ? sportNames.get(id) : null))
          .filter(Boolean)
          .join(" + ");
        const locations = [...new Set(activities.map((activity) => activity.location).filter(Boolean))].join(", ");
        return (
          <Reveal key={event.id} index={index}>
          <MccCard>
            <View style={styles.cardHead}>
              {skipped ? (
                <MccBadge icon="calendar-remove-outline" tone="warning">Übersprungen</MccBadge>
              ) : (
                <MccBadge icon={eventTypeIcon(event.decision_type)} tone={event.decision_type ? "accent" : "neutral"}>{eventTypeLabel(event.decision_type)}</MccBadge>
              )}
              <MccBadge
                tone={skipped ? "neutral" : event.status === "completed" ? "success" : "neutral"}
                icon={skipped ? "account-off-outline" : event.status === "completed" ? "check-decagram" : "calendar-blank-outline"}
              >
                {skipped ? "Keine Teilnahme" : event.status === "completed" ? "Abgeschlossen" : "Vorbei"}
              </MccBadge>
            </View>
            <MccCardTitle>Cardiotag am {formatCardioSunday(event.starts_at ?? event.week_start_date)}</MccCardTitle>
            {skipped ? (
              <MccBody muted>Mangels Teilnahme übersprungen – es gab keine Abstimmung, daher kein Ort und keine Aktivität.</MccBody>
            ) : (
              <>
                <MccBody muted>{event.decision_reason ?? "Keine Entscheidung gespeichert."}</MccBody>
                {activities.slice(0, opened ? activities.length : 2).map((activity) => {
                  const sport = sports.find((entry) => entry.id === activity.sport_id);
                  return (
                    <View key={activity.id} style={styles.activityRow}>
                      <SportIconBadge sport={sport} size={34} />
                      <MccBody style={styles.activityText}>
                        {activity.title || sportNames.get(activity.sport_id) || "Aktivität"}
                        {activity.location ? ` · ${activity.location}` : ""}
                      </MccBody>
                    </View>
                  );
                })}
              </>
            )}
            {opened ? (
              skipped ? (
                <>
                  <DetailLine label="Status" value="Übersprungen – keine Teilnahme" />
                  <DetailLine label="Stadt" value={event.city} />
                  <DetailLine label="Geplant für" value={event.starts_at ? formatBerlinDateTime(event.starts_at) : null} />
                  <DetailLine label="Auswirkung" value="Kein Einfluss auf die Fairness-Bilanz – als hätte es den Cardiotag nicht gegeben." />
                </>
              ) : (
                <>
                  <DetailLine label="Entscheidung" value={decisionSports || eventTypeLabel(event.decision_type)} />
                  <DetailLine label="Zeit" value={event.starts_at ? formatBerlinDateTime(event.starts_at) : null} />
                  <DetailLine label="Stadt" value={event.city} />
                  <DetailLine label="Orte" value={locations || "—"} />
                  <DetailLine label="Ergebnisse" value={results.length ? results.map((result) => result.summary).join(" | ") : "Keine eingetragen"} />
                  <DetailLine label="Auswirkung" value="Fließt in die Fairness-Bilanz ein: übergangene Wünsche zählen beim nächsten Mal stärker." />
                  <DetailLine label="Notizen" value={event.notes} />
                </>
              )
            ) : null}
            {!skipped && event.status !== "completed" && manageableEventIds.has(event.id) ? (
              <View style={styles.manage}>
                <MccBadge tone="warning" icon="progress-clock">Abschluss ausstehend</MccBadge>
                <MccBody muted>Trage Anwesenheit und Ergebnisse ein, um diesen Cardiotag abzuschließen.</MccBody>
                <MccButton label="Anwesenheit eintragen" variant="secondary" icon="account-check-outline" onPress={() => router.push({ pathname: "/events/[eventId]/attendance", params: { eventId: event.id } })} />
                <MccButton label="Ergebnisse eintragen" variant="secondary" icon="trophy-outline" onPress={() => router.push({ pathname: "/events/[eventId]/results", params: { eventId: event.id } })} />
                <MccButton label="Event abschließen" icon="check-decagram" onPress={() => router.push({ pathname: "/events/[eventId]/close", params: { eventId: event.id } })} />
              </View>
            ) : null}
            <MccButton label={opened ? "Weniger" : "Details"} variant="secondary" icon={opened ? "chevron-up" : "chevron-down"} onPress={() => setExpandedEventId(opened ? null : event.id)} />
          </MccCard>
          </Reveal>
        );
      })}
    </MccScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  headerText: { flex: 1, minWidth: 0, gap: 6 },
  cardHead: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  activityRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  activityText: { flex: 1, minWidth: 0 },
  manage: { gap: 8 },
});

function eventTypeIcon(type: Row<"weekly_events">["decision_type"]): ComponentProps<typeof MaterialCommunityIcons>["name"] {
  if (type === "multi_sport") return "vector-combine";
  if (type === "twin") return "call-split";
  if (type === "single") return "trophy-outline";
  return "history";
}

function eventTypeLabel(type: Row<"weekly_events">["decision_type"]): string {
  if (type === "multi_sport") return "Multi-Sport";
  if (type === "twin") return "Twin Event";
  if (type === "single") return "Single Event";
  return "Offen";
}
