import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#05080d" },
          headerTitleStyle: { color: "#f7fbff" },
          headerTintColor: "#f7fbff",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#05080d" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: "Profil" }} />
        <Stack.Screen name="ideas" options={{ title: "Sportideen" }} />
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
        <Stack.Screen name="members" options={{ title: "Mitglieder" }} />
        <Stack.Screen name="menu" options={{ title: "Menü" }} />
        <Stack.Screen name="invites" options={{ title: "Einladungscodes" }} />
        <Stack.Screen name="pin" options={{ title: "PIN" }} />
        <Stack.Screen name="push" options={{ title: "Push" }} />
        <Stack.Screen name="auth" options={{ title: "Anmelden" }} />
        <Stack.Screen name="clubs/index" options={{ title: "Clubs" }} />
        <Stack.Screen name="clubs/create" options={{ title: "Club erstellen" }} />
        <Stack.Screen name="clubs/[clubId]/index" options={{ title: "Club" }} />
        <Stack.Screen name="clubs/[clubId]/event" options={{ title: "Diese Woche" }} />
        <Stack.Screen name="clubs/[clubId]/history" options={{ title: "Verlauf" }} />
        <Stack.Screen name="events/[eventId]/propose" options={{ title: "Sportart vorschlagen" }} />
        <Stack.Screen name="events/[eventId]/vote" options={{ title: "Abstimmen" }} />
        <Stack.Screen name="events/[eventId]/decision" options={{ title: "Entscheidung" }} />
        <Stack.Screen name="events/[eventId]/attendance" options={{ title: "Teilnahme" }} />
      </Stack>
    </AuthProvider>
  );
}
