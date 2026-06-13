import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { MccBadge, MccButton, MccCard, MccCardTitle, MccScreen, ScreenLoader } from "../src/components/MccDesign";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { APP_VERSION } from "../src/lib/appInfo";
import { supabase } from "../src/lib/supabase";
import { getMyProfile, SCREEN_EVENTS, type Row } from "../src/services";
import { useScreenView } from "../src/components/useScreenView";

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

export default function SettingsScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
  useScreenView(SCREEN_EVENTS.settings);
  const [profile, setProfile] = useState<Row<"profiles"> | null>(null);

  // PIN change
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // Phone change
  const [countryIso, setCountryIso] = useState("DE");
  const [dialCode, setDialCode] = useState("+49");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phonePin, setPhonePin] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phoneSuccess, setPhoneSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const result = await getMyProfile(supabase, user.id);
      if (result.error || !result.data) return;
      const phone = normalizePhone(result.data.phone ?? user.phone ?? "+49");
      const parsed = splitPhone(phone);
      setProfile(result.data);
      setCountryIso(parsed.country.iso);
      setDialCode(parsed.country.dialCode);
      setPhoneLocal(parsed.local);
    }
    void load();
  }, [user]);

  async function changePin() {
    if (!user || pinBusy) return;
    setPinBusy(true);
    setPinMessage(null);
    setPinSuccess(null);

    if (!isValidPin(currentPin) || !isValidPin(nextPin)) {
      setPinMessage("PINs müssen mindestens 4 Ziffern haben.");
      setPinBusy(false);
      return;
    }
    if (nextPin !== confirmPin) {
      setPinMessage("Die neue PIN stimmt nicht überein.");
      setPinBusy(false);
      return;
    }

    const profileResult = await getMyProfile(supabase, user.id);
    const phone = profileResult.data?.phone ?? user.phone ?? null;
    if (profileResult.error || !phone) {
      setPinMessage(profileResult.error?.message ?? "Telefonnummer konnte nicht geladen werden.");
      setPinBusy(false);
      return;
    }

    let login = await supabase.auth.signInWithPassword({ phone, password: appPinToAuthPassword(phone, currentPin) });
    if (login.error && login.error.message.toLowerCase().includes("invalid login credentials")) {
      login = await supabase.auth.signInWithPassword({ phone, password: currentPin });
    }
    if (login.error) {
      setPinMessage("Aktuelle PIN stimmt nicht.");
      setPinBusy(false);
      return;
    }

    const update = await supabase.auth.updateUser({ password: appPinToAuthPassword(phone, nextPin) });
    if (update.error) {
      setPinMessage(update.error.message);
      setPinBusy(false);
      return;
    }

    setCurrentPin("");
    setNextPin("");
    setConfirmPin("");
    setPinSuccess("PIN geändert.");
    setPinBusy(false);
  }

  async function startPhoneChange() {
    if (!profile || phoneBusy) return;
    const phone = composePhone(dialCode, phoneLocal);
    setPhoneMessage(null);
    setPhoneSuccess(null);

    if (!isValidPhone(phone)) {
      setPhoneMessage("Bitte gib eine gültige Telefonnummer ein.");
      return;
    }
    if (!isValidPin(phonePin)) {
      setPhoneMessage("Bitte bestätige die Änderung mit deiner aktuellen PIN.");
      return;
    }

    setPhoneBusy(true);
    const currentPhone = normalizePhone(profile.phone ?? "");
    let login = await supabase.auth.signInWithPassword({ phone: currentPhone, password: appPinToAuthPassword(currentPhone, phonePin) });
    if (login.error && login.error.message.toLowerCase().includes("invalid login credentials")) {
      login = await supabase.auth.signInWithPassword({ phone: currentPhone, password: phonePin });
    }
    if (login.error) {
      setPhoneMessage("Aktuelle PIN stimmt nicht.");
      setPhoneBusy(false);
      return;
    }

    const update = await supabase.auth.updateUser({ phone });
    setPhoneBusy(false);
    if (update.error) {
      setPhoneMessage(update.error.message);
      return;
    }
    setPendingPhone(phone);
    setPhoneSuccess("SMS-Code wurde gesendet.");
  }

  async function confirmPhoneChange() {
    if (!pendingPhone || !profile || !user || !isValidPin(phonePin)) return;
    setPhoneBusy(true);
    setPhoneMessage(null);
    setPhoneSuccess(null);

    const verified = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: smsCode.replace(/\D/g, ""),
      type: "phone_change",
    });
    if (verified.error) {
      setPhoneMessage(verified.error.message);
      setPhoneBusy(false);
      return;
    }

    const password = await supabase.auth.updateUser({ password: appPinToAuthPassword(pendingPhone, phonePin) });
    if (password.error) {
      setPhoneMessage(password.error.message);
      setPhoneBusy(false);
      return;
    }

    const saved = await supabase.from("profiles").update({ phone: pendingPhone }).eq("id", user.id).select().single();
    if (saved.data) setProfile(saved.data);
    setPendingPhone(null);
    setSmsCode("");
    setPhonePin("");
    setPhoneSuccess("Telefonnummer geändert.");
    setPhoneBusy(false);
  }

  if (loading)
    return (
      <MccScreen>
        <ScreenLoader />
      </MccScreen>
    );
  if (!user) return <Redirect href="/auth" />;

  return (
    <View style={styles.shell}>
      <KeyboardAvoidingView behavior={undefined} style={styles.shell}>
        <MccScreen title="Einstellungen" kicker="Konto" subtitle="PIN und Telefonnummer verwalten." bottomInset={96}>
          <MccCard accent>
            <MccBadge icon="shield-lock-outline">Sicherheit</MccBadge>
            <MccCardTitle>PIN ändern</MccCardTitle>
            {pinMessage ? (
              <MccBadge tone="danger" icon="alert-circle-outline">
                {pinMessage}
              </MccBadge>
            ) : null}
            {pinSuccess ? (
              <MccBadge tone="success" icon="check-circle-outline">
                {pinSuccess}
              </MccBadge>
            ) : null}
            <PinInput value={currentPin} onChangeText={setCurrentPin} placeholder="Aktuelle PIN" />
            <PinInput value={nextPin} onChangeText={setNextPin} placeholder="Neue PIN" showFeedback />
            <PinInput value={confirmPin} onChangeText={setConfirmPin} placeholder="Neue PIN wiederholen" showFeedback />
            <MccButton
              label={pinBusy ? "Speichere…" : "PIN speichern"}
              icon="shield-check-outline"
              onPress={changePin}
              disabled={!canSubmitPin(currentPin, nextPin, confirmPin) || pinBusy}
            />
          </MccCard>

          <MccCard>
            <MccBadge icon="phone-outline">Telefonnummer</MccBadge>
            <MccCardTitle>Telefonnummer ändern</MccCardTitle>
            <Text style={[styles.label, { color: theme.mcc.textSecondary }]}>
              Aktuell: {normalizePhone(profile?.phone ?? user.phone ?? "") || "Keine Nummer"}
            </Text>
            {phoneMessage ? (
              <MccBadge tone="danger" icon="alert-circle-outline">
                {phoneMessage}
              </MccBadge>
            ) : null}
            {phoneSuccess ? (
              <MccBadge tone="success" icon="check-circle-outline">
                {phoneSuccess}
              </MccBadge>
            ) : null}
            <PhoneField countryIso={countryIso} dialCode={dialCode} onCountryChange={setCountryIso} onDialCodeChange={setDialCode} phone={phoneLocal} onPhoneChange={setPhoneLocal} />
            <SettingsInput value={phonePin} onChangeText={(value) => setPhonePin(value.replace(/\D/g, ""))} placeholder="Aktuelle PIN" keyboardType="number-pad" inputMode="numeric" secureTextEntry />
            {!pendingPhone ? (
              <MccButton label={phoneBusy ? "Sende…" : "SMS-Code senden"} icon="message-text-outline" onPress={startPhoneChange} disabled={phoneBusy || !isValidPin(phonePin)} />
            ) : (
              <>
                <SettingsInput value={smsCode} onChangeText={(value) => setSmsCode(value.replace(/\D/g, ""))} placeholder="SMS-Code" keyboardType="number-pad" inputMode="numeric" />
                <MccButton label={phoneBusy ? "Bestätige…" : "Telefon bestätigen"} icon="check-circle-outline" onPress={confirmPhoneChange} disabled={phoneBusy || smsCode.length < 4} />
              </>
            )}
          </MccCard>

          <Text style={[styles.version, { color: theme.mcc.textMuted }]}>Messers Cardio Club · Version {APP_VERSION}</Text>
        </MccScreen>
      </KeyboardAvoidingView>
      <BottomNav active="menu" />
    </View>
  );
}

function PinInput({ showFeedback, style, ...props }: React.ComponentProps<typeof TextInput> & { showFeedback?: boolean }) {
  const { theme } = useTheme();
  const value = String(props.value ?? "");
  const feedbackColor = !showFeedback || value.length === 0 ? theme.mcc.line : value.length >= 4 ? theme.mcc.success : theme.mcc.danger;
  return (
    <TextInput
      keyboardType="number-pad"
      inputMode="numeric"
      secureTextEntry
      maxLength={16}
      placeholderTextColor={theme.mcc.textMuted}
      style={[styles.input, { borderColor: feedbackColor, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }, style]}
      {...props}
      onChangeText={(text) => props.onChangeText?.(text.replace(/\D/g, ""))}
    />
  );
}

function SettingsInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.mcc.textMuted}
      style={[styles.input, { borderColor: theme.mcc.line, backgroundColor: theme.mcc.surfaceSoft, color: theme.mcc.textPrimary }]}
      {...props}
    />
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

function canSubmitPin(currentPin: string, nextPin: string, confirmPin: string): boolean {
  return isValidPin(currentPin) && isValidPin(nextPin) && nextPin === confirmPin;
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

function appPinToAuthPassword(phoneValue: string, pinValue: string): string {
  const phoneTail = phoneValue.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `mcc-${phoneTail}-${pinValue}`;
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  version: { fontSize: 12, fontWeight: "700", textAlign: "center", paddingTop: 4 },
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
  phoneGroup: { gap: 8 },
  phoneRow: { flexDirection: "row", gap: 10 },
  dialField: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 7, minHeight: 54, paddingHorizontal: 12 },
  phoneInput: { flex: 1 },
  dialText: { fontSize: 16, fontWeight: "900" },
  chevron: { fontSize: 10, fontWeight: "900" },
  flagBadge: { width: 28, height: 19, overflow: "hidden", borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  flagStripe: { flex: 1 },
  countryMenu: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  countryOption: { alignItems: "center", borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  countryIso: { flex: 1, fontSize: 15, fontWeight: "900" },
  countryDialCode: { fontSize: 15, fontWeight: "800" },
});
