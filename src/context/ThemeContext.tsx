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
    mcc: {
      background: "#05070b",
      canvas: "#07111F",
      surface: "rgba(10,18,31,0.94)",
      surfaceRaised: "rgba(17,28,45,0.96)",
      surfaceSoft: "rgba(255,255,255,0.08)",
      textPrimary: "#F7FBFF",
      textSecondary: "#A7B4C7",
      textMuted: "#718198",
      accent: "#4DA3FF",
      accentDeep: "#1677FF",
      accentSoft: "rgba(77,163,255,0.16)",
      accentFaint: "rgba(77,163,255,0.08)",
      line: "rgba(255,255,255,0.12)",
      strongLine: "rgba(77,163,255,0.42)",
      success: "#5EEAD4",
      warning: "#F59E0B",
      danger: "#FF8D7A",
      dangerSoft: "rgba(255,141,122,0.14)",
      shadow: "#1677FF",
    },
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
    mcc: {
      background: "#F7F9FC",
      canvas: "#EDF4FF",
      surface: "rgba(255,255,255,0.96)",
      surfaceRaised: "#FFFFFF",
      surfaceSoft: "rgba(8,17,31,0.055)",
      textPrimary: "#08111F",
      textSecondary: "#556274",
      textMuted: "#7A8798",
      accent: "#1677FF",
      accentDeep: "#003D8F",
      accentSoft: "#DCEBFF",
      accentFaint: "rgba(22,119,255,0.08)",
      line: "rgba(8,17,31,0.12)",
      strongLine: "rgba(22,119,255,0.34)",
      success: "#16A34A",
      warning: "#F59E0B",
      danger: "#EF4444",
      dangerSoft: "rgba(239,68,68,0.1)",
      shadow: "#1677FF",
    },
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
