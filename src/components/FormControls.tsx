import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { buildMapsSearchUrl, cleanLocationText, extractCoordinatesFromMapsText } from "../lib/locationSelection";

export function LabeledInput({
  label,
  required,
  helper,
  error,
  ...props
}: TextInputProps & { label: string; required?: boolean; helper?: string; error?: string | null }) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.required, { color: required ? theme.accent : theme.muted }]}>{required ? "Pflicht" : "Optional"}</Text>
      </View>
      {helper ? <Text style={[styles.helper, { color: theme.muted }]}>{helper}</Text> : null}
      <TextInput
        placeholderTextColor={theme.muted}
        style={[styles.input, props.multiline && styles.textArea, { borderColor: error ? "#ff8d7a" : theme.border, backgroundColor: theme.surface, color: theme.text }]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: Array<{ value: T; label: string; helper?: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: theme.text }]}>{label}</Text> : null}
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable key={option.value} style={[styles.segment, { backgroundColor: active ? theme.button : theme.surface, borderColor: theme.border }]} onPress={() => onChange(option.value)}>
              <Text style={[styles.segmentLabel, { color: active ? theme.inverse : theme.text }]}>{option.label}</Text>
              {option.helper ? <Text style={[styles.segmentHelper, { color: active ? theme.inverse : theme.muted }]}>{option.helper}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DetailLine({ label, value }: { label: string; value?: string | null }) {
  const { theme } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.searchField, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        style={[styles.searchInput, { color: theme.text }]}
      />
    </View>
  );
}

export function MapLocationPicker({
  label,
  location,
  mapUrl,
  onLocationChange,
  onMapUrlChange,
  onCoordinatesChange,
  required,
  error,
}: {
  label: string;
  location: string;
  mapUrl: string;
  onLocationChange: (value: string) => void;
  onMapUrlChange: (value: string) => void;
  onCoordinatesChange: (coordinates: { latitude: number | null; longitude: number | null }) => void;
  required?: boolean;
  error?: string | null;
}) {
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState(location);
  const [results, setResults] = useState<Array<{ label: string; latitude: number; longitude: number }>>([]);
  const [searching, setSearching] = useState(false);

  function applyMapText(value: string) {
    onMapUrlChange(value);
    const coordinates = extractCoordinatesFromMapsText(value);
    if (coordinates) {
      onCoordinatesChange(coordinates);
    }
    const nextLocation = cleanLocationText(value);
    if (nextLocation && !location.trim()) {
      onLocationChange(nextLocation);
    }
  }

  async function openMaps() {
    await Linking.openURL(buildMapsSearchUrl(location));
  }

  async function searchLocation() {
    const query = (searchText || location).trim();
    if (!query) return;
    setSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
      setResults(
        payload
          .map((entry) => ({ label: entry.display_name ?? query, latitude: Number(entry.lat), longitude: Number(entry.lon) }))
          .filter((entry) => Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude)),
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result: { label: string; latitude: number; longitude: number }) {
    onLocationChange(result.label);
    onCoordinatesChange({ latitude: result.latitude, longitude: result.longitude });
    onMapUrlChange(`https://www.openstreetmap.org/?mlat=${result.latitude}&mlon=${result.longitude}#map=18/${result.latitude}/${result.longitude}`);
    setSearchText(result.label);
    setResults([]);
  }

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.required, { color: required ? theme.accent : theme.muted }]}>{required ? "Pflicht" : "Optional"}</Text>
      </View>
      <Text style={[styles.helper, { color: theme.muted }]}>Suche den Ort, wähle den passenden Kartentreffer aus und bestätige ihn. Koordinaten werden intern übernommen.</Text>
      <LabeledInput label="Standortname" required={required} value={location} onChangeText={onLocationChange} placeholder="z. B. Stadtgarten Konstanz, Basketballplatz" error={error} />
      <View style={styles.mapSearchRow}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Ort auf Karte suchen"
          placeholderTextColor={theme.muted}
          style={[styles.mapSearchInput, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
        />
        <Pressable style={[styles.mapButton, { backgroundColor: theme.button }]} onPress={searchLocation}>
          <Text style={[styles.mapButtonText, { color: theme.inverse }]}>{searching ? "Suche..." : "Suchen"}</Text>
        </Pressable>
      </View>
      {results.map((result) => (
        <Pressable key={`${result.latitude}-${result.longitude}-${result.label}`} style={[styles.mapResult, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={() => selectResult(result)}>
          <Text style={[styles.mapResultText, { color: theme.text }]} numberOfLines={2}>{result.label}</Text>
          <Text style={[styles.mapResultMeta, { color: theme.muted }]}>Übernehmen</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.mapGhostButton, { borderColor: theme.border }]} onPress={openMaps}>
        <Text style={[styles.mapGhostText, { color: theme.muted }]}>In Karten-App öffnen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  labelRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  label: { flex: 1, fontSize: 13, fontWeight: "900" },
  required: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  helper: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "700",
    outlineStyle: "none",
  } as object,
  textArea: { minHeight: 84, textAlignVertical: "top" },
  error: { color: "#ff8d7a", fontSize: 12, fontWeight: "800", lineHeight: 17 },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { borderRadius: 18, borderWidth: 1, minWidth: 112, paddingHorizontal: 12, paddingVertical: 10 },
  segmentLabel: { fontSize: 13, fontWeight: "900" },
  segmentHelper: { fontSize: 11, fontWeight: "700", lineHeight: 15, marginTop: 2 },
  detailLine: { gap: 2 },
  detailLabel: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  detailValue: { fontSize: 14, fontWeight: "800", lineHeight: 19 },
  searchField: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", minHeight: 48, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "800", outlineStyle: "none" } as object,
  mapSearchRow: { flexDirection: "row", gap: 8 },
  mapSearchInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "800",
    outlineStyle: "none",
  } as object,
  mapButton: { alignItems: "center", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  mapButtonText: { fontSize: 13, fontWeight: "900" },
  mapGhostButton: { alignItems: "center", borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11 },
  mapGhostText: { fontSize: 12, fontWeight: "900" },
  mapResult: { borderRadius: 18, borderWidth: 1, gap: 4, padding: 12 },
  mapResultText: { fontSize: 13, fontWeight: "900", lineHeight: 18 },
  mapResultMeta: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
});
