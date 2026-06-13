import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { trackAppEvent } from "../services/analytics";
import { isStandaloneDisplay } from "../services/pwaInstallHint";
import { APP_EVENTS } from "../lib/analyticsEvents";

// Records app-engagement breadcrumbs once per signed-in session: that the app
// was opened (session started + last active), and whether it runs as an
// installed PWA (standalone). Fire-and-forget and in-app only — no background
// tracking, no location, no content. Mirrors AppNotificationBridge's shape so
// it sits quietly next to the rest of the root layout.
export function AppActivityTracker() {
  const { user } = useAuth();
  const trackedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      trackedForUser.current = null;
      return;
    }
    if (trackedForUser.current === user.id) return;
    trackedForUser.current = user.id;

    void trackAppEvent(supabase, APP_EVENTS.sessionStarted);
    if (isStandaloneDisplay()) {
      void trackAppEvent(supabase, APP_EVENTS.standaloneDetected);
    }
  }, [user]);

  return null;
}
