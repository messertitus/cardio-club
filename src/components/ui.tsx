import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PropsWithChildren, ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";

export function Screen({ children, title, subtitle }: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const backgroundColor =
    variant === "primary" ? theme.mcc.accentDeep : variant === "secondary" ? theme.mcc.surfaceSoft : "transparent";
  const textColor = variant === "primary" ? "#FFFFFF" : theme.mcc.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: variant === "secondary" ? theme.mcc.line : "transparent", borderWidth: variant === "secondary" ? 1 : 0 },
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#8a948f" style={styles.input} {...props} />
    </View>
  );
}

export function Pill({ children }: PropsWithChildren) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </Card>
  );
}

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color="#4da3ff" />
      <Text style={styles.muted}>Laden...</Text>
    </View>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) {
    return null;
  }

  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#05070b",
  },
  screen: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#9aa7b8",
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 14,
    shadowColor: "#0b1510",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    color: "#9aa7b8",
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: "#9aa7b8",
    fontSize: 14,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  buttonText: {
    color: "#05070b",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonTextSecondary: {
    color: "#ffffff",
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#edf4ff",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: 16,
    paddingHorizontal: 12,
    outlineStyle: "none",
  } as object,
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(77,163,255,0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    color: "#8fc7ff",
    fontSize: 13,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    gap: 10,
    padding: 24,
  },
  error: {
    color: "#a03a2d",
    fontSize: 14,
    lineHeight: 20,
  },
});

export const ui = styles;
