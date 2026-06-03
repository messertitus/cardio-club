export type Coordinates = {
  latitude: number;
  longitude: number;
};

const coordinatePatterns = [
  /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
];

export function extractCoordinatesFromMapsText(value: string): Coordinates | null {
  for (const pattern of coordinatePatterns) {
    const match = pattern.exec(value);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (isValidCoordinate(latitude, longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

export function buildMapsSearchUrl(query: string): string {
  const normalized = query.trim();
  if (!normalized) return "https://www.google.com/maps";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalized)}`;
}

export function cleanLocationText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const query = url.searchParams.get("query") ?? url.searchParams.get("q");
    if (query && !extractCoordinatesFromMapsText(query)) return query.replace(/\+/g, " ");
    const pathText = decodeURIComponent(url.pathname)
      .split("/")
      .filter(Boolean)
      .find((part) => part !== "maps" && part !== "place" && !part.startsWith("@"));
    return pathText?.replace(/\+/g, " ") ?? "";
  } catch {
    return trimmed;
  }
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
