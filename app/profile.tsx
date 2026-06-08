import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";
import { MotionBackground } from "../src/components/MccDesign";
import { PageHeader } from "../src/components/PageHeader";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { getMyProfile, requestProfileDisplayNameChange, updateProfileDetails, type Row } from "../src/services";

type CountryDialCode = { iso: string; dialCode: string; colors: string[] };

const COUNTRIES: CountryDialCode[] = [
  { iso: "DE", dialCode: "+49", colors: ["#000000", "#dd0000", "#ffce00"] },
  { iso: "AT", dialCode: "+43", colors: ["#ed2939", "#ffffff", "#ed2939"] },
  { iso: "CH", dialCode: "+41", colors: ["#d52b1e", "#ffffff", "#d52b1e"] },
  { iso: "FR", dialCode: "+33", colors: ["#0055a4", "#ffffff", "#ef4135"] },
  { iso: "IT", dialCode: "+39", colors: ["#008c45", "#f4f5f0", "#cd212a"] },
  { iso: "NL", dialCode: "+31", colors: ["#ae1c28", "#ffffff", "#21468b"] },
  { iso: "GB", dialCode: "+44", colors: ["#012169", "#ffffff", "#c8102e"] },
  { iso: "US", dialCode: "+1", colors: ["#b22234", "#ffffff", "#3c3b6e"] },
];

export default function ProfileScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  const [profile, setProfile] = useState<Row<"profiles"> | null>(null);
  const [requestedName, setRequestedName] = useState("");
  const [favoriteSports, setFavoriteSports] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [countryIso, setCountryIso] = useState("DE");
  const [dialCode, setDialCode] = useState("+49");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phonePin, setPhonePin] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
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
      const phone = normalizePhone(result.data.phone ?? user.phone ?? "+49");
      const parsed = splitPhone(phone);
      setProfile(result.data);
      setRequestedName(result.data.display_name);
      setFavoriteSports(result.data.favorite_sports ?? "");
      setBirthDate(result.data.birth_date ?? "");
      setCountryIso(parsed.country.iso);
      setDialCode(parsed.country.dialCode);
      setPhoneLocal(parsed.local);
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

  async function startPhoneChange() {
    if (!profile || busy) return;
    const phone = composePhone(dialCode, phoneLocal);
    clearMessages();

    if (!isValidPhone(phone)) {
      setMessage("Bitte gib eine gültige Telefonnummer ein.");
      return;
    }
    if (!isValidPin(phonePin)) {
      setMessage("Bitte bestätige die Änderung mit deiner aktuellen PIN.");
      return;
    }

    setBusy(true);
    const currentPhone = normalizePhone(profile.phone ?? "");
    let login = await supabase.auth.signInWithPassword({ phone: currentPhone, password: appPinToAuthPassword(currentPhone, phonePin) });
    if (login.error && login.error.message.toLowerCase().includes("invalid login credentials")) {
      login = await supabase.auth.signInWithPassword({ phone: currentPhone, password: phonePin });
    }
    if (login.error) {
      setMessage("Aktuelle PIN stimmt nicht.");
      setBusy(false);
      return;
    }

    const update = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (update.error) {
      setMessage(update.error.message);
      return;
    }
    setPendingPhone(phone);
    setSuccess("SMS-Code wurde gesendet.");
  }

  async function confirmPhoneChange() {
    if (!pendingPhone || !profile || !user || !isValidPin(phonePin)) return;
    setBusy(true);
    clearMessages();

    const verified = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: smsCode.replace(/\D/g, ""),
      type: "phone_change",
    });

    if (verified.error) {
      setMessage(verified.error.message);
      setBusy(false);
      return;
    }

    const password = await supabase.auth.updateUser({ password: appPinToAuthPassword(pendingPhone, phonePin) });
    if (password.error) {
      setMessage(password.error.message);
      setBusy(false);
      return;
    }

    const saved = await supabase.from("profiles").update({ phone: pendingPhone }).eq("id", user.id).select().single();
    if (saved.data) setProfile(saved.data);
    setPendingPhone(null);
    setSmsCode("");
    setPhonePin("");
    setSuccess("Telefonnummer geändert.");
    setBusy(false);
  }

  function clearMessages() {
    setMessage(null);
    setSuccess(null);
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.mcc.background }]}>
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
              <Text style={[styles.cardTitle, { color: theme.mcc.textPrimary }]}>Telefonnummer</Text>
              <Text style={[styles.label, { color: theme.mcc.textSecondary }]}>Aktuell: {normalizePhone(profile?.phone ?? user.phone ?? "") || "Keine Nummer"}</Text>
              <PhoneField countryIso={countryIso} dialCode={dialCode} onCountryChange={setCountryIso} onDialCodeChange={setDialCode} phone={phoneLocal} onPhoneChange={setPhoneLocal} />
              <ProfileInput value={phonePin} onChangeText={(value) => setPhonePin(value.replace(/\D/g, ""))} placeholder="Aktuelle PIN" keyboardType="number-pad" inputMode="numeric" secureTextEntry />
              {!pendingPhone ? <ActionButton label="SMS-Code senden" onPress={startPhoneChange} disabled={busy || !isValidPin(phonePin)} /> : null}
              {pendingPhone ? (
                <>
                  <ProfileInput value={smsCode} onChangeText={(value) => setSmsCode(value.replace(/\D/g, ""))} placeholder="SMS-Code" keyboardType="number-pad" inputMode="numeric" />
                  <ActionButton label="Telefon bestätigen" onPress={confirmPhoneChange} disabled={busy || smsCode.length < 4} />
                </>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function PhoneField({
  countryIso,
  dialCode,
  onCountryChange,
  onDialCodeChange,
  phone,
  onPhoneChange,
}: {
  countryIso: string;
  dialCode: string;
  onCountryChange: (value: string) => void;
  onDialCodeChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const selected = COUNTRIES.find((country) => country.iso === countryIso) ?? COUNTRIES[0];

  function selectCountry(country: CountryDialCode) {
    onCountryChange(country.iso);
    onDialCodeChange(country.dialCode);
    setExpanded(false);
  }

  return (
    <View style={styles.phoneGroup}>
      <View style={styles.phoneRow}>
        <Pressable style={[styles.dialField, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => setExpanded((value) => !value)}>
          <FlagBadge country={selected} />
          <Text style={[styles.dialText, { color: theme.mcc.textPrimary }]}>{dialCode}</Text>
          <Text style={[styles.chevron, { color: theme.mcc.textMuted }]}>{expanded ? "▲" : "▼"}</Text>
        </Pressable>
        <TextInput
          value={phone}
          onChangeText={(value) => onPhoneChange(value.replace(/[^\d\s()+-]/g, ""))}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          placeholder="170 1234567"
          placeholderTextColor={theme.mcc.textMuted}
          style={[styles.input, styles.phoneInput, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
        />
      </View>
      {expanded ? (
        <View style={[styles.countryMenu, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceRaised }]}>
          {COUNTRIES.map((country) => (
            <Pressable key={country.iso} style={[styles.countryOption, { borderBottomColor: theme.mcc.line }]} onPress={() => selectCountry(country)}>
              <FlagBadge country={country} />
              <Text style={[styles.countryIso, { color: theme.mcc.textPrimary }]}>{country.iso}</Text>
              <Text style={[styles.countryDialCode, { color: theme.mcc.textSecondary }]}>{country.dialCode}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FlagBadge({ country }: { country: CountryDialCode }) {
  return (
    <View style={styles.flagBadge}>
      {country.colors.map((color, index) => (
        <View key={`${country.iso}-${color}-${index}`} style={[styles.flagStripe, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function ProfileInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return <TextInput placeholderTextColor={theme.mcc.textMuted} style={[styles.input, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]} {...props} />;
}

function CalendarInput({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  const { theme } = useTheme();
  const normalizedValue = normalizeBirthDate(value) ?? "";
  const selected = parseIsoDate(normalizedValue) ?? new Date(2000, 0, 1);
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(selected.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(selected.getMonth());
  const days = buildCalendarDays(visibleYear, visibleMonth);

  function moveMonth(delta: number) {
    const next = new Date(visibleYear, visibleMonth + delta, 1);
    setVisibleYear(next.getFullYear());
    setVisibleMonth(next.getMonth());
  }

  function selectDay(day: number) {
    onChangeText(`${visibleYear}-${String(visibleMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <View style={styles.calendarRoot}>
      <Pressable style={[styles.input, styles.calendarTrigger, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => setOpen((next) => !next)}>
        <Text style={[styles.calendarTriggerText, { color: normalizedValue ? theme.mcc.textPrimary : theme.mcc.textMuted }]}>{normalizedValue ? formatGermanDate(normalizedValue) : "Geburtstag auswählen"}</Text>
        <Text style={[styles.chevron, { color: theme.mcc.textMuted }]}>{open ? "▲" : "▼"}</Text>
      </Pressable>

      {open ? (
        <View style={[styles.calendarPanel, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceRaised }]}>
          <View style={styles.calendarHeader}>
            <Pressable style={[styles.calendarNav, { backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => moveMonth(-1)}>
              <Text style={[styles.calendarNavText, { color: theme.mcc.textPrimary }]}>‹</Text>
            </Pressable>
            <Text style={[styles.calendarTitle, { color: theme.mcc.textPrimary }]}>{monthTitle(visibleYear, visibleMonth)}</Text>
            <Pressable style={[styles.calendarNav, { backgroundColor: theme.mcc.surfaceSoft }]} onPress={() => moveMonth(1)}>
              <Text style={[styles.calendarNavText, { color: theme.mcc.textPrimary }]}>›</Text>
            </Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
              <Text key={day} style={[styles.weekday, { color: theme.mcc.textMuted }]}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              const active = day > 0 && normalizedValue === `${visibleYear}-${String(visibleMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              return day > 0 ? (
                <Pressable key={`${visibleYear}-${visibleMonth}-${day}`} style={[styles.dayCell, active && { backgroundColor: theme.mcc.accentDeep }]} onPress={() => selectDay(day)}>
                  <Text style={[styles.dayText, { color: active ? "#FFFFFF" : theme.mcc.textPrimary }]}>{day}</Text>
                </Pressable>
              ) : (
                <View key={`empty-${index}`} style={styles.dayCell} />
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
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

function splitPhone(value: string): { country: CountryDialCode; local: string } {
  const normalized = normalizePhone(value);
  const country = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length).find((entry) => normalized.startsWith(entry.dialCode)) ?? COUNTRIES[0];
  const local = normalized.startsWith(country.dialCode) ? normalized.slice(country.dialCode.length).replace(/^0+/, "") : normalized.replace(/^\+/, "");
  return { country, local };
}

function composePhone(dialCode: string, localPhone: string): string {
  let compactPhone = localPhone.trim().replace(/[^\d+]/g, "");
  if (compactPhone.startsWith("+") || compactPhone.startsWith("00")) {
    return normalizePhone(compactPhone);
  }

  const dialDigits = dialCode.replace(/\D/g, "");
  if (compactPhone.startsWith(dialDigits)) {
    compactPhone = compactPhone.slice(dialDigits.length);
  }
  if (compactPhone.startsWith("0")) {
    compactPhone = compactPhone.slice(1);
  }

  return normalizePhone(`${normalizeDialCode(dialCode)}${compactPhone}`);
}

function normalizeDialCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits ? `+${digits}` : "+";
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("49")) return `+${compact}`;
  if (compact.startsWith("0")) return `+49${compact.slice(1)}`;
  if (/^[1-9]\d{5,11}$/.test(compact)) return `+49${compact}`;
  return compact ? `+${compact}` : "";
}

function isValidPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function isValidPin(pin: string): boolean {
  return /^\d{4,16}$/.test(pin);
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

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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

function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function buildCalendarDays(year: number, month: number): number[] {
  const firstDay = new Date(year, month, 1).getDay();
  const leadingDays = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: leadingDays }, () => 0);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(0);
  }

  return days;
}

function buildBirthYears(): number[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 1919 }, (_, index) => currentYear - index);
}

function shortMonthName(month: number): string {
  return new Date(2000, month, 1).toLocaleDateString("de-DE", { month: "short" }).replace(".", "");
}

function appPinToAuthPassword(phoneValue: string, pinValue: string): string {
  const phoneTail = phoneValue.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `mcc-${phoneTail}-${pinValue}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: "900" },
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
  calendarPanel: { borderRadius: 22, borderWidth: 1, gap: 12, padding: 12 },
  calendarHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  calendarTitle: { flex: 1, fontSize: 16, fontWeight: "900", textAlign: "center", textTransform: "capitalize" },
  calendarNav: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", width: 38 },
  calendarNavText: { fontSize: 24, fontWeight: "900", lineHeight: 26 },
  weekdayRow: { flexDirection: "row" },
  weekday: { flex: 1, fontSize: 11, fontWeight: "900", textAlign: "center", textTransform: "uppercase" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { alignItems: "center", aspectRatio: 1, borderRadius: 999, justifyContent: "center", width: `${100 / 7}%` },
  dayText: { fontSize: 14, fontWeight: "900" },
  phoneGroup: { gap: 8 },
  phoneRow: { flexDirection: "row", gap: 10 },
  dialField: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 54,
    paddingHorizontal: 12,
  },
  phoneInput: { flex: 1 },
  dialText: { fontSize: 16, fontWeight: "900" },
  chevron: { fontSize: 10, fontWeight: "900" },
  flagBadge: {
    width: 28,
    height: 19,
    overflow: "hidden",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  flagStripe: { flex: 1 },
  countryMenu: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  countryOption: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  countryIso: { flex: 1, fontSize: 15, fontWeight: "900" },
  countryDialCode: { fontSize: 15, fontWeight: "800" },
  button: { alignItems: "center", borderRadius: 18, paddingVertical: 15 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
});
