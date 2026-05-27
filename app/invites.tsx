import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import { createInvitationCode, listInvitationCodes, type InvitationCodeWithUsage } from "../src/services";

export default function InvitesScreen() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<InvitationCodeWithUsage[]>([]);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    if (!user) return;
    const [profileResult, codeResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      listInvitationCodes(supabase, user.id),
    ]);

    setRole(profileResult.data?.role === "admin" ? "admin" : "member");
    if (codeResult.data) setCodes(codeResult.data);
    if (codeResult.error) setMessage(codeResult.error.message);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const usedSlots = codes.length;
  const remaining = role === "admin" ? Number.POSITIVE_INFINITY : Math.max(0, 3 - usedSlots);
  const canCreate = role === "admin" || remaining > 0;
  const slotLabels = useMemo(() => (role === "admin" ? ["∞"] : ["1", "2", "3"]), [role]);

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
      setMessage(result.error.message);
      return;
    }

    await load();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Exklusiver Zugang</Text>
        <Text style={styles.title}>Codes für Menschen, die wirklich dazugehören.</Text>

        <View style={styles.slotRow}>
          {slotLabels.map((slot, index) => {
            const filled = role === "admin" || index < usedSlots;
            return (
              <View key={slot} style={[styles.slot, filled && styles.slotFilled]}>
                <Text style={[styles.slotText, filled && styles.slotTextFilled]}>{slot}</Text>
              </View>
            );
          })}
        </View>

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Pressable
            style={({ pressed }) => [styles.button, (!canCreate || busy) && styles.disabled, pressed && canCreate && styles.pressed]}
            onPress={createCode}
            disabled={!canCreate || busy}
          >
            <Text style={styles.buttonText}>{busy ? "Erstelle..." : canCreate ? "Neuen Code erzeugen" : "Kontingent genutzt"}</Text>
          </Pressable>
        </Animated.View>

        {message ? <Text style={styles.notice}>{message}</Text> : null}

        <View style={styles.codes}>
          {codes.length === 0 ? <Text style={styles.empty}>Noch kein Code erstellt.</Text> : null}
          {codes.map((code) => (
            <View key={code.code} style={[styles.codeCard, code.used_at && styles.codeCardUsed]}>
              <Text style={styles.code}>{code.code}</Text>
              <Text style={styles.codeMeta}>{code.used_at ? `Verwendet von ${code.usedByName ?? "Mitglied"}` : "Bereit zum Teilen"}</Text>
              {code.usedByPhone ? <Text style={styles.codePhone}>{code.usedByPhone}</Text> : null}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  content: { gap: 18, padding: 20 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "900", letterSpacing: 0, lineHeight: 38 },
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
});
