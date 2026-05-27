import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomNav } from "../src/components/BottomNav";

const logo = require("../assets/mcc-logo-white-symbol-transparent.png");

export default function MenuScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Menü</Text>
          </View>
          <View style={styles.grid}>
            <MenuItem title="Einladungscodes" body="Zugang teilen" onPress={() => router.push("/invites")} featured />
            <MenuItem title="Sportideen" body="Neue Aktivität vorschlagen" onPress={() => router.push("/ideas")} />
            <MenuItem title="PIN" body="Sicherheit" onPress={() => router.push("/pin")} />
            <MenuItem title="Push" body="Benachrichtigungen" onPress={() => router.push("/push")} />
            <MenuItem title="Profil" body="Account" onPress={() => router.push("/profile")} />
          </View>
        </View>
        <BottomNav active="menu" />
      </View>
    </SafeAreaView>
  );
}

function MenuItem({ title, body, onPress, featured = false }: { title: string; body: string; onPress: () => void; featured?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.item, featured && styles.itemFeatured, pressed && styles.itemPressed]} onPress={onPress}>
      <View style={[styles.marker, featured && styles.markerFeatured]} />
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemBody}>{body}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#05070b" },
  shell: { flex: 1 },
  content: { flex: 1, gap: 24, padding: 18 },
  header: { alignItems: "center", flexDirection: "row", gap: 14, paddingTop: 8 },
  logo: { width: 54, height: 54 },
  title: { color: "#ffffff", fontSize: 38, fontWeight: "900", letterSpacing: 0 },
  grid: { gap: 10 },
  item: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },
  itemFeatured: {
    borderColor: "rgba(77,163,255,0.55)",
    backgroundColor: "rgba(77,163,255,0.14)",
  },
  itemPressed: { transform: [{ scale: 0.99 }], opacity: 0.86 },
  marker: { width: 10, height: 36, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  markerFeatured: { backgroundColor: "#4da3ff" },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { color: "#ffffff", fontSize: 19, fontWeight: "900" },
  itemBody: { color: "#9aa7b8", fontSize: 14, lineHeight: 20 },
  arrow: { color: "#4da3ff", fontSize: 34, fontWeight: "500", lineHeight: 34 },
});
