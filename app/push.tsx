import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
      setMessage("Push ist in diesem Browser nicht verfügbar oder wurde abgelehnt.");
      return;
    }
    const result = await saveWebPushSubscription(supabase, {
      userId: user.id,
      endpoint: subscription.endpoint,
      subscription: subscription.subscription,
    });
    setMessage(result.error ? result.error.message : "Push ist gespeichert.");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Updates</Text>
        <Text style={styles.title}>Push</Text>
        <Text style={styles.body}>Benachrichtigungen für Entscheidung und Event-Updates. Web-Push-Senden braucht serverseitig noch VAPID.</Text>
        {message ? <Text style={styles.notice}>{message}</Text> : null}
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={enablePush}>
          <Text style={styles.buttonText}>Push erlauben</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05080d" },
  content: { gap: 16, padding: 20 },
  kicker: { color: "#65a8ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#f7fbff", fontSize: 38, fontWeight: "900" },
  body: { color: "#aab7c8", fontSize: 16, lineHeight: 24 },
  notice: { color: "#dceaff", fontSize: 14, fontWeight: "900" },
  button: { alignItems: "center", borderRadius: 8, backgroundColor: "#f7fbff", paddingVertical: 15 },
  buttonText: { color: "#05080d", fontSize: 15, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
});
