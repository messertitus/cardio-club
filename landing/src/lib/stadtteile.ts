// Assigns each venue to a Konstanz/Kreuzlingen Stadtteil so the location list can
// be grouped by neighbourhood instead of one long flat list. Resolution:
//   1. name override for known venues (most reliable)
//   2. nearest Stadtteil centroid (works for any new venue from the live data)
// Centroids are curated from OpenStreetMap suburb nodes.

const CENTROIDS: { name: string; lat: number; lng: number }[] = [
  { name: 'Altstadt', lat: 47.662, lng: 9.1751 },
  { name: 'Paradies', lat: 47.6655, lng: 9.1665 },
  { name: 'Petershausen', lat: 47.6735, lng: 9.1832 },
  { name: 'Allmannsdorf', lat: 47.6834, lng: 9.2001 },
  { name: 'Staad', lat: 47.6813, lng: 9.2091 },
  { name: 'Königsbau', lat: 47.6813, lng: 9.1846 },
  { name: 'Industriegebiet', lat: 47.6751, lng: 9.1526 },
  { name: 'Fürstenberg', lat: 47.6851, lng: 9.1557 },
  { name: 'Wollmatingen', lat: 47.6913, lng: 9.1483 },
  { name: 'Kreuzlingen', lat: 47.6508, lng: 9.1756 },
];

// venue-name keyword → Stadtteil (checked first; lower-case substring match).
// Verified against local knowledge / user corrections.
const OVERRIDES: [string, string][] = [
  ['kreuzlingen', 'Kreuzlingen'],
  ['wollmatingen', 'Wollmatingen'],
  ['allmannsdorf', 'Allmannsdorf'],
  ['sonnenbühl', 'Allmannsdorf'],
  ['tannenhof', 'Allmannsdorf'],
  ['horn', 'Staad'],
  ['klein venedig', 'Altstadt'],
  ['wessenberg', 'Paradies'],
  ['humboldt', 'Altstadt'],
  ['schänzle', 'Paradies'],
  ['htwg', 'Paradies'],
  ['herosee', 'Petershausen'],
  ['cherisy', 'Petershausen'],
  ['pestalozzi', 'Petershausen'],
];

export function stadtteilOf(name: string, lat: number, lng: number): string {
  const n = name.toLowerCase();
  for (const [key, st] of OVERRIDES) if (n.includes(key)) return st;
  let best = CENTROIDS[0].name;
  let bestD = Infinity;
  for (const c of CENTROIDS) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = c.name; }
  }
  return best;
}

export interface GroupedVenue { name: string; sports: string[]; sessions: number; lat: number; lng: number; i: number }

/** Group venues by Stadtteil, largest groups first; keeps original index for map sync. */
export function groupByStadtteil<T extends { name: string; lat: number; lng: number }>(
  venues: T[],
): { stadtteil: string; items: (T & { i: number })[] }[] {
  const map = new Map<string, (T & { i: number })[]>();
  venues.forEach((v, i) => {
    const st = stadtteilOf(v.name, v.lat, v.lng);
    if (!map.has(st)) map.set(st, []);
    map.get(st)!.push({ ...v, i });
  });
  return [...map.entries()]
    .map(([stadtteil, items]) => ({ stadtteil, items }))
    .sort((a, b) => b.items.length - a.items.length || a.stadtteil.localeCompare(b.stadtteil, 'de'));
}
