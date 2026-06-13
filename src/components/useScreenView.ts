import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { trackAppEvent } from "../services/analytics";
import type { StatKey } from "../lib/analyticsEvents";

// Records one "screen viewed" breadcrumb per signed-in mount. Fire-and-forget;
// safe to drop into any screen. Counts navigation interest without any content.
export function useScreenView(screenKey: StatKey): void {
  const { user } = useAuth();
  const trackedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      trackedFor.current = null;
      return;
    }
    if (trackedFor.current === user.id) return;
    trackedFor.current = user.id;
    void trackAppEvent(supabase, screenKey);
  }, [screenKey, user]);
}
