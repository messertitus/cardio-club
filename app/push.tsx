import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import {
  APP_EVENTS,
  isStandaloneDisplay,
  requestWebPushSubscription,
  saveWebPushSubscription,
  SCREEN_EVENTS,
  trackAppEvent,
  webPushPermission,
  type PushPermission,
} from "../src/services";
import { useScreenView } from "../src/components/useScreenView";

export default function PushScreen() {
  const { user } = useAuth();
  useScreenView(SCREEN_EVENTS.push);
  const [message, setMessage] = useState<string | null>(null);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setPermission(webPushPermission());
    setStandalone(isStandaloneDisplay());
  }, []);

  async function enablePush() {
    if (!user) return;
    const subscription = await requestWebPushSubscription();
    setPermission(webPushPermission());
    if (!subscription) {
      setMessage("Push ist in diesem Browser nicht verfügbar oder wurde abgelehnt.");
      return;
    }

    const result = await saveWebPushSubscription(supabase, {
      userId: user.id,
      endpoint: subscription.endpoint,
      subscription: subscription.subscription,
    });

    setMessage(result.error ? result.error.message : "Push ist gespeichert.");
    if (!result.error) void trackAppEvent(supabase, APP_EVENTS.pushEnabled);
  }

  const success = message?.includes("gespeichert") ?? false;
  const pushGranted = permission === "granted";
  const pushDenied = permission === "denied";
  const pushUnsupported = permission === "unsupported";

  return (
    <View style={{ flex: 1 }}>
      <MccScreen title="Push" kicker="Updates" subtitle="Benachrichtigungen für Entscheidungen und Event-Updates." bottomInset={96}>
        <Reveal>
          <MccCard accent>
            <MccBadge icon="bell-ring-outline">Live Updates</MccBadge>
            <MccCardTitle>Cardio Club meldet sich, wenn es zählt</MccCardTitle>
            <MccBody muted>Auf dem Handy funktioniert das nach dem Hinzufügen zum Startbildschirm am zuverlässigsten.</MccBody>

            {standalone ? <MccBadge tone="success" icon="check-circle-outline">Als App installiert</MccBadge> : null}
            {pushGranted ? <MccBadge tone="success" icon="bell-check-outline">Push ist aktiv</MccBadge> : null}

            {message ? (
              <MccBadge tone={success ? "success" : "danger"} icon={success ? "check-circle-outline" : "alert-circle-outline"}>
                {message}
              </MccBadge>
            ) : null}

            {pushGranted ? (
              <MccBody muted>Du erhältst bereits Benachrichtigungen. Nichts weiter zu tun.</MccBody>
            ) : pushDenied ? (
              <MccBody muted>Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Website-Einstellungen, um Push zu nutzen.</MccBody>
            ) : pushUnsupported ? (
              <MccBody muted>Dieser Browser unterstützt keine Web-Push-Benachrichtigungen.</MccBody>
            ) : (
              <MccButton label="Push erlauben" icon="bell-plus-outline" onPress={enablePush} />
            )}
          </MccCard>
        </Reveal>

        {standalone ? null : (
          <Reveal index={1}>
            <MccCard>
              <MccBadge icon="cellphone-arrow-down">App-Version</MccBadge>
              <MccCardTitle>Push wirkt am besten als App</MccCardTitle>
              <MccBody muted>Auf dem Handy kommen Benachrichtigungen am zuverlässigsten an, wenn du die App einmal zum Homescreen hinzufügst.</MccBody>
              <MccButton label="Anleitung: App installieren" icon="arrow-right" variant="secondary" onPress={() => router.push("/install")} />
            </MccCard>
          </Reveal>
        )}
      </MccScreen>
      <BottomNav active="menu" />
    </View>
  );
}
