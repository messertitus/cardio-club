import type { SportProfile, WeatherCondition, ProfileWeatherSnapshot } from "../lib/fairConstellationSelection";

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
  const profilesWithCoordinates = profiles.filter(hasCoordinates);

  await Promise.all(
    profilesWithCoordinates.map(async (profile) => {
      const url = buildOpenMeteoUrl(profile.latitude as number, profile.longitude as number);
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
