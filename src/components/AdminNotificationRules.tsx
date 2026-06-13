import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import {
  APP_NOTIFICATION_KIND_LABELS,
  CONDITION_HINTS,
  CONDITION_KEYS,
  CONDITION_LABELS,
  NOTIFICATION_RULE_KIND_LABELS,
  NOTIFICATION_RULE_STATUS_LABELS,
  describeSchedule,
  parseConditions,
  parseSchedule,
  summarizeConditions,
  type NotificationRuleConditions,
  type NotificationRuleScheduleMode,
} from "../lib/notificationRuleView";
import { WEEKDAY_LABELS, WEEKDAY_ORDER, type EventDay } from "../services/date";
import { SegmentedControl } from "./FormControls";
import { MccBadge } from "./MccDesign";
import {
  clearAppNotifications,
  createNotificationRule,
  deleteAppNotification,
  deleteNotificationRule,
  listNotificationRules,
  listRecentNotifications,
  sendNotificationRule,
  setNotificationRuleStatus,
  updateNotificationRule,
  type AppNotificationView,
  type NotificationRule,
} from "../services/notificationRules";
import type { NotificationRuleKind, NotificationRuleStatus } from "../services/database.types";

// invite_reminder is a system-only kind, not offered when creating custom rules.
const KIND_OPTIONS = (Object.keys(NOTIFICATION_RULE_KIND_LABELS) as NotificationRuleKind[])
  .filter((value) => value !== "invite_reminder")
  .map((value) => ({ value, label: NOTIFICATION_RULE_KIND_LABELS[value] }));

type Tab = "rules" | "history";

type FormState = {
  id: string | null;
  systemKey: string | null;
  kind: NotificationRuleKind;
  title: string;
  body: string;
  href: string;
  status: NotificationRuleStatus;
  conditions: NotificationRuleConditions;
  scheduleMode: NotificationRuleScheduleMode;
  date: string;
  weekday: string;
  time: string;
};

function emptyForm(): FormState {
  return { id: null, systemKey: null, kind: "manual", title: "", body: "", href: "/", status: "draft", conditions: {}, scheduleMode: "once", date: "", weekday: "", time: "" };
}

function formFromRule(rule: NotificationRule): FormState {
  const schedule = parseSchedule(rule.schedule);
  return {
    id: rule.id,
    systemKey: rule.system_key,
    kind: rule.kind,
    title: rule.title,
    body: rule.body,
    href: rule.href,
    status: rule.status,
    conditions: parseConditions(rule.conditions),
    scheduleMode: schedule.mode ?? "once",
    date: schedule.date ?? "",
    weekday: schedule.weekday ?? "",
    time: schedule.time ?? "",
  };
}

export function AdminNotificationRules() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [history, setHistory] = useState<AppNotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [rulesResult, historyResult] = await Promise.all([listNotificationRules(supabase), listRecentNotifications(supabase)]);
    setLoading(false);
    if (rulesResult.error) {
      setError(rulesResult.error.message);
      return;
    }
    setRules(rulesResult.data);
    if (!historyResult.error) setHistory(historyResult.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function notify(text: string) {
    setMessage(text);
    setError(null);
  }
  function flagError(text: string) {
    setError(text);
    setMessage(null);
  }

  async function saveForm() {
    if (!form || busy) return;
    setBusy(true);
    const schedule =
      form.scheduleMode === "recurring"
        ? { mode: "recurring" as const, weekday: form.weekday || undefined, time: form.time || undefined }
        : { mode: "once" as const, date: form.date || undefined, time: form.time || undefined };
    const input = { kind: form.kind, title: form.title, body: form.body, href: form.href, conditions: form.conditions, schedule, status: form.status };
    const result = form.id ? await updateNotificationRule(supabase, form.id, input) : await createNotificationRule(supabase, input);
    setBusy(false);
    if (result.error) {
      flagError(result.error.message);
      return;
    }
    notify(form.id ? "Regel gespeichert." : "Regel erstellt.");
    setForm(null);
    await load();
  }

  async function toggleStatus(rule: NotificationRule) {
    if (busy) return;
    setBusy(true);
    const next: NotificationRuleStatus = rule.status === "active" ? "inactive" : "active";
    const result = await setNotificationRuleStatus(supabase, rule.id, next);
    setBusy(false);
    if (result.error) return flagError(result.error.message);
    notify(next === "active" ? "Regel aktiviert." : "Regel deaktiviert.");
    await load();
  }

  async function removeRule(id: string) {
    setBusy(true);
    const result = await deleteNotificationRule(supabase, id);
    setBusy(false);
    setConfirmDeleteId(null);
    if (result.error) return flagError(result.error.message);
    notify("Regel gelöscht.");
    await load();
  }

  async function send(rule: NotificationRule, testOnly: boolean) {
    if (busy) return;
    setBusy(true);
    const result = await sendNotificationRule(supabase, rule.id, { testOnly });
    setBusy(false);
    if (result.error) return flagError(result.error.message);
    notify(testOnly ? "Testbenachrichtigung an dich gesendet." : `Benachrichtigung an ${result.data.queued} Mitglied(er) eingereiht.`);
    await load();
  }

  async function removeNotification(id: string) {
    setBusy(true);
    const result = await deleteAppNotification(supabase, id);
    setBusy(false);
    if (result.error) return flagError(result.error.message);
    notify("Benachrichtigung gelöscht.");
    await load();
  }

  async function clearQueue(scope: "pending" | "delivered") {
    setBusy(true);
    const result = await clearAppNotifications(supabase, scope);
    setBusy(false);
    if (result.error) return flagError(result.error.message);
    notify(scope === "pending" ? "Ausstehende Benachrichtigungen gelöscht." : "Zugestellte Benachrichtigungen aufgeräumt.");
    await load();
  }

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  function toggleCondition(key: keyof NotificationRuleConditions) {
    setForm((current) => {
      if (!current) return current;
      const conditions = { ...current.conditions };
      if (conditions[key]) delete conditions[key];
      else conditions[key] = true;
      return { ...current, conditions };
    });
  }

  return (
    <View style={styles.root}>
      <SegmentedControl
        options={[
          { value: "rules", label: "Regeln" },
          { value: "history", label: "Aktuell" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {message ? <Text style={[styles.message, { color: theme.mcc.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: theme.mcc.danger }]}>{error}</Text> : null}

      {tab === "rules" ? (
        <>
          {!form ? (
            <Pressable style={[styles.primary, { backgroundColor: theme.mcc.accentDeep }]} onPress={() => setForm(emptyForm())}>
              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Neue Regel</Text>
            </Pressable>
          ) : null}

          {form ? (
            <View style={[styles.card, { borderColor: theme.mcc.strongLine, backgroundColor: theme.mcc.surfaceRaised }]}>
              <Text style={[styles.formTitle, { color: theme.mcc.textPrimary }]}>{form.id ? "Regel bearbeiten" : "Neue Regel"}</Text>

              <Heading label="Inhalt" />
              <Field label="Titel">
                <RuleInput value={form.title} onChangeText={(value) => updateForm({ title: value })} placeholder="z. B. Stimme bald fällig" />
              </Field>
              <Field label="Nachricht">
                <RuleInput value={form.body} onChangeText={(value) => updateForm({ body: value })} placeholder="Kurzer Benachrichtigungstext" multiline />
              </Field>
              <Field label="Link (optional)">
                <RuleInput value={form.href} onChangeText={(value) => updateForm({ href: value })} placeholder="/" />
              </Field>

              {form.systemKey ? (
                <Text style={[styles.hint, { color: theme.mcc.textMuted }]}>
                  Systembenachrichtigung – Auslöser und Zielgruppe sind fest. Du kannst Titel, Text und Status anpassen.
                </Text>
              ) : (
                <>
              <Heading label="Zielgruppe" />
              <SegmentedControl label="Typ" options={KIND_OPTIONS} value={form.kind} onChange={(value) => updateForm({ kind: value })} />

              <Heading label="Bedingung" />
              <View style={styles.chips}>
                {CONDITION_KEYS.map((key) => {
                  const active = Boolean(form.conditions[key]);
                  return (
                    <Pressable
                      key={key}
                      style={[styles.chip, { borderColor: active ? theme.mcc.accent : theme.mcc.line, backgroundColor: active ? theme.mcc.accentSoft : theme.mcc.surfaceSoft }]}
                      onPress={() => toggleCondition(key)}
                    >
                      <MaterialCommunityIcons name={active ? "check-circle" : "circle-outline"} size={15} color={active ? theme.mcc.accent : theme.mcc.textMuted} />
                      <Text style={[styles.chipText, { color: active ? theme.mcc.accent : theme.mcc.textSecondary }]}>{CONDITION_LABELS[key]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {CONDITION_KEYS.some((key) => form.conditions[key] && CONDITION_HINTS[key]) ? (
                <Text style={[styles.hint, { color: theme.mcc.textMuted }]}>Event-Bedingungen beziehen sich auf das aktuelle offene Event.</Text>
              ) : null}

              <Heading label="Timing" />
              <SegmentedControl
                options={[
                  { value: "once", label: "Einmalig" },
                  { value: "recurring", label: "Wiederkehrend" },
                ]}
                value={form.scheduleMode}
                onChange={(value) => updateForm({ scheduleMode: value })}
              />
              {form.scheduleMode === "once" ? (
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Field label="Datum">
                      <RuleInput value={form.date} onChangeText={(value) => updateForm({ date: value })} placeholder="JJJJ-MM-TT" />
                    </Field>
                  </View>
                  <View style={styles.rowItem}>
                    <Field label="Uhrzeit">
                      <RuleInput value={form.time} onChangeText={(value) => updateForm({ time: value })} placeholder="HH:MM" />
                    </Field>
                  </View>
                </View>
              ) : (
                <>
                  <Field label="Wochentag">
                    <View style={styles.chips}>
                      {WEEKDAY_ORDER.map((day: EventDay) => {
                        const active = form.weekday === day;
                        return (
                          <Pressable
                            key={day}
                            style={[styles.chip, { borderColor: active ? theme.mcc.accent : theme.mcc.line, backgroundColor: active ? theme.mcc.accentSoft : theme.mcc.surfaceSoft }]}
                            onPress={() => updateForm({ weekday: active ? "" : day })}
                          >
                            <Text style={[styles.chipText, { color: active ? theme.mcc.accent : theme.mcc.textSecondary }]}>{WEEKDAY_LABELS[day]}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>
                  <Field label="Uhrzeit">
                    <RuleInput value={form.time} onChangeText={(value) => updateForm({ time: value })} placeholder="HH:MM" />
                  </Field>
                </>
              )}
              <Text style={[styles.hint, { color: theme.mcc.textMuted }]}>
                Aktive Regeln mit Zeit werden automatisch zur eingestellten Zeit gesendet (einmalig danach inaktiv). Ohne Zeit nur per „Senden".
              </Text>
                </>
              )}

              <Heading label="Aktivierung" />
              <SegmentedControl
                options={[
                  { value: "draft", label: "Entwurf" },
                  { value: "active", label: "Aktiv" },
                  { value: "inactive", label: "Inaktiv" },
                ]}
                value={form.status}
                onChange={(value) => updateForm({ status: value })}
              />

              <Heading label="Vorschau" />
              <View style={[styles.preview, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
                <Text style={[styles.previewTitle, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
                  {form.title || "Titel"}
                </Text>
                <Text style={[styles.previewBody, { color: theme.mcc.textSecondary }]} numberOfLines={3}>
                  {form.body || "Nachrichtentext"}
                </Text>
              </View>

              <View style={styles.formActions}>
                <Pressable style={[styles.primary, { backgroundColor: theme.mcc.accentDeep }, busy && styles.disabled]} onPress={saveForm} disabled={busy}>
                  <Text style={styles.primaryText}>{busy ? "Speichere…" : "Speichern"}</Text>
                </Pressable>
                <Pressable style={[styles.ghost, { borderColor: theme.mcc.line }]} onPress={() => setForm(null)}>
                  <Text style={[styles.ghostText, { color: theme.mcc.textSecondary }]}>Abbrechen</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {loading ? (
            <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Lädt …</Text>
          ) : rules.length === 0 ? (
            <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Noch keine Regeln. Lege oben eine neue Regel an.</Text>
          ) : (
            rules.map((rule) => (
              <View key={rule.id} style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
                <View style={styles.ruleHead}>
                  <View style={styles.flexText}>
                    <Text style={[styles.ruleTitle, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
                      {rule.title}
                    </Text>
                    <Text style={[styles.ruleMeta, { color: theme.mcc.textSecondary }]} numberOfLines={2}>
                      {rule.body}
                    </Text>
                  </View>
                  <MccBadge tone={rule.status === "active" ? "success" : rule.status === "inactive" ? "warning" : "neutral"}>
                    {NOTIFICATION_RULE_STATUS_LABELS[rule.status]}
                  </MccBadge>
                </View>

                <View style={styles.badgeRow}>
                  <MccBadge tone="accent" icon="bell-outline">
                    {NOTIFICATION_RULE_KIND_LABELS[rule.kind]}
                  </MccBadge>
                  {rule.system_key ? (
                    <MccBadge tone="neutral" icon="cog-outline">System · automatisch</MccBadge>
                  ) : (
                    <>
                      <MccBadge tone="neutral" icon="account-group-outline">
                        {summarizeConditions(rule.conditions)}
                      </MccBadge>
                      <MccBadge tone="neutral" icon="clock-outline">
                        {describeSchedule(rule.schedule)}
                      </MccBadge>
                    </>
                  )}
                </View>

                <View style={styles.ruleActions}>
                  <ActionChip icon="pencil-outline" label="Bearbeiten" onPress={() => setForm(formFromRule(rule))} />
                  <ActionChip
                    icon={rule.status === "active" ? "pause-circle-outline" : "play-circle-outline"}
                    label={rule.status === "active" ? "Deaktivieren" : "Aktivieren"}
                    onPress={() => toggleStatus(rule)}
                  />
                  <ActionChip icon="send-check-outline" label="Test an mich" onPress={() => send(rule, true)} />
                  {!rule.system_key && rule.status === "active" ? <ActionChip icon="send-outline" label="Senden" onPress={() => send(rule, false)} /> : null}
                  {!rule.system_key ? <ActionChip icon="trash-can-outline" label="Löschen" tone="danger" onPress={() => setConfirmDeleteId(rule.id)} /> : null}
                </View>

                {confirmDeleteId === rule.id ? (
                  <View style={[styles.confirm, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]}>
                    <Text style={[styles.confirmText, { color: theme.mcc.textPrimary }]}>Regel wirklich löschen?</Text>
                    <View style={styles.confirmActions}>
                      <Pressable style={[styles.ghost, { borderColor: theme.mcc.line }]} onPress={() => setConfirmDeleteId(null)}>
                        <Text style={[styles.ghostText, { color: theme.mcc.textSecondary }]}>Abbrechen</Text>
                      </Pressable>
                      <Pressable style={[styles.danger, { backgroundColor: theme.mcc.dangerSoft, borderColor: `${theme.mcc.danger}66` }]} onPress={() => removeRule(rule.id)}>
                        <Text style={[styles.dangerText, { color: theme.mcc.danger }]}>Löschen</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.ruleActions}>
            <ActionChip icon="refresh" label="Aktualisieren" onPress={load} />
            <ActionChip icon="clock-remove-outline" label="Ausstehende löschen" onPress={() => clearQueue("pending")} />
            <ActionChip icon="broom" label="Zugestellte aufräumen" onPress={() => clearQueue("delivered")} />
          </View>

          {loading ? (
            <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Lädt …</Text>
          ) : history.length === 0 ? (
            <Text style={[styles.hint, { color: theme.mcc.textSecondary }]}>Keine Benachrichtigungen in der Warteschlange.</Text>
          ) : (
            history.map((item) => (
              <View key={item.id} style={[styles.historyRow, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface }]}>
                <View style={styles.flexText}>
                  <View style={styles.historyTop}>
                    <MccBadge tone={item.deliveredAt ? "success" : "warning"} icon={item.deliveredAt ? "check" : "clock-outline"}>
                      {item.deliveredAt ? "Zugestellt" : "Ausstehend"}
                    </MccBadge>
                    <Text style={[styles.historyKind, { color: theme.mcc.textMuted }]}>{APP_NOTIFICATION_KIND_LABELS[item.kind] ?? item.kind}</Text>
                  </View>
                  <Text style={[styles.ruleTitle, { color: theme.mcc.textPrimary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.ruleMeta, { color: theme.mcc.textSecondary }]} numberOfLines={2}>
                    {item.body}
                  </Text>
                  <Text style={[styles.historyMeta, { color: theme.mcc.textMuted }]}>
                    An {item.recipientName} · {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <Pressable style={({ pressed }) => [styles.iconButton, { borderColor: theme.mcc.line }, pressed && styles.pressed]} onPress={() => removeNotification(item.id)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.mcc.danger} />
                </Pressable>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Heading({ label }: { label: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.heading, { color: theme.mcc.accent }]}>{label}</Text>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.mcc.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

function RuleInput({ multiline, ...props }: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.mcc.textMuted}
      multiline={multiline}
      style={[styles.input, multiline && styles.inputMultiline, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
      {...props}
    />
  );
}

function ActionChip({ icon, label, onPress, tone }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; label: string; onPress: () => void; tone?: "danger" }) {
  const { theme } = useTheme();
  const color = tone === "danger" ? theme.mcc.danger : theme.mcc.textPrimary;
  return (
    <Pressable style={({ pressed }) => [styles.actionChip, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }, pressed && styles.pressed]} onPress={onPress}>
      <MaterialCommunityIcons name={icon} size={15} color={color} />
      <Text style={[styles.actionChipText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  message: { fontSize: 14, fontWeight: "900" },
  primary: { alignItems: "center", borderRadius: 16, flexDirection: "row", gap: 6, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 13 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  card: { gap: 12, borderRadius: 20, borderWidth: 1, padding: 16 },
  formTitle: { fontSize: 18, fontWeight: "900" },
  heading: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "800" },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, outlineStyle: "none" } as object,
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  rowItem: { flex: 1, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { alignItems: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: "800" },
  hint: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  preview: { gap: 4, borderRadius: 14, borderWidth: 1, padding: 12 },
  previewTitle: { fontSize: 15, fontWeight: "900" },
  previewBody: { fontSize: 13, lineHeight: 18 },
  formActions: { flexDirection: "row", gap: 10 },
  ghost: { alignItems: "center", borderRadius: 16, borderWidth: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  ghostText: { fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.5 },
  ruleHead: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  flexText: { flex: 1, minWidth: 0, gap: 3 },
  ruleTitle: { fontSize: 16, fontWeight: "900", lineHeight: 21 },
  ruleMeta: { fontSize: 13, lineHeight: 18 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ruleActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionChip: { alignItems: "center", borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 8 },
  actionChipText: { fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.7 },
  confirm: { gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  confirmText: { fontSize: 14, fontWeight: "800" },
  confirmActions: { flexDirection: "row", gap: 10 },
  danger: { alignItems: "center", borderRadius: 16, borderWidth: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  dangerText: { fontSize: 14, fontWeight: "900" },
  historyRow: { alignItems: "flex-start", flexDirection: "row", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14 },
  historyTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  historyKind: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  historyMeta: { fontSize: 12, fontWeight: "700" },
  iconButton: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
});
