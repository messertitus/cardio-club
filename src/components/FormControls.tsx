import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

type Coordinates = { latitude: number; longitude: number };
type LocationSearchResult = Coordinates & { label: string };

const DEFAULT_MAP_CENTER: Coordinates = { latitude: 47.6618, longitude: 9.1752 };
const MAP_ZOOM = 16;
const TILE_SIZE = 256;

export function LabeledInput({
  label,
  required,
  helper,
  error,
  ...props
}: TextInputProps & { label: string; required?: boolean; helper?: string; error?: string | null }) {
  const { theme } = useTheme();
  void required;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
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
  latitude,
  longitude,
  onLocationChange,
  onMapUrlChange,
  onCoordinatesChange,
  showNameInput = true,
  onConfirmed,
  required,
  error,
}: {
  label?: string;
  location: string;
  mapUrl: string;
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (value: string) => void;
  onMapUrlChange: (value: string) => void;
  onCoordinatesChange: (coordinates: { latitude: number | null; longitude: number | null }) => void;
  showNameInput?: boolean;
  onConfirmed?: () => void;
  required?: boolean;
  error?: string | null;
}) {
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState(location);
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<Coordinates>(() => coordinatesFromProps(latitude, longitude) ?? DEFAULT_MAP_CENTER);
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(() => coordinatesFromProps(latitude, longitude));
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  void mapUrl;

  useEffect(() => {
    const coordinates = coordinatesFromProps(latitude, longitude);
    if (!coordinates) return;
    setSelectedCoordinates(coordinates);
    setMapCenter(coordinates);
  }, [latitude, longitude]);

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

  function selectResult(result: LocationSearchResult) {
    const displayName = shortLocationName(result.label);
    const coordinates = { latitude: result.latitude, longitude: result.longitude };
    onLocationChange(displayName);
    setSelectedCoordinates(coordinates);
    setMapCenter(coordinates);
    setMapOpen(true);
    setMapNotice(null);
    setSearchText(displayName);
    setResults([]);
  }

  function openMapPicker() {
    const coordinates = selectedCoordinates ?? coordinatesFromProps(latitude, longitude);
    if (coordinates) {
      setSelectedCoordinates(coordinates);
      setMapCenter(coordinates);
    }
    setMapOpen(true);
    setMapNotice(null);
  }

  function pickOnMap(coordinates: Coordinates) {
    setSelectedCoordinates(coordinates);
    if (!location.trim() && searchText.trim()) {
      onLocationChange(shortLocationName(searchText));
    }
  }

  function confirmMapSelection() {
    if (!selectedCoordinates) {
      setMapNotice("Setze zuerst eine Markierung in der Karte.");
      return;
    }
    onCoordinatesChange(selectedCoordinates);
    onMapUrlChange(buildOsmMarkerUrl(selectedCoordinates));
    if (!location.trim()) {
      setMapNotice("Koordinaten übernommen. Bitte gib noch einen kurzen Standortnamen ein.");
    } else {
      setMapNotice("Koordinaten übernommen.");
    }
    setMapOpen(false);
    onConfirmed?.();
  }

  return (
    <View style={styles.field}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        </View>
      ) : null}
      {showNameInput ? (
        <LabeledInput
          label="Kurzname des Standorts"
          required={required}
          value={location}
          onChangeText={onLocationChange}
          placeholder="z. B. Hörnle, Schänzleplatz, Uni-Sporthalle"
          error={error}
        />
      ) : null}
      <Text style={[styles.mapSectionLabel, { color: theme.text }]}>Online suchen</Text>
      <View style={styles.mapSearchRow}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="z. B. Hörnle Konstanz oder Stadtgarten Basketballplatz"
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
          <Text style={[styles.mapResultMeta, { color: theme.muted }]}>Übernehmen als {shortLocationName(result.label)}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.mapGhostButton, { borderColor: theme.border }]} onPress={openMapPicker}>
        <MaterialCommunityIcons name="map-marker-plus" size={18} color={theme.text} />
        <Text style={[styles.mapGhostText, { color: theme.text }]}>{selectedCoordinates ? "Markierung prüfen" : "In Karte markieren"}</Text>
      </Pressable>
      {mapOpen ? (
        <MapPickerModal
          center={mapCenter}
          marker={selectedCoordinates}
          onCenterChange={setMapCenter}
          onPick={pickOnMap}
          onUse={confirmMapSelection}
          onClose={() => setMapOpen(false)}
        />
      ) : null}
      {selectedCoordinates ? (
        <Text style={[styles.helper, { color: theme.muted }]}>
          Markiert: {selectedCoordinates.latitude.toFixed(5)}, {selectedCoordinates.longitude.toFixed(5)}
        </Text>
      ) : null}
      {mapNotice ? <Text style={[styles.helper, { color: mapNotice.startsWith("Koordinaten") || mapNotice.startsWith("Treffer") ? theme.accent : "#ffb5a8" }]}>{mapNotice}</Text> : null}
    </View>
  );
}

function MapPickerModal({
  center,
  marker,
  onCenterChange,
  onPick,
  onUse,
  onClose,
}: {
  center: Coordinates;
  marker: Coordinates | null;
  onCenterChange: (coordinates: Coordinates) => void;
  onPick: (coordinates: Coordinates) => void;
  onUse: () => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 380 });
  const [zoom, setZoom] = useState(MAP_ZOOM);
  const [viewCenter, setViewCenter] = useState(center);
  const viewCenterRef = useRef(center);
  const zoomRef = useRef(MAP_ZOOM);
  const dragStartRef = useRef<{ center: Coordinates; zoom: number; distance: number | null; x: number; y: number } | null>(null);
  const mapMovedRef = useRef(false);
  const lastTouchCountRef = useRef(0);
  const width = size.width || 360;
  const height = size.height;
  const tiles = useMemo(() => mapTiles(viewCenter, width, height, zoom), [height, viewCenter, width, zoom]);
  const markerStyle = marker ? markerScreenStyle(viewCenter, marker, width, height, zoom) : null;

  useEffect(() => {
    setViewCenter(center);
    viewCenterRef.current = center;
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    viewCenterRef.current = viewCenter;
  }, [viewCenter]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches ?? [];
          mapMovedRef.current = false;
          lastTouchCountRef.current = touches.length || 1;
          dragStartRef.current = {
            center: viewCenterRef.current,
            zoom: zoomRef.current,
            distance: touchDistance(touches),
            x: event.nativeEvent.locationX,
            y: event.nativeEvent.locationY,
          };
        },
        onPanResponderMove: (event, gesture) => {
          const start = dragStartRef.current;
          if (!start) return;
          const touches = event.nativeEvent.touches ?? [];
          const touchCount = touches.length || 1;
          lastTouchCountRef.current = Math.max(lastTouchCountRef.current, touchCount || 1);
          if (touchCount > 1 || Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8) {
            mapMovedRef.current = true;
          }
          const currentDistance = touchDistance(touches);
          if (currentDistance && start.distance) {
            const ratio = currentDistance / start.distance;
            const nextZoom = Math.max(3, Math.min(19, Math.round(start.zoom + Math.log2(ratio))));
            if (nextZoom !== zoomRef.current) {
              zoomRef.current = nextZoom;
              setZoom(nextZoom);
              dragStartRef.current = { ...start, distance: currentDistance };
            }
            return;
          }
          const startPixel = worldPixel(start.center, start.zoom);
          const nextCenter = coordinatesFromWorldPixel(startPixel.x - gesture.dx, startPixel.y - gesture.dy, start.zoom);
          viewCenterRef.current = nextCenter;
          setViewCenter(nextCenter);
        },
        onPanResponderRelease: (_event, gesture) => {
          const start = dragStartRef.current;
          dragStartRef.current = null;
          if (!start) return;
          onCenterChange(viewCenterRef.current);
          if (!mapMovedRef.current && lastTouchCountRef.current <= 1 && Math.abs(gesture.dx) <= 4 && Math.abs(gesture.dy) <= 4) {
            onPick(coordinatesFromScreen(viewCenterRef.current, start.x, start.y, width, height, zoomRef.current));
          }
          mapMovedRef.current = false;
          lastTouchCountRef.current = 0;
        },
        onPanResponderTerminate: () => {
          dragStartRef.current = null;
          mapMovedRef.current = false;
          lastTouchCountRef.current = 0;
          onCenterChange(viewCenterRef.current);
        },
      }),
    [height, onCenterChange, onPick, width],
  );

  function zoomBy(delta: number) {
    setZoom((current) => {
      const next = Math.max(3, Math.min(19, current + delta));
      zoomRef.current = next;
      return next;
    });
  }

  function handleWheel(event: { nativeEvent?: { deltaY?: number }; deltaY?: number; preventDefault?: () => void }) {
    const deltaY = event.nativeEvent?.deltaY ?? event.deltaY ?? 0;
    if (!deltaY) return;
    event.preventDefault?.();
    zoomBy(deltaY < 0 ? 1 : -1);
  }

  function stopNativeMapGesture(event: { preventDefault?: () => void; nativeEvent?: { preventDefault?: () => void } }) {
    event.preventDefault?.();
    event.nativeEvent?.preventDefault?.();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.mapModalOverlay}>
        <View style={[styles.mapModalCard, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.inlineMapHeader}>
            <View style={styles.inlineMapTitleWrap}>
              <Text style={[styles.inlineMapTitle, { color: theme.text }]}>Wo genau ist der Standort?</Text>
              <Text style={[styles.inlineMapHelper, { color: theme.muted }]}>Tippen setzt die Markierung. Ziehen verschiebt die Karte, Mausrad oder zwei Finger zoomen.</Text>
            </View>
            <Pressable style={[styles.inlineMapClose, { backgroundColor: theme.softSurface }]} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={19} color={theme.text} />
            </Pressable>
          </View>
          <View
            style={[styles.inlineMapCanvas, { borderColor: theme.border, backgroundColor: theme.softSurface }]}
            onLayout={(event) => {
              const nextWidth = Math.max(260, event.nativeEvent.layout.width);
              setSize({ width: nextWidth, height: 380 });
            }}
            {...panResponder.panHandlers}
            {...({
              onTouchStart: stopNativeMapGesture,
              onTouchMove: stopNativeMapGesture,
              onTouchMoveCapture: stopNativeMapGesture,
              onWheel: handleWheel,
              onWheelCapture: handleWheel,
            } as object)}
          >
            {tiles.map((tile) => (
              <Image key={`${tile.x}-${tile.y}-${zoom}`} source={{ uri: tile.url }} style={[styles.mapTile, styles.mapTilePassive, { left: tile.left, top: tile.top }]} />
            ))}
            <View style={[styles.mapCrosshairHorizontal, { backgroundColor: theme.border }]} />
            <View style={[styles.mapCrosshairVertical, { backgroundColor: theme.border }]} />
            {markerStyle ? (
              <View style={[styles.mapMarker, markerStyle]}>
                <MaterialCommunityIcons name="map-marker" size={34} color={theme.accent} />
              </View>
            ) : null}
            <View style={styles.mapZoomControls}>
              <Pressable style={[styles.mapZoomButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => zoomBy(1)}>
                <MaterialCommunityIcons name="plus" size={18} color={theme.text} />
              </Pressable>
              <Pressable style={[styles.mapZoomButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => zoomBy(-1)}>
                <MaterialCommunityIcons name="minus" size={18} color={theme.text} />
              </Pressable>
            </View>
          </View>
          {marker ? (
            <Text style={[styles.inlineMapHelper, { color: theme.muted }]}>
              Markierung: {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
            </Text>
          ) : (
            <Text style={[styles.inlineMapHelper, { color: "#ffb5a8" }]}>Tippe einmal auf die Karte, bevor du übernimmst.</Text>
          )}
          <Pressable style={[styles.mapUseButton, { backgroundColor: theme.button, opacity: marker ? 1 : 0.44 }]} onPress={onUse} disabled={!marker}>
            <Text style={[styles.mapUseButtonText, { color: theme.inverse }]}>Markierung übernehmen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function touchDistance(touches: ReadonlyArray<{ pageX: number; pageY: number }>): number | null {
  if (touches.length < 2) return null;
  const [first, second] = touches;
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
}

function coordinatesFromProps(latitude?: number | null, longitude?: number | null): Coordinates | null {
  return typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function buildOsmMarkerUrl(coordinates: Coordinates): string {
  return `https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=18/${coordinates.latitude}/${coordinates.longitude}`;
}

function worldPixel(coordinates: Coordinates, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.0511, Math.min(85.0511, coordinates.latitude));
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((coordinates.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function coordinatesFromWorldPixel(x: number, y: number, zoom: number): Coordinates {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const latitudeRadians = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale)));
  return {
    latitude: (latitudeRadians * 180) / Math.PI,
    longitude,
  };
}

function coordinatesFromScreen(center: Coordinates, screenX: number, screenY: number, width: number, height: number, zoom: number): Coordinates {
  const centerPixel = worldPixel(center, zoom);
  return coordinatesFromWorldPixel(centerPixel.x + screenX - width / 2, centerPixel.y + screenY - height / 2, zoom);
}

function markerScreenStyle(center: Coordinates, marker: Coordinates, width: number, height: number, zoom: number) {
  const centerPixel = worldPixel(center, zoom);
  const markerPixel = worldPixel(marker, zoom);
  return {
    left: width / 2 + markerPixel.x - centerPixel.x - 17,
    top: height / 2 + markerPixel.y - centerPixel.y - 34,
  };
}

function mapTiles(center: Coordinates, width: number, height: number, zoom: number): Array<{ x: number; y: number; left: number; top: number; url: string }> {
  const centerPixel = worldPixel(center, zoom);
  const centerTileX = Math.floor(centerPixel.x / TILE_SIZE);
  const centerTileY = Math.floor(centerPixel.y / TILE_SIZE);
  const horizontalRadius = Math.ceil(width / TILE_SIZE / 2) + 1;
  const verticalRadius = Math.ceil(height / TILE_SIZE / 2) + 1;
  const tileCount = 2 ** zoom;
  const tiles: Array<{ x: number; y: number; left: number; top: number; url: string }> = [];

  for (let xOffset = -horizontalRadius; xOffset <= horizontalRadius; xOffset += 1) {
    for (let yOffset = -verticalRadius; yOffset <= verticalRadius; yOffset += 1) {
      const rawX = centerTileX + xOffset;
      const rawY = centerTileY + yOffset;
      if (rawY < 0 || rawY >= tileCount) continue;
      const wrappedX = ((rawX % tileCount) + tileCount) % tileCount;
      tiles.push({
        x: wrappedX,
        y: rawY,
        left: width / 2 + rawX * TILE_SIZE - centerPixel.x,
        top: height / 2 + rawY * TILE_SIZE - centerPixel.y,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${rawY}.png`,
      });
    }
  }

  return tiles;
}

function shortLocationName(value: string): string {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const [first, second] = parts;
  if (!first) return value.trim();
  const candidate = /^\d+$/.test(first) && second ? second : first;
  return candidate.length > 42 ? `${candidate.slice(0, 39).trim()}...` : candidate;
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  labelRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 10 },
  label: { flex: 1, fontSize: 13, fontWeight: "900" },
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
  mapSectionLabel: { fontSize: 12, fontWeight: "900", marginTop: 2 },
  mapSearchRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mapSearchInput: {
    flex: 1,
    minWidth: 190,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "800",
    outlineStyle: "none",
  } as object,
  mapButton: { alignItems: "center", borderRadius: 18, flexGrow: 1, minHeight: 48, minWidth: 96, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  mapButtonText: { fontSize: 13, fontWeight: "900" },
  mapGhostButton: { alignItems: "center", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 11 },
  mapGhostText: { fontSize: 12, fontWeight: "900" },
  mapResult: { borderRadius: 18, borderWidth: 1, gap: 4, padding: 12 },
  mapResultText: { fontSize: 13, fontWeight: "900", lineHeight: 18 },
  mapResultMeta: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  mapModalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 14,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  mapModalCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 720,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
  },
  inlineMapHeader: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  inlineMapTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
  inlineMapTitle: { fontSize: 14, fontWeight: "900" },
  inlineMapHelper: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  inlineMapClose: { alignItems: "center", borderRadius: 999, height: 34, justifyContent: "center", width: 34 },
  inlineMapCanvas: { borderRadius: 18, borderWidth: 1, cursor: "grab", height: 380, overflow: "hidden", overscrollBehavior: "contain", position: "relative", touchAction: "none", userSelect: "none" } as object,
  mapTile: { height: TILE_SIZE, position: "absolute", width: TILE_SIZE },
  mapTilePassive: { pointerEvents: "none" } as object,
  mapCrosshairHorizontal: { height: 1, left: "48%", opacity: 0.45, position: "absolute", right: "48%", top: "50%" },
  mapCrosshairVertical: { bottom: "48%", left: "50%", opacity: 0.45, position: "absolute", top: "48%", width: 1 },
  mapMarker: { height: 34, position: "absolute", width: 34 },
  mapZoomControls: { gap: 8, position: "absolute", right: 12, top: 12 },
  mapZoomButton: { alignItems: "center", borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  mapUseButton: { alignItems: "center", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13 },
  mapUseButtonText: { fontSize: 12, fontWeight: "900" },
});
