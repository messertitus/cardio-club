// Resolves a German postal code to its city via the online lookup
// (zippopotam.us, CORS-enabled). This is the single source of truth — no
// hardcoded city tables and no guessing from a digit prefix (a prefix cannot
// identify the city, e.g. 79252 is Stegen, not Konstanz). If the lookup does not
// return a city, we return null and the caller leaves the field for manual entry.

export function isValidGermanPostalCode(postalCode: string): boolean {
  return /^\d{5}$/.test(postalCode);
}

export async function lookupCityByPostalCode(postalCode: string): Promise<string | null> {
  if (!isValidGermanPostalCode(postalCode)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`https://api.zippopotam.us/de/${postalCode}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const payload = (await response.json()) as { places?: Array<{ "place name"?: string }> };
    const city = payload.places?.[0]?.["place name"];
    return typeof city === "string" && city.trim() ? city.trim() : null;
  } catch {
    return null;
  }
}
