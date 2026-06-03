import { describe, expect, it } from "vitest";
import { buildMapsSearchUrl, cleanLocationText, extractCoordinatesFromMapsText } from "../src/lib/locationSelection";

describe("location selection helpers", () => {
  it("extracts coordinates from Google Maps style URLs", () => {
    expect(extractCoordinatesFromMapsText("https://www.google.com/maps/place/Test/@47.651,9.175,17z")).toEqual({
      latitude: 47.651,
      longitude: 9.175,
    });
    expect(extractCoordinatesFromMapsText("https://maps.google.com/?q=47.65,9.18")).toEqual({
      latitude: 47.65,
      longitude: 9.18,
    });
  });

  it("keeps map search links user-friendly", () => {
    expect(buildMapsSearchUrl("Konstanz Stadtgarten")).toContain("Konstanz%20Stadtgarten");
    expect(buildMapsSearchUrl("")).toBe("https://www.google.com/maps");
    expect(cleanLocationText("Konstanz Stadtgarten")).toBe("Konstanz Stadtgarten");
  });
});
