import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";
import { useAuth } from "../src/context/AuthContext";
import { useTheme } from "../src/context/ThemeContext";

export default function ProfileScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <BrandBackground />
      <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { color: theme.accent }]}>Account</Text>
        <Text style={[styles.title, { color: theme.text }]}>Profil</Text>
        <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.softSurface }]}>
          <Text style={[styles.label, { color: theme.muted }]}>Telefon</Text>
          <Text style={[styles.value, { color: theme.text }]}>{user?.phone ?? "Angemeldet"}</Text>
        </View>
      </ScrollView>
      <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  kicker: { color: "#4da3ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "900" },
  card: { gap: 5, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.07)", padding: 16 },
  label: { color: "#728197", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  value: { color: "#ffffff", fontSize: 17, fontWeight: "900" },
  button: { alignItems: "center", borderRadius: 18, backgroundColor: "#ffffff", paddingVertical: 15 },
  buttonText: { color: "#05070b", fontSize: 15, fontWeight: "900" },
});
