import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { supabase } from "../lib/supabase";
import { resetMccBootstrapCache } from "../services/liveApp";
import { resetPrefetchGuard } from "../services/prefetch";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  const signOutForInactivity = useCallback(async () => {
    clearLogoutTimer();
    await supabase.auth.signOut();
  }, [clearLogoutTimer]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearLogoutTimer();

    if (!session) return;

    logoutTimerRef.current = setTimeout(() => {
      void signOutForInactivity();
    }, INACTIVITY_LIMIT_MS);
  }, [clearLogoutTimer, session, signOutForInactivity]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Drop the session-memoized week bootstrap and the prefetch guard when the
      // user signs out, so the next account re-runs ensure_mcc_week and re-warms
      // its own caches instead of reusing a stale memo.
      if (!nextSession) {
        resetMccBootstrapCache();
        resetPrefetchGuard();
      }
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      markActivity();
      return clearLogoutTimer;
    }

    clearLogoutTimer();
    return undefined;
  }, [clearLogoutTimer, markActivity, session]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") markActivity();
    });

    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    if (typeof window !== "undefined") {
      events.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    }

    return () => {
      subscription.remove();
      if (typeof window !== "undefined") {
        events.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      }
    };
  }, [markActivity]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
    }),
    [loading, session],
  );

  return (
    <AuthContext.Provider value={value}>
      <View style={styles.activityRoot} onTouchStart={markActivity}>
        {children}
      </View>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

const styles = StyleSheet.create({
  activityRoot: { flex: 1 },
});
