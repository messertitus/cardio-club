import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { listUndeliveredAppNotifications, markAppNotificationsDelivered, showBrowserNotification } from "../services";

const POLL_INTERVAL_MS = 45_000;

export function AppNotificationBridge() {
  const { user } = useAuth();
  const busy = useRef(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function syncNotifications() {
      if (!mounted || busy.current || !user) return;
      busy.current = true;
      const result = await listUndeliveredAppNotifications(supabase, user.id);
      if (!result.error && result.data.length > 0) {
        const deliveredIds: string[] = [];
        for (const notification of result.data) {
          const shown = await showBrowserNotification(notification);
          if (shown) deliveredIds.push(notification.id);
        }
        await markAppNotificationsDelivered(supabase, deliveredIds.length > 0 ? deliveredIds : result.data.map((notification) => notification.id));
      }
      busy.current = false;
    }

    void syncNotifications();
    const timer = setInterval(syncNotifications, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [user]);

  return null;
}
