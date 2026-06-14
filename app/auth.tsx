import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthIntro } from "../src/components/AuthIntro";
import { InlineError } from "../src/components/MccDesign";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { Button } from "../src/components/ui";
import { useTheme } from "../src/context/ThemeContext";
import { isSupabaseConfigured, supabase } from "../src/lib/supabase";
import { consumeInvitationCode, ensureProfile, getPublicMemberCount, validateInvitationCode } from "../src/services";

const PENDING_INVITE_KEY = "mcc.pendingInviteCode";
const PENDING_DISPLAY_NAME_KEY = "mcc.pendingDisplayName";
const PENDING_PHONE_KEY = "mcc.pendingPhone";
const PENDING_RESET_PHONE_KEY = "mcc.pendingResetPhone";

type AuthStep = "login" | "invite" | "signup" | "sms" | "resetPhone" | "resetSms" | "resetPin";
type CountryDialCode = { iso: string; dialCode: string };
type FlagPattern =
  | { kind: "stripes"; direction: "horizontal" | "vertical"; colors: string[] }
  | { kind: "cross"; background: string; cross: string }
  | { kind: "nordic"; background: string; outer: string; inner: string };

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const [step, setStep] = useState<AuthStep>("login");
  const [inviteCode, setInviteCode] = useState("");
  const [verifiedInviteCode, setVerifiedInviteCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [countryIso, setCountryIso] = useState(() => getDefaultCountryIso());
  const [dialCode, setDialCode] = useState(() => getDialCodeForCountry(getDefaultCountryIso()));
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // Count down the resend cooldown once per second. Supabase throttles repeated
  // SMS sends server-side, so we gate the button locally to set expectations and
  // avoid silently-dropped resends.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Aggregate member count for the (logged-out) intro lockup. Best-effort.
  useEffect(() => {
    let active = true;
    void getPublicMemberCount(supabase).then((count) => {
      if (active) setMemberCount(count);
    });
    return () => {
      active = false;
    };
  }, []);

  const normalizedPhone = composePhone(dialCode, phone);
  const compactPhoneField = width < 390;
  const inviteValue = inviteCode.replace(/\D/g, "");
  const title = useMemo(() => {
    if (step === "signup") return "Fast drin.";
    if (step === "sms") return "Code bestätigen.";
    if (step === "invite") return "Dein Zugang.";
    if (step === "resetPhone") return "PIN vergessen?";
    if (step === "resetSms") return "Code bestätigen.";
    if (step === "resetPin") return "Neue PIN.";
    return "Willkommen zurück.";
  }, [step]);
  const subtitle = useMemo(() => {
    if (step === "invite") return "Einladungscode eingeben.";
    if (step === "signup") return "Profil und App-PIN erstellen.";
    if (step === "sms") return "SMS-Code bestätigen.";
    if (step === "resetPhone") return "Wir senden dir einen SMS-Code.";
    if (step === "resetSms") return "Danach kannst du deine PIN neu setzen.";
    if (step === "resetPin") return "Mindestens 4 Ziffern.";
    return null;
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
      setMessage("Bitte nutze eine App-PIN mit mindestens 4 Ziffern.");
      setLoading(false);
      return;
    }

    // Re-check the invite right before creating the account. The code may have
    // been used or revoked since the invite step; verifying now avoids creating
    // an auth user (and burning an SMS) that can never finish onboarding —
    // exactly the orphaned, phone-confirmed-but-membership-less state that then
    // blocks the number from re-registering.
    const inviteStillValid = await validateInvitationCode(supabase, verifiedInviteCode);
    if (inviteStillValid.error || !inviteStillValid.data.valid) {
      setMessage("Dieser Einladungscode ist nicht mehr gültig. Bitte fordere einen neuen Code an.");
      setVerifiedInviteCode(null);
      setInviteCode("");
      setStep("invite");
      setLoading(false);
      return;
    }

    await AsyncStorage.setItem(PENDING_INVITE_KEY, verifiedInviteCode);
    await AsyncStorage.setItem(PENDING_DISPLAY_NAME_KEY, displayName.trim());
    await AsyncStorage.setItem(PENDING_PHONE_KEY, normalizedPhone);

    const authResult = await supabase.auth.signUp({
      phone: normalizedPhone,
      password: appPinToAuthPassword(normalizedPhone, pin),
      options: { data: { display_name: displayName.trim() } },
    });

    if (authResult.error) {
      setMessage(mapAuthError(authResult.error.message));
      setLoading(false);
      return;
    }

    if (!authResult.data.session) {
      // Supabase obfuscates signUp for an already-registered phone: it returns a
      // success-shaped response with an EMPTY identities array and does NOT send
      // a fresh SMS. Detect that instead of falsely claiming a code went out.
      const alreadyRegistered = (authResult.data.user?.identities?.length ?? 0) === 0;
      if (alreadyRegistered) {
        // Trigger the confirmation SMS explicitly (signUp won't for an existing
        // account). If that fails, the number is likely already verified.
        const resendResult = await supabase.auth.resend({ type: "sms", phone: normalizedPhone });
        if (resendResult.error) {
          const rate = retryAfterSeconds(resendResult.error.message);
          if (rate !== null || isSmsRateLimitError(resendResult.error.message)) {
            setMessage(mapAuthError(resendResult.error.message));
            setResendCooldown(rate ?? 60);
          } else {
            setMessage("Diese Telefonnummer ist bereits registriert. Bitte melde dich an oder nutze „PIN vergessen“.");
          }
          setLoading(false);
          return;
        }
      }
      setSuccessMessage("Wir haben dir einen SMS-Code geschickt.");
      setStep("sms");
      setResendCooldown(60);
      setLoading(false);
      return;
    }

    await finishAuthenticatedFlow(authResult.data.user?.id, normalizedPhone);
  }

  async function resendSmsCode() {
    if (resendCooldown > 0) return;
    setResending(true);
    setMessage(null);
    setSuccessMessage(null);

    const pendingPhone = (await AsyncStorage.getItem(PENDING_PHONE_KEY)) ?? normalizedPhone;

    if (!isValidPhone(pendingPhone)) {
      setMessage("Bitte gehe kurz zurück und prüfe deine Telefonnummer.");
      setResending(false);
      return;
    }

    const result = await supabase.auth.resend({
      type: "sms",
      phone: pendingPhone,
    });

    if (result.error) {
      setMessage(mapAuthError(result.error.message));
      setResending(false);
      // If we were throttled, keep the button disabled for the suggested window.
      setResendCooldown(retryAfterSeconds(result.error.message) ?? 60);
      return;
    }

    setSuccessMessage("Neuer SMS-Code ist unterwegs. Das kann eine Minute dauern.");
    setResendCooldown(60);
    setResending(false);
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
      setMessage(mapAuthError(result.error.message));
      setSmsCode("");
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
      setMessage("Bitte nutze deine App-PIN mit mindestens 4 Ziffern.");
      setLoading(false);
      return;
    }

    let authResult = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password: appPinToAuthPassword(normalizedPhone, pin) });

    if (authResult.error && isInvalidLoginError(authResult.error.message)) {
      authResult = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password: pin });
    }

    if (authResult.error) {
      setMessage(mapAuthError(authResult.error.message));
      setLoading(false);
      return;
    }

    await finishAuthenticatedFlow(authResult.data.user?.id, normalizedPhone);
  }

  async function startPinReset() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    if (!isValidPhone(normalizedPhone)) {
      setMessage("Bitte gib deine Telefonnummer ein.");
      setLoading(false);
      return;
    }

    const result = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: { shouldCreateUser: false, channel: "sms" },
    });

    if (result.error && !isOtpSignupBlockedError(result.error.message)) {
      setMessage(mapAuthError(result.error.message));
      setLoading(false);
      return;
    }

    await AsyncStorage.setItem(PENDING_RESET_PHONE_KEY, normalizedPhone);
    setSmsCode("");
    setPin("");
    setSuccessMessage(`Falls ein Account mit ${normalizedPhone} besteht, schicken wir dir einen SMS-Code.`);
    setStep("resetSms");
    setLoading(false);
  }

  async function verifyPinResetSmsCode() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    const pendingPhone = (await AsyncStorage.getItem(PENDING_RESET_PHONE_KEY)) ?? normalizedPhone;
    const token = smsCode.replace(/\D/g, "");

    if (!isValidPhone(pendingPhone) || token.length < 4) {
      setMessage("Bitte gib den SMS-Code ein.");
      setLoading(false);
      return;
    }

    const result = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token,
      type: "sms",
    });

    if (result.error) {
      setMessage(mapAuthError(result.error.message));
      setLoading(false);
      return;
    }

    setPin("");
    setSuccessMessage("Telefon bestätigt.");
    setStep("resetPin");
    setLoading(false);
  }

  async function submitPinReset() {
    setLoading(true);
    setMessage(null);
    setSuccessMessage(null);

    const pendingPhone = (await AsyncStorage.getItem(PENDING_RESET_PHONE_KEY)) ?? normalizedPhone;

    if (!isValidPhone(pendingPhone)) {
      setMessage("Telefonnummer konnte nicht geprüft werden.");
      setLoading(false);
      return;
    }

    if (!isValidPin(pin)) {
      setMessage("Bitte nutze eine App-PIN mit mindestens 4 Ziffern.");
      setLoading(false);
      return;
    }

    const samePinCheck = await supabase.auth.signInWithPassword({ phone: pendingPhone, password: appPinToAuthPassword(pendingPhone, pin) });
    if (!samePinCheck.error) {
      setMessage("Bitte wähle eine neue PIN. Diese PIN ist bereits aktiv.");
      setLoading(false);
      return;
    }

    const sameLegacyPinCheck = await supabase.auth.signInWithPassword({ phone: pendingPhone, password: pin });
    if (!sameLegacyPinCheck.error) {
      setMessage("Bitte wähle eine neue PIN. Diese PIN ist bereits aktiv.");
      setLoading(false);
      return;
    }

    const session = await supabase.auth.getSession();
    const update = await supabase.auth.updateUser({ password: appPinToAuthPassword(pendingPhone, pin) });

    if (update.error || !session.data.session?.user.id) {
      setMessage(mapAuthError(update.error?.message ?? "PIN konnte nicht gespeichert werden."));
      setLoading(false);
      return;
    }

    await AsyncStorage.removeItem(PENDING_RESET_PHONE_KEY);
    await finishAuthenticatedFlow(session.data.session.user.id, pendingPhone);
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

    const deactivation = await supabase.from("profiles").select("deactivated_at,deactivated_reason").eq("id", userId).maybeSingle();
    if (deactivation.error && deactivation.error.code !== "PGRST204") {
      setMessage("Profilstatus konnte nicht geprüft werden.");
      setLoading(false);
      return;
    }

    if (deactivation.data?.deactivated_at) {
      await supabase.auth.signOut();
      setMessage(deactivation.data.deactivated_reason ?? "Dein Zugang wurde deaktiviert. Bitte wende dich an einen Admin.");
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

  const finishIntro = useCallback(() => {
    setIntroDone(true);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <AnimatedPanel
            step={step}
            reveal={introDone}
            header={
              <View style={styles.panelTop}>
                {introDone ? (
                  <View style={styles.themeSlot}>
                    <ThemeToggle />
                  </View>
                ) : null}
                <AuthIntro onDone={finishIntro} memberCount={memberCount} />
              </View>
            }
          >
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}

            {!isSupabaseConfigured ? (
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Supabase fehlt</Text>
                <Text style={styles.noticeBody}>Setze `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.</Text>
              </View>
            ) : null}

            {step === "login" ? (
              <View style={styles.form}>
                <PhoneField
                  compact={compactPhoneField}
                  countryIso={countryIso}
                  dialCode={dialCode}
                  onCountryChange={setCountryIso}
                  onDialCodeChange={setDialCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                />
                <PinField value={pin} onChangeText={setPin} placeholder="App-PIN" />
                <InlineError>{message}</InlineError>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Logge ein..." : "Einloggen"} onPress={submitLogin} disabled={loading || !isValidPhone(normalizedPhone) || !isValidPin(pin)} />
                <Pressable onPress={() => switchStep("resetPhone")} style={styles.subtleTextButton}>
                  <Text style={[styles.textButtonLabel, styles.subtleTextButtonLabel]}>PIN vergessen?</Text>
                </Pressable>
                <Pressable onPress={() => switchStep("invite")} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Ich habe einen Einladungscode</Text>
                </Pressable>
              </View>
            ) : null}

            {step === "invite" ? (
              <View style={styles.form}>
                <SoftField
                  value={inviteCode}
                  onChangeText={(value) => setInviteCode(value.replace(/\D/g, "").slice(0, 12))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="12-stelliger Code"
                />
                <InlineError>{message}</InlineError>
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
                <SoftField value={displayName} onChangeText={setDisplayName} autoCapitalize="words" placeholder="Name" />
                <PhoneField
                  compact={compactPhoneField}
                  countryIso={countryIso}
                  dialCode={dialCode}
                  onCountryChange={setCountryIso}
                  onDialCodeChange={setDialCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                />
                <PinField value={pin} onChangeText={setPin} placeholder="App-PIN ab 4 Ziffern" showFeedback />
                <InlineError>{message}</InlineError>
                <Button
                  label={loading ? "Erstelle..." : "SMS-Code senden"}
                  onPress={submitSignup}
                  disabled={loading || !isValidPhone(normalizedPhone) || !isValidPin(pin) || !displayName.trim()}
                />
                <Pressable onPress={() => switchStep("invite")} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Anderen Code eingeben</Text>
                </Pressable>
              </View>
            ) : null}

            {step === "sms" ? (
              <View style={styles.form}>
                <SoftField
                  value={smsCode}
                  onChangeText={(value) => setSmsCode(value.replace(/\D/g, "").slice(0, 8))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  textContentType="oneTimeCode"
                  placeholder="Code"
                />
                <InlineError>{message}</InlineError>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Bestätige..." : "Telefon bestätigen"} onPress={submitSmsCode} disabled={loading || smsCode.length < 4} />
                <View style={styles.smsActions}>
                  <Pressable onPress={resendSmsCode} disabled={resending || loading || resendCooldown > 0} style={styles.textButton}>
                    <Text style={[styles.textButtonLabel, resendCooldown > 0 && styles.textButtonLabelDisabled]}>
                      {resending ? "Sende..." : resendCooldown > 0 ? `Erneut senden in ${resendCooldown}s` : "SMS erneut senden"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => switchStep("signup")} disabled={loading} style={styles.textButton}>
                    <Text style={styles.textButtonLabel}>Zurück</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === "resetPhone" ? (
              <View style={styles.form}>
                <PhoneField
                  compact={compactPhoneField}
                  countryIso={countryIso}
                  dialCode={dialCode}
                  onCountryChange={setCountryIso}
                  onDialCodeChange={setDialCode}
                  phone={phone}
                  onPhoneChange={setPhone}
                />
                <InlineError>{message}</InlineError>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Sende..." : "SMS-Code senden"} onPress={startPinReset} disabled={loading || !isValidPhone(normalizedPhone)} />
                <Pressable onPress={() => switchStep("login")} disabled={loading} style={styles.textButton}>
                  <Text style={styles.textButtonLabel}>Zurück zum Login</Text>
                </Pressable>
              </View>
            ) : null}

            {step === "resetSms" ? (
              <View style={styles.form}>
                <SoftField
                  value={smsCode}
                  onChangeText={(value) => setSmsCode(value.replace(/\D/g, "").slice(0, 8))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  textContentType="oneTimeCode"
                  placeholder="SMS-Code"
                />
                <InlineError>{message}</InlineError>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Prüfe..." : "Code prüfen"} onPress={verifyPinResetSmsCode} disabled={loading || smsCode.length < 4} />
                <View style={styles.smsActions}>
                  <Pressable onPress={startPinReset} disabled={loading} style={styles.textButton}>
                    <Text style={styles.textButtonLabel}>SMS erneut senden</Text>
                  </Pressable>
                  <Pressable onPress={() => switchStep("resetPhone")} disabled={loading} style={styles.textButton}>
                    <Text style={styles.textButtonLabel}>Zurück</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {step === "resetPin" ? (
              <View style={styles.form}>
                <PinField value={pin} onChangeText={setPin} placeholder="Neue App-PIN" showFeedback />
                <InlineError>{message}</InlineError>
                {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
                <Button label={loading ? "Speichere..." : "PIN speichern"} onPress={submitPinReset} disabled={loading || !isValidPin(pin)} />
              </View>
            ) : null}
          </AnimatedPanel>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnimatedPanel({ children, header, reveal, step }: { children: React.ReactNode; header: React.ReactNode; reveal: boolean; step: AuthStep }) {
  const { theme } = useTheme();
  const frameOpacity = useRef(new Animated.Value(0)).current;
  const frameScale = useRef(new Animated.Value(0.985)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!reveal) {
      frameOpacity.setValue(0);
      frameScale.setValue(0.985);
      contentOpacity.setValue(0);
      contentTranslateY.setValue(12);
      return;
    }

    frameOpacity.setValue(0);
    frameScale.setValue(0.985);
    contentOpacity.setValue(0);
    contentTranslateY.setValue(12);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(frameOpacity, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(frameScale, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [contentOpacity, contentTranslateY, frameOpacity, frameScale, reveal, step]);

  return (
    <Animated.View style={styles.panel}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.panelFrame,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
            opacity: frameOpacity,
            transform: [{ scale: frameScale }],
          },
        ]}
      />
      {header}
      <Animated.View style={[styles.panelContent, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>{children}</Animated.View>
    </Animated.View>
  );
}

function PhoneField({
  compact,
  countryIso,
  dialCode,
  onCountryChange,
  onDialCodeChange,
  phone,
  onPhoneChange,
}: {
  compact: boolean;
  countryIso: string;
  dialCode: string;
  onCountryChange: (value: string) => void;
  onDialCodeChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const selectedCountry = COUNTRY_DIAL_CODES.find((entry) => entry.iso === countryIso) ?? COUNTRY_DIAL_CODES[0];

  function selectCountry(country: CountryDialCode) {
    onCountryChange(country.iso);
    onDialCodeChange(country.dialCode);
    setExpanded(false);
  }

  return (
    <View style={styles.phoneGroup}>
      <View style={[styles.phoneRow, compact && styles.phoneRowCompact]}>
        <Pressable
          onPress={() => setExpanded((value) => !value)}
          style={[styles.dialField, { borderColor: theme.border, backgroundColor: theme.softSurface }, compact && styles.dialFieldCompact]}
        >
          <FlagBadge iso={selectedCountry.iso} />
          <Text style={[styles.dialText, { color: theme.text }]}>{dialCode}</Text>
          <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
        </Pressable>
        <TextInput
          value={phone}
          onChangeText={(value) => onPhoneChange(value.replace(/[^\d\s()+-]/g, ""))}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          placeholder="170 1234567"
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            { borderColor: theme.border, backgroundColor: theme.softSurface, color: theme.text },
            styles.phoneInput,
            compact && styles.phoneInputCompact,
          ]}
        />
      </View>
      {expanded ? (
        <View style={[styles.countryMenu, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.countryScroll}>
            {COUNTRY_DIAL_CODES.map((country) => {
              const isActive = country.iso === selectedCountry.iso;

              return (
                <Pressable
                  key={`${country.iso}-${country.dialCode}`}
                  onPress={() => selectCountry(country)}
                  style={[styles.countryOption, { borderBottomColor: theme.border }, isActive && { backgroundColor: theme.softSurface }]}
                >
                  <FlagBadge iso={country.iso} />
                  <Text style={[styles.countryIso, { color: theme.text }]}>{country.iso}</Text>
                  <Text style={[styles.countryDialCode, { color: theme.muted }]}>{country.dialCode}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function SoftField({ label, style, placeholderTextColor, ...props }: React.ComponentProps<typeof TextInput> & { label?: string }) {
  const { theme } = useTheme();

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: theme.text }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={placeholderTextColor ?? theme.muted}
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.softSurface, color: theme.text }, style]}
        {...props}
      />
    </View>
  );
}

function PinField(props: Omit<React.ComponentProps<typeof TextInput>, "onChangeText"> & { value: string; onChangeText: (value: string) => void; showFeedback?: boolean }) {
  const hasValue = props.value.length > 0;
  const valid = isValidPin(props.value);
  const showFeedback = props.showFeedback;

  return (
    <View style={styles.pinWrap}>
      <SoftField
        {...props}
        onChangeText={(value) => props.onChangeText(value.replace(/\D/g, "").slice(0, 16))}
        secureTextEntry
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="password"
        maxLength={16}
        style={[showFeedback && hasValue && (valid ? styles.pinValid : styles.pinInvalid)]}
      />
      {showFeedback && hasValue ? <View style={[styles.pinSignal, valid ? styles.pinSignalValid : styles.pinSignalInvalid]} /> : null}
    </View>
  );
}

function FlagBadge({ iso }: { iso: string }) {
  const pattern = getFlagPattern(iso);

  if (pattern.kind === "cross") {
    return (
      <View style={[styles.flagBadge, { backgroundColor: pattern.background }]}>
        <View style={[styles.flagCrossHorizontal, { backgroundColor: pattern.cross }]} />
        <View style={[styles.flagCrossVertical, { backgroundColor: pattern.cross }]} />
      </View>
    );
  }

  if (pattern.kind === "nordic") {
    return (
      <View style={[styles.flagBadge, { backgroundColor: pattern.background }]}>
        <View style={[styles.flagNordicHorizontalOuter, { backgroundColor: pattern.outer }]} />
        <View style={[styles.flagNordicVerticalOuter, { backgroundColor: pattern.outer }]} />
        <View style={[styles.flagNordicHorizontalInner, { backgroundColor: pattern.inner }]} />
        <View style={[styles.flagNordicVerticalInner, { backgroundColor: pattern.inner }]} />
      </View>
    );
  }

  return (
    <View style={[styles.flagBadge, pattern.direction === "vertical" && styles.flagBadgeVertical]}>
      {pattern.colors.map((color, index) => (
        <View key={`${iso}-${color}-${index}`} style={[styles.flagStripe, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function getFlagPattern(iso: string): FlagPattern {
  const patterns: Record<string, FlagPattern> = {
    AD: { kind: "stripes", direction: "vertical", colors: ["#0032a0", "#ffd100", "#c8102e"] },
    AE: { kind: "stripes", direction: "horizontal", colors: ["#009a44", "#ffffff", "#000000", "#ef3340"] },
    AL: { kind: "stripes", direction: "horizontal", colors: ["#e41e20"] },
    AR: { kind: "stripes", direction: "horizontal", colors: ["#74acdf", "#ffffff", "#74acdf"] },
    AT: { kind: "stripes", direction: "horizontal", colors: ["#ed2939", "#ffffff", "#ed2939"] },
    AU: { kind: "stripes", direction: "horizontal", colors: ["#012169", "#012169", "#ffffff"] },
    BA: { kind: "stripes", direction: "vertical", colors: ["#002395", "#fecb00", "#002395"] },
    BE: { kind: "stripes", direction: "vertical", colors: ["#000000", "#ffd90c", "#ef3340"] },
    BG: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#00966e", "#d62612"] },
    BR: { kind: "stripes", direction: "horizontal", colors: ["#009b3a", "#ffdf00", "#002776"] },
    CA: { kind: "stripes", direction: "vertical", colors: ["#ff0000", "#ffffff", "#ff0000"] },
    CH: { kind: "cross", background: "#d52b1e", cross: "#ffffff" },
    CL: { kind: "stripes", direction: "horizontal", colors: ["#0039a6", "#ffffff", "#d52b1e"] },
    CN: { kind: "stripes", direction: "horizontal", colors: ["#de2910", "#ffde00", "#de2910"] },
    CO: { kind: "stripes", direction: "horizontal", colors: ["#fcd116", "#003893", "#ce1126"] },
    CZ: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#d7141a", "#11457e"] },
    DE: { kind: "stripes", direction: "horizontal", colors: ["#000000", "#dd0000", "#ffce00"] },
    DK: { kind: "nordic", background: "#c60c30", outer: "#ffffff", inner: "#ffffff" },
    EE: { kind: "stripes", direction: "horizontal", colors: ["#4891d9", "#000000", "#ffffff"] },
    ES: { kind: "stripes", direction: "horizontal", colors: ["#aa151b", "#f1bf00", "#aa151b"] },
    FI: { kind: "nordic", background: "#ffffff", outer: "#002f6c", inner: "#002f6c" },
    FR: { kind: "stripes", direction: "vertical", colors: ["#0055a4", "#ffffff", "#ef4135"] },
    GB: { kind: "cross", background: "#012169", cross: "#ffffff" },
    GR: { kind: "stripes", direction: "horizontal", colors: ["#0d5eaf", "#ffffff", "#0d5eaf", "#ffffff", "#0d5eaf"] },
    HR: { kind: "stripes", direction: "horizontal", colors: ["#ff0000", "#ffffff", "#171796"] },
    HU: { kind: "stripes", direction: "horizontal", colors: ["#ce2939", "#ffffff", "#477050"] },
    IE: { kind: "stripes", direction: "vertical", colors: ["#169b62", "#ffffff", "#ff883e"] },
    IL: { kind: "stripes", direction: "horizontal", colors: ["#0038b8", "#ffffff", "#0038b8"] },
    IN: { kind: "stripes", direction: "horizontal", colors: ["#ff9933", "#ffffff", "#138808"] },
    IT: { kind: "stripes", direction: "vertical", colors: ["#008c45", "#f4f5f0", "#cd212a"] },
    JP: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#bc002d", "#ffffff"] },
    KR: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#c60c30", "#003478"] },
    LT: { kind: "stripes", direction: "horizontal", colors: ["#fdb913", "#006a44", "#c1272d"] },
    LU: { kind: "stripes", direction: "horizontal", colors: ["#ef3340", "#ffffff", "#00a3e0"] },
    LV: { kind: "stripes", direction: "horizontal", colors: ["#9e3039", "#ffffff", "#9e3039"] },
    MA: { kind: "stripes", direction: "horizontal", colors: ["#c1272d", "#006233", "#c1272d"] },
    MX: { kind: "stripes", direction: "vertical", colors: ["#006847", "#ffffff", "#ce1126"] },
    NL: { kind: "stripes", direction: "horizontal", colors: ["#ae1c28", "#ffffff", "#21468b"] },
    NO: { kind: "nordic", background: "#ba0c2f", outer: "#ffffff", inner: "#00205b" },
    NZ: { kind: "stripes", direction: "horizontal", colors: ["#012169", "#ffffff", "#cc142b"] },
    PL: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#dc143c"] },
    PT: { kind: "stripes", direction: "vertical", colors: ["#006600", "#ff0000"] },
    RO: { kind: "stripes", direction: "vertical", colors: ["#002b7f", "#fcd116", "#ce1126"] },
    SE: { kind: "nordic", background: "#006aa7", outer: "#fecc00", inner: "#fecc00" },
    SI: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#005da4", "#ed1c24"] },
    SK: { kind: "stripes", direction: "horizontal", colors: ["#ffffff", "#0b4ea2", "#ee1c25"] },
    TR: { kind: "stripes", direction: "horizontal", colors: ["#e30a17", "#ffffff", "#e30a17"] },
    UA: { kind: "stripes", direction: "horizontal", colors: ["#0057b7", "#ffd700"] },
    US: { kind: "stripes", direction: "horizontal", colors: ["#b22234", "#ffffff", "#b22234", "#ffffff", "#3c3b6e"] },
    ZA: { kind: "stripes", direction: "horizontal", colors: ["#e03c31", "#ffffff", "#007a4d", "#ffb81c", "#001489"] },
  };

  return patterns[iso] ?? getFallbackFlagPattern(iso);
}

function getFallbackFlagPattern(iso: string): { kind: "stripes"; direction: "horizontal"; colors: string[] } {
  const colors = ["#4da3ff", "#5eead4", "#f8fafc", "#f59e0b", "#ef4444", "#a78bfa"];
  const seed = iso.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    kind: "stripes",
    direction: "horizontal",
    colors: [colors[seed % colors.length], colors[(seed + 2) % colors.length], colors[(seed + 4) % colors.length]],
  };
}

function composePhone(dialCode: string, phoneNumber: string): string {
  let compactPhone = phoneNumber.trim().replace(/[^\d+]/g, "");

  if (compactPhone.startsWith("+") || compactPhone.startsWith("00")) {
    return normalizePhone(compactPhone);
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

function getDefaultCountryIso(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  const region = locale.split("-").pop() ?? "de";
  const country = COUNTRY_DIAL_CODES.find((entry) => entry.iso.toLowerCase() === region);
  return country?.iso ?? "DE";
}

function getDialCodeForCountry(countryIso: string): string {
  return COUNTRY_DIAL_CODES.find((entry) => entry.iso === countryIso)?.dialCode ?? "+49";
}

function countryCodeToFlag(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

const COUNTRY_DIAL_CODES = [
  { iso: "US", dialCode: "+1" },
  { iso: "CA", dialCode: "+1" },
  { iso: "KZ", dialCode: "+7" },
  { iso: "RU", dialCode: "+7" },
  { iso: "EG", dialCode: "+20" },
  { iso: "ZA", dialCode: "+27" },
  { iso: "GR", dialCode: "+30" },
  { iso: "NL", dialCode: "+31" },
  { iso: "BE", dialCode: "+32" },
  { iso: "FR", dialCode: "+33" },
  { iso: "ES", dialCode: "+34" },
  { iso: "HU", dialCode: "+36" },
  { iso: "IT", dialCode: "+39" },
  { iso: "RO", dialCode: "+40" },
  { iso: "CH", dialCode: "+41" },
  { iso: "AT", dialCode: "+43" },
  { iso: "GB", dialCode: "+44" },
  { iso: "DK", dialCode: "+45" },
  { iso: "SE", dialCode: "+46" },
  { iso: "NO", dialCode: "+47" },
  { iso: "PL", dialCode: "+48" },
  { iso: "DE", dialCode: "+49" },
  { iso: "PE", dialCode: "+51" },
  { iso: "MX", dialCode: "+52" },
  { iso: "CU", dialCode: "+53" },
  { iso: "AR", dialCode: "+54" },
  { iso: "BR", dialCode: "+55" },
  { iso: "CL", dialCode: "+56" },
  { iso: "CO", dialCode: "+57" },
  { iso: "VE", dialCode: "+58" },
  { iso: "MY", dialCode: "+60" },
  { iso: "AU", dialCode: "+61" },
  { iso: "ID", dialCode: "+62" },
  { iso: "PH", dialCode: "+63" },
  { iso: "NZ", dialCode: "+64" },
  { iso: "SG", dialCode: "+65" },
  { iso: "TH", dialCode: "+66" },
  { iso: "JP", dialCode: "+81" },
  { iso: "KR", dialCode: "+82" },
  { iso: "VN", dialCode: "+84" },
  { iso: "CN", dialCode: "+86" },
  { iso: "TR", dialCode: "+90" },
  { iso: "IN", dialCode: "+91" },
  { iso: "PK", dialCode: "+92" },
  { iso: "AF", dialCode: "+93" },
  { iso: "LK", dialCode: "+94" },
  { iso: "MM", dialCode: "+95" },
  { iso: "IR", dialCode: "+98" },
  { iso: "SS", dialCode: "+211" },
  { iso: "MA", dialCode: "+212" },
  { iso: "DZ", dialCode: "+213" },
  { iso: "TN", dialCode: "+216" },
  { iso: "LY", dialCode: "+218" },
  { iso: "GM", dialCode: "+220" },
  { iso: "SN", dialCode: "+221" },
  { iso: "MR", dialCode: "+222" },
  { iso: "ML", dialCode: "+223" },
  { iso: "GN", dialCode: "+224" },
  { iso: "CI", dialCode: "+225" },
  { iso: "BF", dialCode: "+226" },
  { iso: "NE", dialCode: "+227" },
  { iso: "TG", dialCode: "+228" },
  { iso: "BJ", dialCode: "+229" },
  { iso: "MU", dialCode: "+230" },
  { iso: "LR", dialCode: "+231" },
  { iso: "SL", dialCode: "+232" },
  { iso: "GH", dialCode: "+233" },
  { iso: "NG", dialCode: "+234" },
  { iso: "TD", dialCode: "+235" },
  { iso: "CF", dialCode: "+236" },
  { iso: "CM", dialCode: "+237" },
  { iso: "CV", dialCode: "+238" },
  { iso: "ST", dialCode: "+239" },
  { iso: "GQ", dialCode: "+240" },
  { iso: "GA", dialCode: "+241" },
  { iso: "CG", dialCode: "+242" },
  { iso: "CD", dialCode: "+243" },
  { iso: "AO", dialCode: "+244" },
  { iso: "GW", dialCode: "+245" },
  { iso: "IO", dialCode: "+246" },
  { iso: "SC", dialCode: "+248" },
  { iso: "SD", dialCode: "+249" },
  { iso: "RW", dialCode: "+250" },
  { iso: "ET", dialCode: "+251" },
  { iso: "SO", dialCode: "+252" },
  { iso: "DJ", dialCode: "+253" },
  { iso: "KE", dialCode: "+254" },
  { iso: "TZ", dialCode: "+255" },
  { iso: "UG", dialCode: "+256" },
  { iso: "BI", dialCode: "+257" },
  { iso: "MZ", dialCode: "+258" },
  { iso: "ZM", dialCode: "+260" },
  { iso: "MG", dialCode: "+261" },
  { iso: "RE", dialCode: "+262" },
  { iso: "ZW", dialCode: "+263" },
  { iso: "NA", dialCode: "+264" },
  { iso: "MW", dialCode: "+265" },
  { iso: "LS", dialCode: "+266" },
  { iso: "BW", dialCode: "+267" },
  { iso: "SZ", dialCode: "+268" },
  { iso: "KM", dialCode: "+269" },
  { iso: "SH", dialCode: "+290" },
  { iso: "ER", dialCode: "+291" },
  { iso: "AW", dialCode: "+297" },
  { iso: "FO", dialCode: "+298" },
  { iso: "GL", dialCode: "+299" },
  { iso: "GI", dialCode: "+350" },
  { iso: "PT", dialCode: "+351" },
  { iso: "LU", dialCode: "+352" },
  { iso: "IE", dialCode: "+353" },
  { iso: "IS", dialCode: "+354" },
  { iso: "AL", dialCode: "+355" },
  { iso: "MT", dialCode: "+356" },
  { iso: "CY", dialCode: "+357" },
  { iso: "FI", dialCode: "+358" },
  { iso: "BG", dialCode: "+359" },
  { iso: "LT", dialCode: "+370" },
  { iso: "LV", dialCode: "+371" },
  { iso: "EE", dialCode: "+372" },
  { iso: "MD", dialCode: "+373" },
  { iso: "AM", dialCode: "+374" },
  { iso: "BY", dialCode: "+375" },
  { iso: "AD", dialCode: "+376" },
  { iso: "MC", dialCode: "+377" },
  { iso: "SM", dialCode: "+378" },
  { iso: "UA", dialCode: "+380" },
  { iso: "RS", dialCode: "+381" },
  { iso: "ME", dialCode: "+382" },
  { iso: "XK", dialCode: "+383" },
  { iso: "HR", dialCode: "+385" },
  { iso: "SI", dialCode: "+386" },
  { iso: "BA", dialCode: "+387" },
  { iso: "MK", dialCode: "+389" },
  { iso: "CZ", dialCode: "+420" },
  { iso: "SK", dialCode: "+421" },
  { iso: "LI", dialCode: "+423" },
  { iso: "FK", dialCode: "+500" },
  { iso: "BZ", dialCode: "+501" },
  { iso: "GT", dialCode: "+502" },
  { iso: "SV", dialCode: "+503" },
  { iso: "HN", dialCode: "+504" },
  { iso: "NI", dialCode: "+505" },
  { iso: "CR", dialCode: "+506" },
  { iso: "PA", dialCode: "+507" },
  { iso: "PM", dialCode: "+508" },
  { iso: "HT", dialCode: "+509" },
  { iso: "GP", dialCode: "+590" },
  { iso: "BO", dialCode: "+591" },
  { iso: "GY", dialCode: "+592" },
  { iso: "EC", dialCode: "+593" },
  { iso: "GF", dialCode: "+594" },
  { iso: "PY", dialCode: "+595" },
  { iso: "MQ", dialCode: "+596" },
  { iso: "SR", dialCode: "+597" },
  { iso: "UY", dialCode: "+598" },
  { iso: "CW", dialCode: "+599" },
  { iso: "TL", dialCode: "+670" },
  { iso: "NF", dialCode: "+672" },
  { iso: "BN", dialCode: "+673" },
  { iso: "NR", dialCode: "+674" },
  { iso: "PG", dialCode: "+675" },
  { iso: "TO", dialCode: "+676" },
  { iso: "SB", dialCode: "+677" },
  { iso: "VU", dialCode: "+678" },
  { iso: "FJ", dialCode: "+679" },
  { iso: "PW", dialCode: "+680" },
  { iso: "WF", dialCode: "+681" },
  { iso: "CK", dialCode: "+682" },
  { iso: "NU", dialCode: "+683" },
  { iso: "WS", dialCode: "+685" },
  { iso: "KI", dialCode: "+686" },
  { iso: "NC", dialCode: "+687" },
  { iso: "TV", dialCode: "+688" },
  { iso: "PF", dialCode: "+689" },
  { iso: "TK", dialCode: "+690" },
  { iso: "FM", dialCode: "+691" },
  { iso: "MH", dialCode: "+692" },
  { iso: "KP", dialCode: "+850" },
  { iso: "HK", dialCode: "+852" },
  { iso: "MO", dialCode: "+853" },
  { iso: "KH", dialCode: "+855" },
  { iso: "LA", dialCode: "+856" },
  { iso: "BD", dialCode: "+880" },
  { iso: "TW", dialCode: "+886" },
  { iso: "MV", dialCode: "+960" },
  { iso: "LB", dialCode: "+961" },
  { iso: "JO", dialCode: "+962" },
  { iso: "SY", dialCode: "+963" },
  { iso: "IQ", dialCode: "+964" },
  { iso: "KW", dialCode: "+965" },
  { iso: "SA", dialCode: "+966" },
  { iso: "YE", dialCode: "+967" },
  { iso: "OM", dialCode: "+968" },
  { iso: "PS", dialCode: "+970" },
  { iso: "AE", dialCode: "+971" },
  { iso: "IL", dialCode: "+972" },
  { iso: "BH", dialCode: "+973" },
  { iso: "QA", dialCode: "+974" },
  { iso: "BT", dialCode: "+975" },
  { iso: "MN", dialCode: "+976" },
  { iso: "NP", dialCode: "+977" },
  { iso: "TJ", dialCode: "+992" },
  { iso: "TM", dialCode: "+993" },
  { iso: "AZ", dialCode: "+994" },
  { iso: "GE", dialCode: "+995" },
  { iso: "KG", dialCode: "+996" },
  { iso: "UZ", dialCode: "+998" },
];

function mapAuthError(message: string): string {
  if (isInvalidLoginError(message)) {
    return "Telefonnummer oder App-PIN stimmt nicht.";
  }

  if (isOtpExpiredOrInvalidError(message)) {
    return "Der SMS-Code ist abgelaufen oder ungültig. Fordere über „SMS erneut senden“ einen neuen Code an und gib ihn zügig ein.";
  }

  const retryAfter = retryAfterSeconds(message);
  if (retryAfter !== null) {
    return `Zu viele SMS-Anfragen. Bitte warte ${retryAfter} Sekunden und versuche es erneut.`;
  }

  if (isSmsRateLimitError(message)) {
    return "Zu viele SMS-Anfragen. Bitte warte einen Moment und versuche es erneut.";
  }

  return message;
}

// Supabase returns "For security purposes, you can only request this after N seconds."
// when an SMS resend is throttled. Pull the wait time out so we can gate the button.
function retryAfterSeconds(message: string): number | null {
  const match = /after (\d+) seconds?/i.exec(message);
  return match ? Number(match[1]) : null;
}

function isSmsRateLimitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("rate limit") || normalized.includes("too many requests");
}

// Supabase returns "Token has expired or is invalid" (otp_expired) when the SMS
// code is wrong or — more often — was entered after its validity window lapsed.
function isOtpExpiredOrInvalidError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("otp_expired") || normalized.includes("expired") || normalized.includes("token is invalid") || normalized.includes("invalid token") || normalized.includes("expired or is invalid");
}

function isInvalidLoginError(message: string): boolean {
  return message.toLowerCase().includes("invalid login credentials");
}

function isOtpSignupBlockedError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("signups not allowed") || normalized.includes("signup disabled");
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
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  introOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070b",
    zIndex: 10,
  },
  introLogoWrap: { alignItems: "center", justifyContent: "center", width: "86%", maxWidth: 420 },
  introLogo: { width: "100%", height: 240 },
  introTrack: {
    width: "44%",
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginTop: -28,
  },
  introProgress: { height: "100%", borderRadius: 999, backgroundColor: "#ffffff" },
  backgroundLogo: {
    position: "absolute",
    right: -170,
    top: 42,
    width: 520,
    height: 520,
    opacity: 0.075,
  },
  keyboard: { flex: 1 },
  authScroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  shell: { width: "100%", alignItems: "center", justifyContent: "center" },
  panel: {
    width: "100%",
    maxWidth: 520,
    gap: 6,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  panelFrame: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: "#4da3ff",
    shadowOpacity: 0.12,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
  },
  panelContent: { gap: 18 },
  panelTop: { alignItems: "center", minHeight: 176, justifyContent: "center" },
  themeSlot: { position: "absolute", top: 0, right: 0, zIndex: 2 },
  title: { color: "#ffffff", fontSize: 29, fontWeight: "900", letterSpacing: 0, lineHeight: 34 },
  subtitle: { color: "#9aa7b8", fontSize: 16, lineHeight: 24 },
  form: { gap: 14 },
  field: { gap: 7 },
  pinWrap: { gap: 7 },
  pinValid: { borderColor: "rgba(94,234,212,0.78)", backgroundColor: "rgba(94,234,212,0.1)" },
  pinInvalid: { borderColor: "rgba(255,126,106,0.76)", backgroundColor: "rgba(255,126,106,0.09)" },
  pinSignal: { alignSelf: "flex-end", width: 52, height: 3, borderRadius: 999 },
  pinSignalValid: { backgroundColor: "#5eead4" },
  pinSignalInvalid: { backgroundColor: "#ff7e6a" },
  phoneGroup: { gap: 8 },
  phoneRow: { flexDirection: "row", gap: 10 },
  phoneRowCompact: { flexDirection: "column" },
  dialField: {
    minHeight: 58,
    width: 128,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
  },
  dialFieldCompact: { width: "100%" },
  flag: { fontSize: 21, lineHeight: 24 },
  dialText: { color: "#ffffff", fontSize: 18, fontWeight: "800", lineHeight: 22 },
  chevron: { color: "#8fc7ff", fontSize: 10, fontWeight: "900", lineHeight: 12 },
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
  phoneInput: { flex: 1, minWidth: 0 },
  phoneInputCompact: { width: "100%", flex: 0 },
  countryMenu: {
    maxHeight: 240,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(7,12,20,0.98)",
    overflow: "hidden",
  },
  countryScroll: { maxHeight: 240 },
  countryOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  countryOptionActive: { backgroundColor: "rgba(77,163,255,0.16)" },
  flagBadge: {
    width: 28,
    height: 20,
    flexDirection: "column",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  flagBadgeVertical: { flexDirection: "row" },
  flagStripe: { flex: 1 },
  flagCrossHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 7,
    height: 6,
  },
  flagCrossVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 11,
    width: 6,
  },
  flagNordicHorizontalOuter: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 7,
    height: 6,
  },
  flagNordicVerticalOuter: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 9,
    width: 7,
  },
  flagNordicHorizontalInner: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 8,
    height: 4,
  },
  flagNordicVerticalInner: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 10,
    width: 5,
  },
  countryIso: { flex: 1, color: "#ffffff", fontSize: 15, fontWeight: "900" },
  countryDialCode: { color: "#9aa7b8", fontSize: 15, fontWeight: "800" },
  helper: { color: "#9aa7b8", fontSize: 13, lineHeight: 19 },
  success: { color: "#5eead4", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  notice: { gap: 5, borderRadius: 18, backgroundColor: "rgba(77,163,255,0.14)", padding: 12 },
  noticeTitle: { color: "#d9ecff", fontSize: 14, fontWeight: "900" },
  noticeBody: { color: "#b8d8ff", fontSize: 13, lineHeight: 19 },
  smsActions: { flexDirection: "row", justifyContent: "center", gap: 12, flexWrap: "wrap" },
  textButton: { alignSelf: "center", padding: 8 },
  textButtonLabel: { color: "#8fc7ff", fontSize: 14, fontWeight: "900" },
  textButtonLabelDisabled: { color: "#5a6b80" },
  subtleTextButton: { alignSelf: "center", paddingHorizontal: 8, paddingVertical: 2, marginTop: -6 },
  subtleTextButtonLabel: { fontSize: 13, opacity: 0.72 },
});
