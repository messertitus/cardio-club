import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, ErrorText } from "../src/components/ui";
import { isSupabaseConfigured, supabase } from "../src/lib/supabase";
import { consumeInvitationCode, ensureProfile, validateInvitationCode } from "../src/services";

const PENDING_INVITE_KEY = "mcc.pendingInviteCode";
const PENDING_DISPLAY_NAME_KEY = "mcc.pendingDisplayName";
const PENDING_PHONE_KEY = "mcc.pendingPhone";

type AuthStep = "login" | "invite" | "signup" | "sms";

export default function AuthScreen() {
  const [step, setStep] = useState<AuthStep>("login");
  const [inviteCode, setInviteCode] = useState("");
  const [verifiedInviteCode, setVerifiedInviteCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedPhone = normalizePhone(phone);
  const inviteValue = inviteCode.replace(/\D/g, "");
  const title = useMemo(() => {
    if (step === "signup") return "Fast drin.";
    if (step === "sms") return "Code bestätigen.";
    if (step === "invite") return "Dein Zugang.";
    return "Willkommen zurück.";
  }, [step]);

  async function verifyInvite() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    if (inviteValue.length < 8) {
      setMessage("Gib deinen Einladungscode ein.");
      setLoading(false);
      return;
    }

    const codeResult = await validateInvitationCode(supabase, inviteValue);

    if (codeResult.error) {
      setMessage(codeResult.error.message);
      setLoading(false);
      return;
    }

    if (!codeResult.data.valid) {
      setMessage("Dieser Code ist ungültig oder wurde bereits verwendet.");
      setLoading(false);
      return;
    }

    setVerifiedInviteCode(inviteValue);
    setSuccessMessage("Code bestätigt.");
    setStep("signup");
    setLoading(false);
  }

  async function submitSignup() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    if (!verifiedInviteCode) {
      setMessage("Bitte prüfe zuerst deinen Einladungscode.");
      setStep("invite");
      setLoading(false);
      return;
    }

    if (!displayName.trim()) {
      setMessage("Wie sollen wir dich im Club nennen?");
      setLoading(false);
      return;
    }

    if (!isValidPhone(normalizedPhone)) {
      setMessage("Bitte gib deine Telefonnummer mit Ländervorwahl ein.");
      setLoading(false);
      return;
    }

    if (!isValidPin(pin)) {
      setMessage("Bitte nutze eine PIN mit 6 bis 12 Ziffern.");
      setLoading(false);
      return;
    }

    await AsyncStorage.setItem(PENDING_INVITE_KEY, verifiedInviteCode);
    await AsyncStorage.setItem(PENDING_DISPLAY_NAME_KEY, displayName.trim());
    await AsyncStorage.setItem(PENDING_PHONE_KEY, normalizedPhone);

    const authResult = await supabase.auth.signUp({
      phone: normalizedPhone,
      password: pin,
      options: { data: { display_name: displayName.trim() } },
    });

    if (authResult.error) {
      setMessage(authResult.error.message);
      setLoading(false);
      return;
    }

    if (!authResult.data.session) {
      setSuccessMessage("Wir haben dir einen SMS-Code geschickt.");
      setStep("sms");
      setLoading(false);
      return;
    }

    await finishAuthenticatedFlow(authResult.data.user?.id, normalizedPhone);
  }

  async function submitSmsCode() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    const pendingPhone = (await AsyncStorage.getItem(PENDING_PHONE_KEY)) ?? normalizedPhone;
    if (!isValidPhone(pendingPhone) || smsCode.replace(/\D/g, "").length < 4) {
      setMessage("Bitte gib den SMS-Code ein.");
      setLoading(false);
      return;
    }

    const result = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: smsCode.replace(/\D/g, ""),
      type: "sms",
    });

    if (result.error) {
      setMessage(result.error.message);
      setLoading(false);
      return;
    }

    await finishAuthenticatedFlow(result.data.user?.id, pendingPhone);
  }

  async function submitLogin() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    if (!isValidPhone(normalizedPhone)) {
      setMessage("Bitte gib deine Telefonnummer ein.");
      setLoading(false);
      return;
    }

    if (!isValidPin(pin)) {
      setMessage("Bitte nutze eine PIN mit 6 bis 12 Ziffern.");
      setLoading(false);
      return;
    }

    const authResult = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password: pin });

    if (authResult.error) {
      setMessage(authResult.error.message);
      setLoading(false);
      return;
    }

    await finishAuthenticatedFlow(authResult.data.user?.id, normalizedPhone);
  }

  async function finishAuthenticatedFlow(userId?: string, phoneValue?: string) {
    if (!userId) {
      setMessage("Login erfolgreich, aber der Nutzer konnte nicht geladen werden.");
      setLoading(false);
      return;
    }

    const pendingInvite = await AsyncStorage.getItem(PENDING_INVITE_KEY);

    if (pendingInvite) {
      const consumeResult = await consumeInvitationCode(supabase, pendingInvite);

      if (consumeResult.error || !consumeResult.data.consumed) {
        await supabase.auth.signOut();
        setMessage("Der Einladungscode konnte nicht eingelöst werden. Bitte fordere einen neuen Code an.");
        setLoading(false);
        return;
      }

      await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    }

    const pendingDisplayName = await AsyncStorage.getItem(PENDING_DISPLAY_NAME_KEY);
    const pendingPhone = phoneValue ?? (await AsyncStorage.getItem(PENDING_PHONE_KEY));
    const profile = await ensureProfile(supabase, {
      userId,
      displayName: displayName.trim() || pendingDisplayName || undefined,
      phone: pendingPhone,
    });

    if (profile.error) {
      setMessage(profile.error.message);
      setLoading(false);
      return;
    }

    await AsyncStorage.removeItem(PENDING_DISPLAY_NAME_KEY);
    await AsyncStorage.removeItem(PENDING_PHONE_KEY);
    setLoading(false);
    router.replace("/");
  }

  function switchStep(nextStep: AuthStep) {
    setStep(nextStep);
    setMessage(null);
    setSuccessMessage(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <View style={styles.shell}>
          <AnimatedPanel step={step}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>MCC</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {step === "invite"
                ? "Gib deine lange Einladungs-PIN ein. Jeder Code funktioniert nur einmal."
                : step === "signup"
                  ? "Name, Telefonnummer und eigene PIN. Die Nummer ist dein eindeutiger Zugang."
                  : step === "sms"
                    ? "Bestätige deine Telefonnummer mit dem Code aus der SMS."
                    : "Telefonnummer und PIN reichen."}
            </Text>

            {!isSupabaseConfigured ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Supabase fehlt</Text>
                <Text style={styles.noticeBody}>Setze `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.</Text>
              </View>
            ) : null}

            {step === "login" ? (
              <View style={styles.form}>
                <SoftField label="Telefonnummer" value={phone} onChangeText={setPhone} keyboardType="phone-pad" inputMode="tel" placeholder="+49 170 1234567" />
                <SoftField label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" inputMode="numeric" placeholder="Deine PIN" />
                <ErrorText>{message}</ErrorText>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Logge ein..." : "Einloggen"} onPress={submitLogin} disabled={loading || !normalizedPhone || !pin} />
                <Pressable onPress={() => switchStep("invite")} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Ich habe einen Einladungscode</Text>
                </Pressable>
              </View>
            ) : null}

            {step === "invite" ? (
              <View style={styles.form}>
                <SoftField
                  label="Einladungs-PIN"
                  value={inviteCode}
                  onChangeText={(value) => setInviteCode(value.replace(/\D/g, "").slice(0, 12))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="12-stelliger Code"
                />
                <ErrorText>{message}</ErrorText>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Prüfe..." : "Code prüfen"} onPress={verifyInvite} disabled={loading || inviteValue.length < 8} />
                <Pressable onPress={() => switchStep("login")} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Zurück zum Login</Text>
                </Pressable>
              </View>
            ) : null}

            {step === "signup" ? (
              <View style={styles.form}>
                {verifiedInviteCode ? <Text style={styles.success}>Einladung bestätigt</Text> : null}
                <SoftField label="Name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" placeholder="Dein Name" />
                <SoftField label="Telefonnummer" value={phone} onChangeText={setPhone} keyboardType="phone-pad" inputMode="tel" placeholder="+49 170 1234567" />
                <SoftField label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" inputMode="numeric" placeholder="6 bis 12 Ziffern" />
                <Text style={styles.helper}>Die Telefonnummer wird per SMS bestätigt und ist dein eindeutiger Login.</Text>
                <ErrorText>{message}</ErrorText>
                <Button
                  label={loading ? "Erstelle..." : "SMS-Code senden"}
                  onPress={submitSignup}
                  disabled={loading || !isValidPhone(normalizedPhone) || !pin || !displayName.trim()}
                />
                <Pressable onPress={() => switchStep("invite")} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Anderen Code eingeben</Text>
                </Pressable>
              </View>
            ) : null}

            {step === "sms" ? (
              <View style={styles.form}>
                <SoftField
                  label="SMS-Code"
                  value={smsCode}
                  onChangeText={(value) => setSmsCode(value.replace(/\D/g, "").slice(0, 8))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="Code"
                />
                <ErrorText>{message}</ErrorText>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Bestätige..." : "Telefon bestätigen"} onPress={submitSmsCode} disabled={loading || smsCode.length < 4} />
              </View>
            ) : null}
          </AnimatedPanel>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnimatedPanel({ children, step }: { children: React.ReactNode; step: AuthStep }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, step, translateY]);

  return <Animated.View style={[styles.panel, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function SoftField({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#728197" style={styles.input} {...props} />
    </View>
  );
}

function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+49${compact.slice(1)}`;
  return compact ? `+${compact}` : "";
}

function isValidPhone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function isValidPin(pin: string): boolean {
  return /^\d{6,12}$/.test(pin);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  keyboard: { flex: 1 },
  shell: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  panel: {
    width: "100%",
    maxWidth: 520,
    gap: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(12,17,27,0.94)",
    padding: 22,
    shadowColor: "#4da3ff",
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
  },
  logoMark: { alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: 20, backgroundColor: "#ffffff" },
  logoText: { color: "#05070b", fontSize: 17, fontWeight: "900", letterSpacing: 0 },
  title: { color: "#ffffff", fontSize: 36, fontWeight: "900", letterSpacing: 0, lineHeight: 40 },
  subtitle: { color: "#9aa7b8", fontSize: 16, lineHeight: 24 },
  form: { gap: 14 },
  field: { gap: 7 },
  label: { color: "#edf4ff", fontSize: 13, fontWeight: "900" },
  input: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 18,
    paddingHorizontal: 15,
    outlineStyle: "none",
  } as object,
  helper: { color: "#9aa7b8", fontSize: 13, lineHeight: 19 },
  success: { color: "#5eead4", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  notice: { gap: 5, borderRadius: 18, backgroundColor: "rgba(77,163,255,0.14)", padding: 12 },
  noticeTitle: { color: "#d9ecff", fontSize: 14, fontWeight: "900" },
  noticeBody: { color: "#b8d8ff", fontSize: 13, lineHeight: 19 },
  textButton: { alignSelf: "center", padding: 8 },
  textButtonLabel: { color: "#8fc7ff", fontSize: 14, fontWeight: "900" },
});
