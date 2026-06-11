import { describe, expect, it } from "vitest";
import type { SportProfile } from "../src/lib/decisionTypes";
import { coordinatesForPostalCode, fetchEventWeatherSnapshot } from "../src/services/weather";

describe("weather service", () => {
  it("resolves known postal codes deterministically without external geocoding", () => {
    expect(coordinatesForPostalCode("78462")).toEqual({ latitude: 47.6603, longitude: 9.1758 });
    expect(coordinatesForPostalCode("791xx")).toEqual({ latitude: 47.999, longitude: 7.8421 });
    expect(coordinatesForPostalCode("12")).toBeNull();
  });

  it("fetches weather for profiles with postal code fallback coordinates", async () => {
    const urls: string[] = [];
    const fetcher = async (input: Parameters<typeof fetch>[0]) => {
      urls.push(String(input));
      return {
        ok: true,
        json: async () => ({
          hourly: {
            time: ["2026-06-05T18:00"],
            weather_code: [2],
            temperature_2m: [22],
            precipitation: [0],
            precipitation_probability: [5],
            wind_speed_10m: [12],
            wind_gusts_10m: [18],
          },
        }),
      } as Response;
    };

    const snapshot = await fetchEventWeatherSnapshot(
      [
        {
          id: "postal-profile",
          sportId: "running",
          name: "Postal run",
          postalCode: "78462",
          latitude: null,
          longitude: null,
          locationType: "outdoor",
        } satisfies SportProfile,
      ],
      "2026-06-05T18:00:00Z",
      fetcher,
    );

    expect(urls[0]).toContain("latitude=47.6603");
    expect(urls[0]).toContain("longitude=9.1758");
    expect(snapshot["postal-profile"]?.windSpeedKmh).toBe(12);
  });
});
