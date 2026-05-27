import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PinScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Sicherheit</Text>
        <Text style={styles.title}>PIN</Text>
        <Text style={styles.body}>Deine PIN läuft über Supabase Auth. Ändern der PIN kommt als nächster Schritt über einen sicheren Reset-Link.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05080d" },
  content: { gap: 14, padding: 20 },
  kicker: { color: "#65a8ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#f7fbff", fontSize: 38, fontWeight: "900" },
  body: { color: "#aab7c8", fontSize: 16, lineHeight: 24 },
});
