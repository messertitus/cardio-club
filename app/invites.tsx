import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";
import { supabase } from "../src/lib/supabase";
import { createInvitationCode, isCurrentUserAdmin, listInvitationCodes, type InvitationCodeWithUsage } from "../src/services";

export default function InvitesScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [codes, setCodes] = useState<InvitationCodeWithUsage[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (!user) return;
    const [adminResult, codeResult] = await Promise.all([isCurrentUserAdmin(supabase, user.id), listInvitationCodes(supabase, user.id)]);

    setIsAdmin(adminResult.data ?? false);
    if (codeResult.data) setCodes(codeResult.data);
    if (codeResult.error) setMessage(codeResult.error.message);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const usedSlots = codes.length;
  const remaining = isAdmin ? Number.POSITIVE_INFINITY : Math.max(0, 3 - usedSlots);
  const canCreate = isAdmin || remaining > 0;
  const slotLabels = useMemo(() => (isAdmin ? ["∞"] : ["1", "2", "3"]), [isAdmin]);

  async function createCode() {
    if (!canCreate || busy) return;
    setBusy(true);
    setMessage(null);
    Animated.sequence([
      Animated.spring(pulse, { toValue: 0.96, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    const result = await createInvitationCode(supabase);
    setBusy(false);

    if (result.error) {
      setMessage(
        isAdmin && result.error.message.includes("3 Einladungscodes")
          ? "Supabase nutzt noch die alte Code-Funktion. Bitte Migration 017_admin_invites_unlimited.sql ausfÃ¼hren."
          : result.error.message,
      );
      return;
    }

    await load();
  }

  async function shareCode(code: string) {
    await Share.share({ message: buildInviteMessage(code) });
  }

  async function shareWhatsApp(code: string) {
    const text = encodeURIComponent(buildInviteMessage(code));
    const appUrl = `whatsapp://send?text=${text}`;
    const webUrl = `https://wa.me/?text=${text}`;
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  }

  async function shareSms(code: string) {
    await Linking.openURL(`sms:?&body=${encodeURIComponent(buildInviteMessage(code))}`);
  }

  async function shareInstagram(code: string) {
    await Share.share({ message: buildInviteMessage(code) });
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { color: theme.accent }]}>Exklusiver Zugang</Text>
        <Text style={[styles.title, { color: theme.text }]}>Einmalige Einladungscodes</Text>
        <Text style={[styles.body, { color: theme.muted }]}>{isAdmin ? "Du kannst unbegrenzt Codes erstellen." : `Noch ${remaining} von 3 Codes verfügbar.`}</Text>

        <View style={styles.slotRow}>
          {slotLabels.map((slot, index) => {
            const filled = isAdmin || index < usedSlots;
            return (
              <View key={slot} style={[styles.slot, { borderColor: theme.border, backgroundColor: theme.softSurface }, filled && { borderColor: theme.accent }]}>
                <Text style={[styles.slotText, { color: filled ? theme.text : theme.muted }]}>{slot}</Text>
              </View>
            );
          })}
        </View>

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Pressable
            style={({ pressed }) => [styles.button, { backgroundColor: theme.button }, (!canCreate || busy) && styles.disabled, pressed && canCreate && styles.pressed]}
            onPress={createCode}
            disabled={!canCreate || busy}
          >
            <Text style={[styles.buttonText, { color: theme.inverse }]}>{busy ? "Erstelle..." : canCreate ? "Neuen Code erzeugen" : "Kontingent genutzt"}</Text>
          </Pressable>
        </Animated.View>

        {message ? <Text style={styles.notice}>{message}</Text> : null}

        <View style={styles.codes}>
          {codes.length === 0 ? <Text style={[styles.empty, { color: theme.muted }]}>Noch kein Code erstellt.</Text> : null}
          {codes.map((code) => (
            <View key={code.code} style={[styles.codeCard, { borderColor: theme.border, backgroundColor: theme.softSurface }, code.used_at && styles.codeCardUsed]}>
              <Text style={[styles.code, { color: theme.text }]}>{code.code}</Text>
              <Text style={[styles.codeMeta, { color: theme.muted }]}>{code.used_at ? `Verwendet von ${code.usedByName ?? "Mitglied"}` : "Bereit zum Teilen"}</Text>
              {code.usedByPhone ? <Text style={[styles.codePhone, { color: theme.accent }]}>{code.usedByPhone}</Text> : null}
              {!code.used_at ? (
                <View style={styles.shareRow}>
                  <Pressable style={[styles.shareButton, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={() => shareWhatsApp(code.code)}>
                    <Text style={[styles.shareText, { color: theme.text }]}>WhatsApp</Text>
                  </Pressable>
                  <Pressable style={[styles.shareButton, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={() => shareSms(code.code)}>
                    <Text style={[styles.shareText, { color: theme.text }]}>SMS</Text>
                  </Pressable>
                  <Pressable style={[styles.shareButton, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={() => shareInstagram(code.code)}>
                    <Text style={[styles.shareText, { color: theme.text }]}>Instagram</Text>
                  </Pressable>
                  <Pressable style={[styles.shareButton, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={() => shareCode(code.code)}>
                    <Text style={[styles.shareText, { color: theme.text }]}>Teilen</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function buildInviteMessage(code: string): string {
  return `Dein Einladungscode für Messers Cardio Club: ${code}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { gap: 18, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 32, fontWeight: "900", letterSpacing: 0, lineHeight: 36 },
  body: { fontSize: 15, lineHeight: 22 },
  slotRow: { flexDirection: "row", gap: 10 },
  slot: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  slotFilled: { borderColor: "rgba(77,163,255,0.7)", backgroundColor: "rgba(77,163,255,0.18)" },
  slotText: { color: "#728197", fontSize: 16, fontWeight: "900" },
  slotTextFilled: { color: "#ffffff" },
  notice: { color: "#ffb5a8", fontSize: 14, fontWeight: "900" },
  button: { alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", paddingVertical: 15 },
  buttonText: { color: "#05070b", fontSize: 15, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
  disabled: { opacity: 0.42 },
  codes: { gap: 10 },
  empty: { color: "#9aa7b8", fontSize: 15, lineHeight: 22 },
  codeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(77,163,255,0.46)",
    backgroundColor: "rgba(77,163,255,0.14)",
    padding: 18,
  },
  codeCardUsed: { opacity: 0.52 },
  code: { color: "#ffffff", fontSize: 28, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  codeMeta: { color: "#c6d7ea", fontSize: 12, fontWeight: "900", marginTop: 8, textAlign: "center", textTransform: "uppercase" },
  codePhone: { color: "#8fc7ff", fontSize: 13, fontWeight: "800", marginTop: 4, textAlign: "center" },
  shareRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 14 },
  shareButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  shareText: { fontSize: 12, fontWeight: "900" },
});
