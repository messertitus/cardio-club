import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabase";

export default function ProfileScreen() {
  const { user } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Account</Text>
        <Text style={styles.title}>Profil</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.value}>{user?.phone ?? "Angemeldet"}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={signOut}>
          <Text style={styles.buttonText}>Abmelden</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  content: { gap: 16, padding: 20 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 38, fontWeight: "900" },
  card: { gap: 5, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)", padding: 16 },
  label: { color: "#728197", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  value: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  button: { alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", paddingVertical: 15 },
  buttonText: { color: "#05070b", fontSize: 15, fontWeight: "900" },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
});
