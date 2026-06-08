import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, TextInput, View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { MccBadge, MccButton, MccCard, MccScreen } from "../src/components/MccDesign";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { getMyProfile } from "../src/services";

export default function PinScreen() {
  const { loading, user } = useAuth();
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function changePin() {
    if (!user || busy) return;
    setBusy(true);
    setMessage(null);
    setSuccess(null);

    if (!isValidPin(currentPin) || !isValidPin(nextPin)) {
      setMessage("PINs muessen mindestens 4 Ziffern haben.");
      setBusy(false);
      return;
    }

    if (nextPin !== confirmPin) {
      setMessage("Die neue PIN stimmt nicht ueberein.");
      setBusy(false);
      return;
    }

    const profile = await getMyProfile(supabase, user.id);
    const phone = profile.data?.phone ?? user.phone ?? null;
    if (profile.error || !phone) {
      setMessage(profile.error?.message ?? "Telefonnummer konnte nicht geladen werden.");
      setBusy(false);
      return;
    }

    let login = await supabase.auth.signInWithPassword({ phone, password: appPinToAuthPassword(phone, currentPin) });
    if (login.error && login.error.message.toLowerCase().includes("invalid login credentials")) {
      login = await supabase.auth.signInWithPassword({ phone, password: currentPin });
    }

    if (login.error) {
      setMessage("Aktuelle PIN stimmt nicht.");
      setBusy(false);
      return;
    }

    const update = await supabase.auth.updateUser({ password: appPinToAuthPassword(phone, nextPin) });
    if (update.error) {
      setMessage(update.error.message);
      setBusy(false);
      return;
    }

    setCurrentPin("");
    setNextPin("");
    setConfirmPin("");
    setSuccess("PIN geaendert.");
    setBusy(false);
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <View style={styles.shell}>
      <KeyboardAvoidingView behavior={undefined} style={styles.shell}>
        <MccScreen title="PIN aendern" kicker="Sicherheit" subtitle="Halte deinen Clubzugang kurz, privat und robust." bottomInset={96}>
          {message ? (
            <MccBadge tone="danger" icon="alert-circle-outline">
              {message}
            </MccBadge>
          ) : null}
          {success ? (
            <MccBadge tone="success" icon="check-circle-outline">
              {success}
            </MccBadge>
          ) : null}
          <MccCard accent>
            <PinInput value={currentPin} onChangeText={setCurrentPin} placeholder="Aktuelle PIN" />
            <PinInput value={nextPin} onChangeText={setNextPin} placeholder="Neue PIN" showFeedback />
            <PinInput value={confirmPin} onChangeText={setConfirmPin} placeholder="Neue PIN wiederholen" showFeedback />
            <MccButton label={busy ? "Speichere..." : "PIN speichern"} icon="shield-check-outline" onPress={changePin} disabled={!canSubmit(currentPin, nextPin, confirmPin) || busy} />
          </MccCard>
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

function canSubmit(currentPin: string, nextPin: string, confirmPin: string): boolean {
  return isValidPin(currentPin) && isValidPin(nextPin) && nextPin === confirmPin;
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
  input: {
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "800",
    minHeight: 54,
    outlineStyle: "none",
    paddingHorizontal: 14,
  } as object,
});
