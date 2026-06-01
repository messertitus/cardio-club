import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

export type ThemeMode = "dark" | "light";

const THEME_KEY = "mcc.theme";

export const themes = {
  dark: {
    mode: "dark" as const,
    background: "#05070b",
    surface: "rgba(12,17,27,0.94)",
    softSurface: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.12)",
    text: "#ffffff",
    muted: "#9aa7b8",
    accent: "#4da3ff",
    inverse: "#05070b",
    button: "#ffffff",
  },
  light: {
    mode: "light" as const,
    background: "#f7f8fb",
    surface: "rgba(255,255,255,0.94)",
    softSurface: "rgba(255,255,255,0.82)",
    border: "rgba(9,17,32,0.2)",
    text: "#07111f",
    muted: "#667085",
    accent: "#0066cc",
    inverse: "#ffffff",
    button: "#07111f",
  },
};

export type AppTheme = (typeof themes)[ThemeMode];

type ThemeContextValue = {
  mode: ThemeMode;
  theme: AppTheme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  theme: themes.dark,
  toggleTheme: () => undefined,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") setMode(stored);
    });
  }, []);

  function toggleTheme() {
    setMode((current) => {
      const next = current === "dark" ? "light" : "dark";
      void AsyncStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

  const value = useMemo(() => ({ mode, theme: themes[mode], toggleTheme }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
