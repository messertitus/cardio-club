import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { SegmentedControl } from "./FormControls";
import { MccBadge } from "./MccDesign";
import { getChapterOverview, type ChapterOverview } from "../services";

// Aggregated chapter view answering exactly two questions:
//   1) Do people really come back?  → Wiederkehrer / Aktive / Treue-Verteilung
//   2) Does the weekly loop run?     → Event-Streak / Events-Tabelle
// All numbers come from the get_chapter_overview RPC (real attendance only,
// computed — not stored). Absolute number leads, % is secondary with n=.

type WindowMode = "all" | "30d";

export function AdminChapterOverview() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<WindowMode>("all");
  const [data, setData] = useState<ChapterOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (windowMode: WindowMode) => {
    setLoading(true);
    setError(null);
    const result = await getChapterOverview(supabase, windowMode === "30d" ? 30 : null);
    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setData(result.data);
  }, []);

  useEffect(() => {
    void load(mode);
  }, [load, mode]);

  const pct = (value: number | null) => (value === null || value === undefined ? "—" : `${value}%`);

  return (
    <View style={styles.root}>
      <SegmentedControl
        options={[
          { value: "all", label: "Gesamt" },
          { value: "30d", label: "Letzte 30 Tage" },
        ]}
        value={mode}
        onChange={(value) => setMode(value as WindowMode)}
      />
      <Text style={[styles.hint, { color: theme.mcc.textMuted }]}>
        Basiert auf realer Teilnahme (Anwesenheits-Check nach dem Event), nicht auf App-Nutzung. Der Umschalter filtert die Event-Liste.
      </Text>

      {error ? <Text style={[styles.message, { color: theme.mcc.danger }]}>{error}</Text> : null}
      {loading && !data ? <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Lädt …</Text> : null}

      {data ? (
        <>
          <View style={styles.cardGrid}>
            <StatCard label="Wiederkehrer" value={data.returners} sub={`${pct(data.returnerPercent)} kamen wieder · n=${data.membersWithPresent}`} />
            <StatCard label="Aktiv (30 Tage)" value={data.active30} sub={`7 Tage: ${data.active7}`} />
            <StatCard label="Event-Streak" value={data.eventStreakWeeks} sub="Wochen am Stück" />
            <StatCard label="Teilnehmer gesamt" value={data.membersWithPresent} sub={`von ${data.membersTotal} Mitgliedern`} />
          </View>

          <Text style={[styles.heading, { color: theme.mcc.accent }]}>Events {mode === "30d" ? "(letzte 30 Tage)" : ""}</Text>
          {data.events.length === 0 ? (
            <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>
              {data.heldEventsTotal === 0 ? "Noch kein durchgeführtes Event." : "Keine Events im gewählten Zeitraum."}
            </Text>
          ) : (
            data.events.map((event) => (
              <View key={`${event.eventNr}-${event.date}`} style={[styles.eventCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
                <View style={styles.eventHead}>
                  <Text style={[styles.eventTitle, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
                    #{event.eventNr} · {formatDate(event.date)}
                  </Text>
                  <MccBadge tone="neutral" icon="trophy-outline">{event.sport}</MccBadge>
                </View>
                <View style={styles.eventStats}>
                  <Stat label="RSVP-Zusagen" value={event.rsvpYes} theme={theme} />
                  <Stat label="Real dabei" value={event.present} accent theme={theme} />
                  <Stat label="No-Shows" value={`${event.noShows}${event.noShowPercent !== null ? ` (${event.noShowPercent}%)` : ""}`} theme={theme} />
                  <Stat label="Erstteilnehmer" value={event.firstTimers} theme={theme} />
                  <Stat label="Wiederkehrer" value={event.returners} theme={theme} />
                  <Stat label="Voting-Beteiligung" value={pct(event.votingPercent)} theme={theme} />
                </View>
              </View>
            ))
          )}

          <Text style={[styles.heading, { color: theme.mcc.accent }]}>Teilnahme-Treue (real besuchte Events)</Text>
          <View style={styles.cardGrid}>
            <StatCard label="Genau 1×" value={data.loyalty.one} sub="einmal dabei" />
            <StatCard label="2×" value={data.loyalty.two} sub="zweimal" />
            <StatCard label="3×" value={data.loyalty.three} sub="dreimal" />
            <StatCard label="4×+" value={data.loyalty.fourPlus} sub="vier oder mehr" />
          </View>
        </>
      ) : null}
    </View>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
      <Text style={[styles.statValue, { color: theme.mcc.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.mcc.accent }]}>{label}</Text>
      <Text style={[styles.statSub, { color: theme.mcc.textSecondary }]}>{sub}</Text>
    </View>
  );
}

function Stat({ label, value, accent, theme }: { label: string; value: number | string; accent?: boolean; theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniValue, { color: accent ? theme.mcc.accent : theme.mcc.textPrimary }]}>{value}</Text>
      <Text style={[styles.miniLabel, { color: theme.mcc.textSecondary }]}>{label}</Text>
    </View>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" });
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
  message: { fontSize: 14, fontWeight: "900" },
  heading: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, marginTop: 6, textTransform: "uppercase" },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: { flexGrow: 1, flexBasis: 140, gap: 2, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  statValue: { fontSize: 30, fontWeight: "900", lineHeight: 34 },
  statLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  statSub: { fontSize: 12, fontWeight: "700" },
  eventCard: { gap: 10, borderRadius: 18, borderWidth: 1, padding: 14 },
  eventHead: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  eventTitle: { flex: 1, fontSize: 15, fontWeight: "900" },
  eventStats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  miniStat: { flexBasis: 96, flexGrow: 1, gap: 1 },
  miniValue: { fontSize: 17, fontWeight: "900" },
  miniLabel: { fontSize: 11, fontWeight: "700" },
});
