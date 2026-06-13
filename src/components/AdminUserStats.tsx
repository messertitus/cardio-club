import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { statKeyLabel, ALL_STAT_KEYS, isValidStatKey } from "../lib/analyticsEvents";
import { SearchField } from "./FormControls";
import { MccBadge } from "./MccDesign";
import {
  getUserStatInsights,
  getUserStats,
  listUserStatAudit,
  resetAllUserStatistics,
  resetUserStatistic,
  updateUserStatisticForTesting,
  type MccMember,
  type Row,
  type UserStatInsights,
  type UserStats,
} from "../services";

// Admin-only TEST menu for user statistics. Lets an admin pick a member, view
// their central counters, and reset or manually override single values for
// testing. Every change is server-gated (admin RPCs) and written to an audit
// log, surfaced here. Regular users never reach this — it lives behind the
// admin section gate in app/admin.tsx.

type Props = { members: MccMember[] };

const ACTION_LABELS: Record<string, string> = { set: "Wert gesetzt", reset: "Zurückgesetzt", reset_all: "Alles zurückgesetzt" };

export function AdminUserStats({ members }: Props) {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MccMember | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [insights, setInsights] = useState<UserStatInsights | null>(null);
  const [audit, setAudit] = useState<Row<"admin_stat_audit_log">[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members.slice(0, 25);
    return members
      .filter((member) => [member.displayName, member.phone, member.city, member.userId].filter(Boolean).join(" ").toLowerCase().includes(query))
      .slice(0, 25);
  }, [members, search]);

  const notify = (text: string) => {
    setMessage(text);
    setError(null);
  };
  const flagError = (text: string) => {
    setError(text);
    setMessage(null);
  };

  const loadStats = useCallback(async (member: MccMember) => {
    setLoading(true);
    setMessage(null);
    setError(null);
    const [statsResult, insightsResult, auditResult] = await Promise.all([
      getUserStats(supabase, member.userId),
      getUserStatInsights(supabase, member.userId),
      listUserStatAudit(supabase, member.userId),
    ]);
    setLoading(false);
    if (statsResult.error) {
      flagError(statsResult.error.message);
      return;
    }
    setStats(statsResult.data);
    setInsights(insightsResult.error ? null : insightsResult.data);
    setAudit(auditResult.error ? [] : auditResult.data);
  }, []);

  function selectMember(member: MccMember) {
    setSelected(member);
    setEditKey(null);
    setEditValue("");
    setConfirmResetAll(false);
    void loadStats(member);
  }

  async function applyEdit(metricKey: string) {
    if (!selected || busy) return;
    const value = Number(editValue.replace(/[^\d]/g, ""));
    setBusy(true);
    const result = await updateUserStatisticForTesting(supabase, {
      targetUserId: selected.userId,
      metricKey,
      value,
      note: "Adminkorrektur (Test)",
    });
    setBusy(false);
    if (result.error) {
      flagError(result.error.message);
      return;
    }
    setEditKey(null);
    setEditValue("");
    notify(`${statKeyLabel(metricKey)} auf ${value} gesetzt.`);
    await loadStats(selected);
  }

  async function resetOne(metricKey: string) {
    if (!selected || busy) return;
    setBusy(true);
    const result = await resetUserStatistic(supabase, { targetUserId: selected.userId, metricKey, note: "Adminreset (Test)" });
    setBusy(false);
    if (result.error) {
      flagError(result.error.message);
      return;
    }
    notify(`${statKeyLabel(metricKey)} zurückgesetzt.`);
    await loadStats(selected);
  }

  async function resetAll() {
    if (!selected || busy) return;
    setBusy(true);
    const result = await resetAllUserStatistics(supabase, { targetUserId: selected.userId, note: "Adminreset aller Teststatistiken" });
    setBusy(false);
    setConfirmResetAll(false);
    if (result.error) {
      flagError(result.error.message);
      return;
    }
    notify("Alle Teststatistiken zurückgesetzt.");
    await loadStats(selected);
  }

  // Counters present plus any blessed keys not yet recorded (shown as 0) so an
  // admin can pre-set a value for testing even before the user triggered it.
  const counterRows = useMemo(() => {
    const present = new Map((stats?.counters ?? []).map((counter) => [counter.metricKey, counter]));
    return ALL_STAT_KEYS.map((key) => ({
      metricKey: key,
      value: present.get(key)?.value ?? 0,
      lastEventAt: present.get(key)?.lastEventAt ?? null,
      recorded: present.has(key),
    }));
  }, [stats]);

  return (
    <View style={styles.root}>
      <View style={[styles.warningBox, { borderColor: `${theme.mcc.danger}55`, backgroundColor: theme.mcc.dangerSoft }]}>
        <MaterialCommunityIcons name="flask-outline" size={18} color={theme.mcc.danger} />
        <Text style={[styles.warningText, { color: theme.mcc.danger }]}>
          Nur Test/Admin. Manuelle Änderungen verfälschen echte Statistiken und werden im Audit-Log protokolliert.
        </Text>
      </View>

      {message ? <Text style={[styles.message, { color: theme.mcc.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: theme.mcc.danger }]}>{error}</Text> : null}

      <SearchField value={search} onChangeText={setSearch} placeholder="Mitglied: Name, Telefon, Stadt oder ID" />
      <View style={styles.memberList}>
        {filtered.map((member) => {
          const active = selected?.userId === member.userId;
          return (
            <Pressable
              key={member.userId}
              style={[styles.memberRow, { borderColor: active ? theme.mcc.accent : theme.mcc.line, backgroundColor: active ? theme.mcc.accentSoft : theme.mcc.surface }]}
              onPress={() => selectMember(member)}
            >
              <View style={styles.flexText}>
                <Text style={[styles.memberName, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
                  {member.displayName}
                </Text>
                <Text style={[styles.memberMeta, { color: theme.mcc.textSecondary }]} numberOfLines={1}>
                  {[member.city ?? "Stadt offen", member.phone ?? "keine Nummer"].join(" · ")}
                </Text>
              </View>
              {active ? <MaterialCommunityIcons name="check-circle" size={18} color={theme.mcc.accent} /> : null}
            </Pressable>
          );
        })}
        {filtered.length === 0 ? <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Kein Mitglied gefunden.</Text> : null}
      </View>

      {selected ? (
        <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
              {selected.displayName}
            </Text>
            <MccBadge tone="neutral" icon="chart-line">
              {stats ? `${stats.totalEvents} Events` : "—"}
            </MccBadge>
          </View>
          <Text style={[styles.subMeta, { color: theme.mcc.textMuted }]}>
            Zuletzt aktiv: {formatDateTime(stats?.lastActiveAt ?? null)}
          </Text>

          {loading ? (
            <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Lädt …</Text>
          ) : (
            <>
              {insights ? (
                <View style={styles.insightsBox}>
                  <Text style={[styles.heading, { color: theme.mcc.accent }]}>Insights (abgeleitet, nicht gespeichert)</Text>
                  <View style={styles.statGrid}>
                    <StatChip label="Aktive Tage" value={insights.activeDays} />
                    <StatChip label="Aktive Wochen" value={insights.activeWeeks} />
                    <StatChip label="Wochen-Streak" value={insights.currentWeekStreak} />
                    <StatChip label="Sport-Vielfalt" value={insights.distinctVotedSports} />
                    <StatChip label="Zuverlässigkeit" value={pct(insights.rates.reliabilityPercent)} />
                    <StatChip label="Teilnahme-Treue" value={pct(insights.rates.attendanceFollowThrough)} />
                    <StatChip label="Wunsch erfüllt" value={pct(insights.rates.wishFulfilledPercent)} />
                    <StatChip label="Wunsch abgedeckt" value={pct(insights.rates.wishCoveredPercent)} />
                    <StatChip label="Vorschlag-Quote" value={pct(insights.rates.ideaAcceptancePercent)} />
                    <StatChip label="Vote-Revision" value={pct(insights.rates.voteRevisionPercent)} />
                  </View>
                  <Text style={[styles.subMeta, { color: theme.mcc.textMuted }]}>
                    Scores (vorbereitend) · Teilnahme {insights.scores.participation} · Beitrag {insights.scores.contribution} · Sozial {insights.scores.social} · Engagement {insights.scores.engagement}
                  </Text>
                  <Text style={[styles.subMeta, { color: theme.mcc.textMuted }]}>
                    Rhythmus · früh {insights.timeOfDay.morning} · mittag {insights.timeOfDay.afternoon} · abend {insights.timeOfDay.evening} · nacht {insights.timeOfDay.night}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.heading, { color: theme.mcc.accent }]}>Zähler (Rohwerte, editierbar)</Text>
              {counterRows.map((row) => (
                <View key={row.metricKey} style={[styles.counterRow, { borderTopColor: theme.mcc.line }]}>
                  <View style={styles.flexText}>
                    <Text style={[styles.counterLabel, { color: theme.mcc.textPrimary }]}>{statKeyLabel(row.metricKey)}</Text>
                    <Text style={[styles.counterKey, { color: theme.mcc.textMuted }]}>{row.metricKey}</Text>
                  </View>
                  <Text style={[styles.counterValue, { color: row.recorded ? theme.mcc.accent : theme.mcc.textMuted }]}>{row.value}</Text>
                  <View style={styles.counterActions}>
                    <Pressable
                      style={[styles.iconChip, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}
                      onPress={() => {
                        setEditKey(row.metricKey);
                        setEditValue(String(row.value));
                      }}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={15} color={theme.mcc.textPrimary} />
                    </Pressable>
                    <Pressable style={[styles.iconChip, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => resetOne(row.metricKey)} disabled={busy}>
                      <MaterialCommunityIcons name="restore" size={15} color={theme.mcc.danger} />
                    </Pressable>
                  </View>

                  {editKey === row.metricKey ? (
                    <View style={styles.editBox}>
                      <TextInput
                        value={editValue}
                        onChangeText={(value) => setEditValue(value.replace(/[^\d]/g, "").slice(0, 9))}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        placeholder="Neuer Wert"
                        placeholderTextColor={theme.mcc.textMuted}
                        style={[styles.input, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
                      />
                      <Pressable style={[styles.primarySmall, { backgroundColor: theme.mcc.accentDeep }, busy && styles.disabled]} onPress={() => applyEdit(row.metricKey)} disabled={busy}>
                        <Text style={styles.primarySmallText}>Setzen</Text>
                      </Pressable>
                      <Pressable style={[styles.ghostSmall, { borderColor: theme.mcc.line }]} onPress={() => setEditKey(null)}>
                        <Text style={[styles.ghostSmallText, { color: theme.mcc.textSecondary }]}>Abbrechen</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}

              <View style={styles.resetAllRow}>
                {confirmResetAll ? (
                  <View style={[styles.confirm, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
                    <Text style={[styles.confirmText, { color: theme.mcc.textPrimary }]}>
                      Wirklich ALLE Teststatistiken von {selected.displayName} löschen?
                    </Text>
                    <View style={styles.confirmActions}>
                      <Pressable style={[styles.ghostSmall, { borderColor: theme.mcc.line }]} onPress={() => setConfirmResetAll(false)}>
                        <Text style={[styles.ghostSmallText, { color: theme.mcc.textSecondary }]}>Abbrechen</Text>
                      </Pressable>
                      <Pressable style={[styles.danger, { backgroundColor: theme.mcc.dangerSoft, borderColor: `${theme.mcc.danger}66` }]} onPress={resetAll} disabled={busy}>
                        <Text style={[styles.dangerText, { color: theme.mcc.danger }]}>Alles löschen</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={[styles.danger, { backgroundColor: theme.mcc.dangerSoft, borderColor: `${theme.mcc.danger}66` }]} onPress={() => setConfirmResetAll(true)}>
                    <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={theme.mcc.danger} />
                    <Text style={[styles.dangerText, { color: theme.mcc.danger }]}>Alle Teststatistiken zurücksetzen</Text>
                  </Pressable>
                )}
              </View>

              <Text style={[styles.heading, { color: theme.mcc.accent }]}>Audit-Log</Text>
              {audit.length === 0 ? (
                <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Noch keine Adminänderungen.</Text>
              ) : (
                audit.map((entry) => (
                  <View key={entry.id} style={[styles.auditRow, { borderTopColor: theme.mcc.line }]}>
                    <Text style={[styles.auditText, { color: theme.mcc.textSecondary }]}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                      {entry.metric_key ? ` · ${statKeyLabel(entry.metric_key)}` : ""}
                      {entry.action === "set" ? ` (${entry.old_value ?? 0} → ${entry.new_value ?? 0})` : ""}
                    </Text>
                    <Text style={[styles.auditMeta, { color: theme.mcc.textMuted }]}>{formatDateTime(entry.created_at)}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function StatChip({ label, value }: { label: string; value: number | string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statChip, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
      <Text style={[styles.statChipValue, { color: theme.mcc.accent }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: theme.mcc.textSecondary }]}>{label}</Text>
    </View>
  );
}

function pct(value: number | null): string {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Re-export key validation so callers importing from this module stay tidy.
export { isValidStatKey };

const styles = StyleSheet.create({
  root: { gap: 12 },
  warningBox: { alignItems: "center", flexDirection: "row", gap: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  warningText: { flex: 1, fontSize: 12.5, fontWeight: "800", lineHeight: 17 },
  message: { fontSize: 14, fontWeight: "900" },
  memberList: { gap: 8 },
  memberRow: { alignItems: "center", flexDirection: "row", gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { fontSize: 15, fontWeight: "900" },
  memberMeta: { fontSize: 12.5, fontWeight: "700" },
  card: { gap: 10, borderRadius: 20, borderWidth: 1, padding: 16 },
  cardHead: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "900" },
  subMeta: { fontSize: 12.5, fontWeight: "700" },
  counterRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, paddingTop: 10 },
  counterLabel: { fontSize: 14, fontWeight: "800" },
  counterKey: { fontSize: 11, fontWeight: "600" },
  counterValue: { fontSize: 16, fontWeight: "900", minWidth: 36, textAlign: "right" },
  counterActions: { flexDirection: "row", gap: 6 },
  iconChip: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 },
  editBox: { flexBasis: "100%", flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, fontSize: 15, paddingHorizontal: 12, paddingVertical: 8, outlineStyle: "none" } as object,
  primarySmall: { alignItems: "center", borderRadius: 12, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  primarySmallText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  ghostSmall: { alignItems: "center", borderRadius: 12, borderWidth: 1, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  ghostSmallText: { fontSize: 13, fontWeight: "900" },
  resetAllRow: { marginTop: 4 },
  danger: { alignItems: "center", flexDirection: "row", gap: 6, borderRadius: 14, borderWidth: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  dangerText: { fontSize: 14, fontWeight: "900" },
  confirm: { gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  confirmText: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  heading: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, marginTop: 6, textTransform: "uppercase" },
  insightsBox: { gap: 8 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statChip: { alignItems: "center", borderRadius: 12, borderWidth: 1, gap: 2, minWidth: 96, paddingHorizontal: 10, paddingVertical: 8 },
  statChipValue: { fontSize: 17, fontWeight: "900" },
  statChipLabel: { fontSize: 11, fontWeight: "700" },
  hint: { fontSize: 12.5, fontWeight: "700", lineHeight: 17 },
  auditRow: { borderTopWidth: 1, gap: 2, paddingTop: 8 },
  auditText: { fontSize: 13, fontWeight: "700" },
  auditMeta: { fontSize: 11.5, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
