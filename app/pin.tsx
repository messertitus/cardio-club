import { Redirect } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { PageHeader } from "../src/components/PageHeader";
import { LoadingState } from "../src/components/ui";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { getMyProfile } from "../src/services";

export default function PinScreen() {
  const { loading, user } = useAuth();
  const { theme } = useTheme();
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
      setMessage("PINs müssen mindestens 4 Ziffern haben.");
      setBusy(false);
      return;
    }

    if (nextPin !== confirmPin) {
      setMessage("Die neue PIN stimmt nicht überein.");
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
    setSuccess("PIN geändert.");
    setBusy(false);
  }

  if (loading) return <LoadingState />;
  if (!user) return <Redirect href="/auth" />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
        <KeyboardAvoidingView behavior={undefined} style={styles.shell}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PageHeader kicker="Sicherheit" title="PIN ändern" />

            {message ? <Text style={styles.notice}>{message}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
              <PinInput value={currentPin} onChangeText={setCurrentPin} placeholder="Aktuelle PIN" />
              <PinInput value={nextPin} onChangeText={setNextPin} placeholder="Neue PIN" showFeedback />
              <PinInput value={confirmPin} onChangeText={setConfirmPin} placeholder="Neue PIN wiederholen" showFeedback />
              <Pressable
                style={({ pressed }) => [styles.button, { backgroundColor: theme.button }, (!canSubmit(currentPin, nextPin, confirmPin) || busy) && styles.disabled, pressed && styles.pressed]}
                onPress={changePin}
                disabled={!canSubmit(currentPin, nextPin, confirmPin) || busy}
              >
                <Text style={[styles.buttonText, { color: theme.inverse }]}>{busy ? "Speichere..." : "PIN speichern"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function PinInput({ showFeedback, style, ...props }: React.ComponentProps<typeof TextInput> & { showFeedback?: boolean }) {
  const { theme } = useTheme();
  const value = String(props.value ?? "");
  const feedbackColor = !showFeedback || value.length === 0 ? theme.border : value.length >= 4 ? "#4ade80" : "#ff6b57";
  return (
    <TextInput
      keyboardType="number-pad"
      inputMode="numeric"
      secureTextEntry
      maxLength={16}
      placeholderTextColor={theme.muted}
      style={[styles.input, { borderColor: feedbackColor, backgroundColor: theme.surface, color: theme.text }, style]}
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
  safeArea: { flex: 1 },
  shell: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { fontSize: 34, fontWeight: "900", letterSpacing: 0 },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  success: { color: "#5eead4", fontSize: 14, fontWeight: "900" },
  card: { gap: 12, borderRadius: 24, borderWidth: 1, padding: 14 },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 14,
    outlineStyle: "none",
  } as object,
  button: { alignItems: "center", borderRadius: 18, paddingVertical: 15 },
  buttonText: { fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.42 },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
});
