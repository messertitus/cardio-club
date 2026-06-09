import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Share, StyleSheet, Text, View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { EmptyState, MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
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
  const slotLabels = useMemo(() => (isAdmin ? ["unlimited"] : ["1", "2", "3"]), [isAdmin]);

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
          ? "Supabase nutzt noch die alte Code-Funktion. Bitte Migration 017_admin_invites_unlimited.sql ausfuehren."
          : result.error.message,
      );
      return;
    }

    await load();
  }

  async function shareCode(code: string) {
    await Share.share({ message: buildInviteMessage(code) });
  }

  return (
    <View style={{ flex: 1 }}>
      <MccScreen title="Einladungscodes" kicker="Exklusiver Zugang" subtitle={isAdmin ? "Admin-Kontingent: unbegrenzt." : `Noch ${remaining} von 3 Codes verfuegbar.`} bottomInset={96}>
        <MccCard accent>
          <MccBadge icon="ticket-confirmation-outline">Slots</MccBadge>
          <MccCardTitle>Zugang kontrolliert, aber schnell geteilt</MccCardTitle>
          <View style={styles.slotRow}>
            {slotLabels.map((slot, index) => {
              const filled = isAdmin || index < usedSlots;
              return (
                <View
                  key={slot}
                  style={[
                    styles.slot,
                    {
                      borderColor: filled ? theme.mcc.accent : theme.mcc.line,
                      backgroundColor: filled ? theme.mcc.accentSoft : theme.mcc.surfaceSoft,
                    },
                  ]}
                >
                  <Text style={[styles.slotText, { color: filled ? theme.mcc.textPrimary : theme.mcc.textMuted }]}>{slot === "unlimited" ? "max" : slot}</Text>
                </View>
              );
            })}
          </View>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <MccButton label={busy ? "Erstelle..." : canCreate ? "Neuen Code erzeugen" : "Kontingent genutzt"} icon="plus-circle-outline" onPress={createCode} disabled={!canCreate || busy} />
          </Animated.View>
          {message ? (
            <MccBadge tone="danger" icon="alert-circle-outline">
              {message}
            </MccBadge>
          ) : null}
        </MccCard>

        {codes.length === 0 ? <EmptyState title="Noch kein Code erstellt" body="Erzeuge einen Code und teile ihn direkt mit einem neuen Mitglied." icon="ticket-outline" /> : null}
        {codes.map((code, index) => (
          <Reveal key={code.code} index={index}>
            <MccCard style={code.used_at ? styles.usedCard : undefined}>
              <MccBadge tone={code.used_at ? "neutral" : "success"} icon={code.used_at ? "check-outline" : "share-variant-outline"}>
                {code.used_at ? "Verwendet" : "Bereit zum Teilen"}
              </MccBadge>
              <Text style={[styles.code, { color: theme.mcc.textPrimary }]}>{code.code}</Text>
              <MccBody muted>{code.used_at ? `Verwendet von ${code.usedByName ?? "Mitglied"}` : "Einmalig gueltig fuer den Clubzugang."}</MccBody>
              {code.usedByPhone ? <MccBody style={{ color: theme.mcc.accent }}>{code.usedByPhone}</MccBody> : null}
              {!code.used_at ? <MccButton label="Teilen" icon="share-outline" variant="secondary" onPress={() => shareCode(code.code)} /> : null}
            </MccCard>
          </Reveal>
        ))}
      </MccScreen>
      <BottomNav active="menu" />
    </View>
  );
}

function buildInviteMessage(code: string): string {
  return `Hey du, dein Einladungscode fuer den Cardio Club lautet: ${code}\nLink: ${getInviteLink()}`;
}

function getInviteLink(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "https://messers-cardio-club.com";
}

const styles = StyleSheet.create({
  slotRow: { flexDirection: "row", gap: 10 },
  slot: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  slotText: { fontSize: 16, fontWeight: "900" },
  code: { fontSize: 30, fontWeight: "900", letterSpacing: 1, textAlign: "center" },
  usedCard: { opacity: 0.58 },
});
