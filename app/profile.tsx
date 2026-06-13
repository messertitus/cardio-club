import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { MotionBackground, ScreenLoader } from "../src/components/MccDesign";
import { PageHeader } from "../src/components/PageHeader";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { lookupCityByPostalCode } from "../src/lib/postalCity";
import { supabase } from "../src/lib/supabase";
import { useScreenView } from "../src/components/useScreenView";
import { getMyProfile, requestProfileDisplayNameChange, SCREEN_EVENTS, updateProfileCity, updateProfileDetails, type Row } from "../src/services";

export default function ProfileScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  useScreenView(SCREEN_EVENTS.profile);
  const [profile, setProfile] = useState<Row<"profiles"> | null>(null);
  const [requestedName, setRequestedName] = useState("");
  const [favoriteSports, setFavoriteSports] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const result = await getMyProfile(supabase, user.id);
      if (result.error) {
        setMessage(result.error.message);
        return;
      }
      setProfile(result.data);
      setRequestedName(result.data.display_name);
      setFavoriteSports(result.data.favorite_sports ?? "");
      setBirthDate(result.data.birth_date ?? "");
      setPostalCode(result.data.postal_code ?? "");
      setCity(result.data.city ?? "");
    }

    void load();
  }, [user]);

  async function submitNameRequest() {
    if (!user || !requestedName.trim()) return;
    setBusy(true);
    clearMessages();
    const result = await requestProfileDisplayNameChange(supabase, { userId: user.id, requestedDisplayName: requestedName });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setSuccess("Namensänderung wartet auf Admin-Freigabe.");
  }

  async function saveDetails() {
    if (!user) return;
    const normalizedBirthDate = normalizeBirthDate(birthDate);
    if (birthDate.trim() && !normalizedBirthDate) {
      setMessage("Bitte wähle den Geburtstag über den Kalender aus.");
      return;
    }

    setBusy(true);
    clearMessages();
    const result = await updateProfileDetails(supabase, { userId: user.id, favoriteSports, birthDate: normalizedBirthDate });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setProfile(result.data);
    setBirthDate(result.data.birth_date ?? "");
    setSuccess("Profil gespeichert.");
  }

  async function updatePostalCode(value: string) {
    const nextPostalCode = value.replace(/\D/g, "").slice(0, 5);
    setPostalCode(nextPostalCode);
    if (nextPostalCode.length !== 5) return;
    const resolvedCity = await lookupCityByPostalCode(nextPostalCode);
    if (resolvedCity) setCity(resolvedCity);
  }

  async function saveLocation() {
    if (!user || postalCode.length < 5 || !city.trim()) return;
    setBusy(true);
    clearMessages();
    const result = await updateProfileCity(supabase, { userId: user.id, postalCode, city: city.trim() });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setProfile((current) => (current ? { ...current, postal_code: postalCode, city: city.trim() } : current));
    setSuccess("Standort gespeichert.");
  }

  function clearMessages() {
    setMessage(null);
    setSuccess(null);
  }

  if (loading) return <ScreenLoader />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
      <MotionBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.shell}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PageHeader kicker="Account" title="Profil" />

            {message ? <Text style={styles.notice}>{message}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface, shadowColor: theme.mcc.shadow }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Name</Text>
              <Text style={[styles.label, { color: theme.mcc.textSecondary }]}>Aktuell: {profile?.display_name ?? "Mitglied"}</Text>
              <ProfileInput value={requestedName} onChangeText={setRequestedName} placeholder="Neuer Name" />
              <ActionButton label="Zur Freigabe senden" onPress={submitNameRequest} disabled={busy || requestedName.trim().length < 2 || requestedName.trim() === profile?.display_name} />
            </View>

            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface, shadowColor: theme.mcc.shadow }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Profil</Text>
              <ProfileInput value={favoriteSports} onChangeText={setFavoriteSports} placeholder="Lieblingssportarten" />
              <BirthDatePicker value={birthDate} onChangeText={setBirthDate} />
              <ActionButton label="Profil speichern" onPress={saveDetails} disabled={busy} />
            </View>

            <View style={[styles.card, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surface, shadowColor: theme.mcc.shadow }]}>
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Standort</Text>
              <Text style={[styles.label, { color: theme.mcc.textSecondary }]}>Für die Events in deiner Stadt.</Text>
              <ProfileInput value={postalCode} onChangeText={updatePostalCode} placeholder="PLZ" keyboardType="number-pad" inputMode="numeric" maxLength={5} />
              <ProfileInput value={city} onChangeText={setCity} placeholder="Stadt" autoCapitalize="words" />
              <ActionButton label="Standort speichern" onPress={saveLocation} disabled={busy || postalCode.length < 5 || !city.trim()} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function ProfileInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return <TextInput placeholderTextColor={theme.mcc.textMuted} style={[styles.input, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]} {...props} />;
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.button, { backgroundColor: theme.mcc.accentDeep }, disabled && styles.disabled, pressed && !disabled && styles.pressed]} onPress={onPress} disabled={disabled}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function BirthDatePicker({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { theme } = useTheme();
  const normalizedValue = normalizeBirthDate(value) ?? "";
  const selected = parseIsoDate(normalizedValue) ?? new Date(2000, 0, 1);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"year" | "month" | "day">("year");
  const [draftYear, setDraftYear] = useState(selected.getFullYear());
  const [draftMonth, setDraftMonth] = useState(selected.getMonth());
  const years = buildBirthYears();
  const daysInMonth = new Date(draftYear, draftMonth + 1, 0).getDate();

  function selectDay(day: number) {
    onChangeText(`${draftYear}-${String(draftMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    setOpen(false);
    setStep("year");
  }

  return (
    <View style={styles.calendarRoot}>
      <Pressable style={[styles.input, styles.calendarTrigger, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => setOpen((next) => !next)}>
        <Text style={[styles.calendarTriggerText, { color: normalizedValue ? theme.mcc.textPrimary : theme.mcc.textMuted }]}>{normalizedValue ? formatGermanDate(normalizedValue) : "Geburtstag auswählen"}</Text>
        <Text style={[styles.chevron, { color: theme.mcc.textMuted }]}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.calendarPanelCompact, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceRaised }]}>
          <View style={styles.pickerStepper}>
            {(["year", "month", "day"] as const).map((entry) => {
              const active = step === entry;
              return (
                <Pressable key={entry} style={[styles.stepPill, { backgroundColor: active ? theme.mcc.accentDeep : theme.mcc.surfaceSoft }]} onPress={() => setStep(entry)}>
                  <Text style={[styles.stepText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{entry === "year" ? "Jahr" : entry === "month" ? "Monat" : "Tag"}</Text>
                </Pressable>
              );
            })}
          </View>

          {step === "year" ? (
            <ScrollView style={styles.pickerScroll} contentContainerStyle={styles.pickerGrid} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {years.map((year) => {
                const active = year === draftYear;
                return (
                  <Pressable
                    key={year}
                    style={[styles.pickerCell, active && { backgroundColor: theme.mcc.accentDeep }]}
                    onPress={() => {
                      setDraftYear(year);
                      setStep("month");
                    }}
                  >
                    <Text style={[styles.pickerText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{year}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {step === "month" ? (
            <View style={styles.pickerGrid}>
              {Array.from({ length: 12 }, (_, index) => {
                const active = index === draftMonth;
                return (
                  <Pressable
                    key={index}
                    style={[styles.pickerCell, active && { backgroundColor: theme.mcc.accentDeep }]}
                    onPress={() => {
                      setDraftMonth(index);
                      setStep("day");
                    }}
                  >
                    <Text style={[styles.pickerText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{shortMonthName(index)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === "day" ? (
            <View style={styles.pickerGrid}>
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                const active = normalizedValue === `${draftYear}-${String(draftMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                return (
                  <Pressable key={day} style={[styles.dayPickerCell, active && { backgroundColor: theme.mcc.accentDeep }]} onPress={() => selectDay(day)}>
                    <Text style={[styles.pickerText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function normalizeBirthDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return isRealDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])) ? trimmed : null;
  }

  const germanMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (germanMatch) {
    const day = Number(germanMatch[1]);
    const month = Number(germanMatch[2]);
    const year = Number(germanMatch[3]);
    if (!isRealDate(year, month, day)) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseIsoDate(value: string): Date | null {
  const normalized = normalizeBirthDate(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatGermanDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildBirthYears(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 1919 }, (_, index) => currentYear - index);
}

function shortMonthName(month: number): string {
  return new Date(2000, month, 1).toLocaleDateString("de-DE", { month: "short" }).replace(".", "");
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  success: { color: "#5eead4", fontSize: 14, fontWeight: "900" },
  card: { gap: 10, borderRadius: 22, borderWidth: 1, padding: 16, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 22 },
  cardTitle: { fontSize: 20, fontWeight: "900" },
  label: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 10,
    outlineStyle: "none",
  } as object,
  calendarRoot: { gap: 8 },
  calendarTrigger: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 48 },
  calendarTriggerText: { fontSize: 15, fontWeight: "800" },
  calendarPanelCompact: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 8 },
  pickerStepper: { flexDirection: "row", gap: 5 },
  stepPill: { alignItems: "center", borderRadius: 999, flex: 1, paddingVertical: 7 },
  stepText: { fontSize: 11, fontWeight: "900" },
  pickerScroll: { maxHeight: 118 },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pickerCell: { alignItems: "center", borderRadius: 999, minWidth: 55, paddingHorizontal: 8, paddingVertical: 7 },
  dayPickerCell: { alignItems: "center", borderRadius: 999, width: 32, paddingVertical: 7 },
  pickerText: { fontSize: 12, fontWeight: "900" },
  chevron: { fontSize: 10, fontWeight: "900" },
  button: { alignItems: "center", borderRadius: 18, paddingVertical: 15 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
});
