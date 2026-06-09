import { useState } from "react";
import { View } from "react-native";
import { BottomNav } from "../src/components/BottomNav";
import { MccBadge, MccBody, MccButton, MccCard, MccCardTitle, MccScreen } from "../src/components/MccDesign";
import { Reveal } from "../src/components/Motion";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";
import { requestWebPushSubscription, saveWebPushSubscription } from "../src/services";

export default function PushScreen() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  async function enablePush() {
    if (!user) return;
    const subscription = await requestWebPushSubscription();
    if (!subscription) {
      setMessage("Push ist in diesem Browser nicht verfuegbar oder wurde abgelehnt.");
      return;
    }

    const result = await saveWebPushSubscription(supabase, {
      userId: user.id,
      endpoint: subscription.endpoint,
      subscription: subscription.subscription,
    });

    setMessage(result.error ? result.error.message : "Push ist gespeichert.");
  }

  const success = message?.includes("gespeichert") ?? false;

  return (
    <View style={{ flex: 1 }}>
      <MccScreen title="Push" kicker="Updates" subtitle="Benachrichtigungen fuer Entscheidungen und Event-Updates." bottomInset={96}>
        <Reveal>
          <MccCard accent>
            <MccBadge icon="bell-ring-outline">Live Updates</MccBadge>
            <MccCardTitle>Cardio Club meldet sich, wenn es zaehlt</MccCardTitle>
            <MccBody muted>Auf dem Handy funktioniert das nach dem Hinzufuegen zum Startbildschirm am zuverlaessigsten.</MccBody>
            {message ? (
              <MccBadge tone={success ? "success" : "danger"} icon={success ? "check-circle-outline" : "alert-circle-outline"}>
                {message}
              </MccBadge>
            ) : null}
            <MccButton label="Push erlauben" icon="bell-plus-outline" onPress={enablePush} />
          </MccCard>
        </Reveal>
      </MccScreen>
      <BottomNav active="menu" />
    </View>
  );
}
