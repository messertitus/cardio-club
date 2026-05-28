import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandBackground } from "../src/components/BrandBackground";
import { BottomNav } from "../src/components/BottomNav";

export default function PinScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandBackground />
      <View style={styles.shell}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>Sicherheit</Text>
          <Text style={styles.title}>PIN</Text>
          <Text style={styles.body}>Deine PIN läuft über Supabase Auth. Ändern der PIN kommt als nächster Schritt über einen sicheren Reset.</Text>
        </ScrollView>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05080d" },
  shell: { flex: 1 },
  content: { gap: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 34 },
  kicker: { color: "#65a8ff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: "#f7fbff", fontSize: 34, fontWeight: "900" },
  body: { color: "#aab7c8", fontSize: 16, lineHeight: 24 },
});
