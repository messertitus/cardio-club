import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/context/AuthContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}

function RootStack() {
  const { mode, theme } = useTheme();

  return (
    <AuthProvider>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: theme.background },
          headerTitleStyle: { color: theme.text },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: "Profil" }} />
          <Stack.Screen name="ideas" options={{ title: "Sportideen" }} />
          <Stack.Screen name="chat" options={{ title: "Chat" }} />
          <Stack.Screen name="members" options={{ title: "Mitglieder" }} />
          <Stack.Screen name="menu" options={{ title: "Menü" }} />
          <Stack.Screen name="admin" options={{ title: "Admin" }} />
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
