import type { SportProfile, WeatherCondition, ProfileWeatherSnapshot } from "./algorithm.ts";

export type WeatherFetch = typeof fetch;

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m?: Array<number | null>;
    precipitation?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
  };
};

export async function fetchEventWeatherSnapshot(
  profiles: SportProfile[],
  startsAt?: string | null,
  fetcher: WeatherFetch = fetch,
): Promise<ProfileWeatherSnapshot> {
  if (!startsAt) {
    return {};
  }

  const snapshot: ProfileWeatherSnapshot = {};
  const profilesWithWeatherLocation = profiles
    .map((profile) => ({ profile, coordinates: coordinatesForProfile(profile) }))
    .filter((entry): entry is { profile: SportProfile; coordinates: { latitude: number; longitude: number } } => Boolean(entry.coordinates));

  await Promise.all(
    profilesWithWeatherLocation.map(async ({ profile, coordinates }) => {
      const url = buildOpenMeteoUrl(coordinates.latitude, coordinates.longitude);
      try {
        const response = await fetcher(url);
        if (!response.ok) return;
        const payload = (await response.json()) as OpenMeteoResponse;
        snapshot[profile.id] = pickClosestWeather(payload, startsAt);
      } catch {
        snapshot[profile.id] = undefined;
      }
    }),
  );

  return snapshot;
}

function buildOpenMeteoUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: [
      "weather_code",
      "temperature_2m",
      "precipitation",
      "precipitation_probability",
      "wind_speed_10m",
      "wind_gusts_10m",
    ].join(","),
    forecast_days: "7",
    timezone: "auto",
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function pickClosestWeather(payload: OpenMeteoResponse, startsAt: string): WeatherCondition | undefined {
  const hourly = payload.hourly;
  const times = hourly?.time ?? [];
  if (!hourly || times.length === 0) return undefined;

  const target = new Date(startsAt).getTime();
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const parsed = Date.parse(time);
    if (!Number.isFinite(parsed)) return;
    const distance = Math.abs(parsed - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return {
    weatherCode: hourly.weather_code?.[bestIndex] ?? null,
    temperatureC: hourly.temperature_2m?.[bestIndex] ?? null,
    precipitationMm: hourly.precipitation?.[bestIndex] ?? null,
    precipitationProbability: hourly.precipitation_probability?.[bestIndex] ?? null,
    windSpeedKmh: hourly.wind_speed_10m?.[bestIndex] ?? null,
    windGustsKmh: hourly.wind_gusts_10m?.[bestIndex] ?? null,
  };
}

function hasCoordinates(profile: SportProfile): boolean {
  return typeof profile.latitude === "number" && typeof profile.longitude === "number";
}

function coordinatesForProfile(profile: SportProfile): { latitude: number; longitude: number } | null {
  if (hasCoordinates(profile)) {
    return { latitude: profile.latitude as number, longitude: profile.longitude as number };
  }

  return coordinatesForPostalCode(profile.postalCode);
}

export function coordinatesForPostalCode(postalCode?: string | null): { latitude: number; longitude: number } | null {
  const normalized = postalCode?.replace(/\D/g, "").slice(0, 5);
  if (!normalized || normalized.length < 2) return null;

  const exact: Record<string, { latitude: number; longitude: number }> = {
    "78462": { latitude: 47.6603, longitude: 9.1758 },
    "78464": { latitude: 47.6813, longitude: 9.1986 },
    "78465": { latitude: 47.7352, longitude: 9.1311 },
    "78467": { latitude: 47.6886, longitude: 9.1544 },
    "79098": { latitude: 47.9978, longitude: 7.8522 },
    "79100": { latitude: 47.9792, longitude: 7.8508 },
    "79104": { latitude: 48.0114, longitude: 7.8603 },
    "79110": { latitude: 48.0184, longitude: 7.7904 },
  };
  if (exact[normalized]) return exact[normalized];

  const prefix = normalized.slice(0, 2);
  const prefixCoordinates: Record<string, { latitude: number; longitude: number }> = {
    "78": { latitude: 47.6779, longitude: 9.1732 },
    "79": { latitude: 47.999, longitude: 7.8421 },
  };

  return prefixCoordinates[prefix] ?? null;
}
