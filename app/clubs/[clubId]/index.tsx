import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { InlineError, MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen, ScreenLoader, WeeklyEventHeroCard } from "../../../src/components/MccDesign";
import { formatCardioSunday } from "../../../src/services/date";
import { supabase } from "../../../src/lib/supabase";
import { getClub, getCurrentWeeklyEvent, type Row } from "../../../src/services";

export default function ClubDashboardScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const [club, setClub] = useState<Row<"clubs"> | null>(null);
  const [event, setEvent] = useState<Row<"weekly_events"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [clubResult, eventResult] = await Promise.all([
        getClub(supabase, clubId),
        getCurrentWeeklyEvent(supabase, { clubId }),
      ]);

      if (!active) {
        return;
      }

      setClub(clubResult.data);
      setEvent(eventResult.data);
      setError(clubResult.error?.message ?? eventResult.error?.message ?? null);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [clubId]);

  if (loading) {
    return (
      <MccScreen>
        <ScreenLoader />
      </MccScreen>
    );
  }

  return (
    <MccScreen title={club?.name ?? "Club"} kicker="Dashboard" subtitle={club?.description ?? "Gemeinsamer Cardiotag ohne Wiederholung von letzter Woche."}>
      <InlineError>{error}</InlineError>
      <WeeklyEventHeroCard
        title="Diese Woche"
        subtitle={event ? `Cardiotag am ${formatCardioSunday(event.starts_at ?? event.week_start_date)}` : "Fuer diese Woche gibt es noch kein Event."}
        dateLabel={event ? formatCardioSunday(event.starts_at ?? event.week_start_date) : undefined}
        status={event ? event.status : "offen"}
        chips={[{ label: eventTypeLabel(event?.decision_type ?? null), icon: "chart-donut" }]}
        ctaLabel="Diese Woche öffnen"
        onCtaPress={() => router.push(`/clubs/${clubId}/event`)}
      />
      <MccCard>
        <MccBadge icon="clipboard-pulse-outline">Planung</MccBadge>
        <MccCardTitle>Club-Woche steuern</MccCardTitle>
        <MccBody muted>Vorschläge sammeln, abstimmen und die faire Entscheidung anzeigen.</MccBody>
        {event ? (
          <>
            <MccButton label="Sportart vorschlagen" icon="lightbulb-on-outline" variant="secondary" onPress={() => router.push(`/events/${event.id}/propose`)} />
            <MccButton label="Abstimmen" icon="vote-outline" variant="secondary" onPress={() => router.push(`/events/${event.id}/vote`)} />
            <MccButton label="Entscheidung anzeigen" icon="trophy-outline" variant="secondary" onPress={() => router.push(`/events/${event.id}/decision`)} />
          </>
        ) : null}
      </MccCard>
      <MccButton label="Event-Verlauf" icon="history" variant="secondary" onPress={() => router.push(`/clubs/${clubId}/history`)} />
    </MccScreen>
  );
}

function eventTypeLabel(type: Row<"weekly_events">["decision_type"] | null): string {
  if (type === "multi_sport") return "Multi-Sport";
  if (type === "twin") return "Twin";
  if (type === "single") return "Single";
  return "Entscheidung offen";
}
