import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppActivityTracker } from "../src/components/AppActivityTracker";
import { AppNotificationBridge } from "../src/components/AppNotificationBridge";
import { SwipeNavigator } from "../src/components/SwipeNavigator";
import { TourProvider } from "../src/components/TourGuide";
import { UpdateBanner } from "../src/components/UpdateBanner";
import { AuthProvider } from "../src/context/AuthContext";
import { NavChromeProvider } from "../src/context/NavChromeContext";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import { CACHE_SCHEMA_VERSION } from "../src/lib/appInfo";
import { purgeAppCachesIfOutdated } from "../src/services/localCache";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}

function RootStack() {
  const { mode, theme } = useTheme();

  // Drop stale data caches once per app start when the cache schema changed, so
  // a new build never reads wrongly-shaped cached data.
  useEffect(() => {
    void purgeAppCachesIfOutdated(CACHE_SCHEMA_VERSION);
  }, []);

  // Web only: pin the app to the *visible* (dynamic) viewport. The Expo web reset
  // sizes html/body/#root to height:100%, which on mobile equals the LARGE
  // viewport (browser toolbar hidden) and is taller than what's actually visible
  // — so the fixed bottom navigation bar ends up below the visible screen edge.
  // 100dvh tracks the dynamic viewport and follows the toolbar. We set it as an
  // inline style here (in the bundled app, immune to the static export stripping
  // head <style>/<link>/<script> overrides); an inline style beats the reset's
  // height:100%, and browsers without dvh keep that 100% as a fallback.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.height = "100dvh";
    if (document.body) document.body.style.height = "100dvh";
  }, []);

  return (
    <AuthProvider>
      <NavChromeProvider>
      <TourProvider>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <AppNotificationBridge />
        <AppActivityTracker />
        <UpdateBanner />
        <SwipeNavigator>
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
          <Stack.Screen name="ideas" options={{ title: "Sportarten und Standorte" }} />
          <Stack.Screen name="chat" options={{ title: "Chat" }} />
          <Stack.Screen name="members" options={{ title: "Mitglieder" }} />
          <Stack.Screen name="menu" options={{ title: "Menü" }} />
          <Stack.Screen name="admin" options={{ title: "Admin" }} />
          <Stack.Screen name="invites" options={{ title: "Einladungscodes" }} />
          <Stack.Screen name="settings" options={{ title: "Einstellungen" }} />
          <Stack.Screen name="push" options={{ title: "Push" }} />
          <Stack.Screen name="install" options={{ title: "App installieren" }} />
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
          <Stack.Screen name="events/[eventId]/close" options={{ title: "Event abschließen" }} />
        </Stack>
      </SwipeNavigator>
      </TourProvider>
      </NavChromeProvider>
    </AuthProvider>
  );
}
