// Tiny self-contained Mercator projection. Runs at build time (Node) inside
// Astro frontmatter. The same `toXY` transform is used for both the country
// outline and the location dots, so dots always land exactly on the map — no
// d3 / external map lib needed.

type Lng = number;
type Lat = number;
type Ring = [Lng, Lat][];

interface GeoFeature {
  properties: { id?: string; name?: string; [k: string]: unknown };
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] };
}
export interface GeoJSON {
  features: GeoFeature[];
}

export interface BuiltMap {
  /** SVG viewBox string, e.g. "0 0 820 1000". */
  viewBox: string;
  width: number;
  height: number;
  /** One SVG path per feature (e.g. per Bundesland). */
  states: { id: string; name: string; d: string }[];
  /** Project a lng/lat point into the same viewBox coordinate space. */
  toXY: (lng: number, lat: number) => { x: number; y: number };
  /** Raw transform params so a client can replicate toXY without this module. */
  proj: { minX: number; maxY: number; scale: number; pad: number };
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const mercY = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + toRad(latDeg) / 2));

/** Iterate every polygon (outer + holes) of a feature as a flat list of rings. */
function ringsOf(f: GeoFeature): Ring[] {
  if (f.geometry.type === 'Polygon') return f.geometry.coordinates;
  return f.geometry.coordinates.flat();
}

/** Optional fixed geographic viewport — the SVG is cropped to exactly this box. */
export interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export function buildMap(
  geo: GeoJSON,
  {
    maxWidth = 820,
    maxHeight = 1000,
    padding = 48,
    bounds,
  }: { maxWidth?: number; maxHeight?: number; padding?: number; bounds?: Bounds } = {},
): BuiltMap {
  let minX: number, maxX: number, minY: number, maxY: number;
  let scale: number, width: number, height: number, pad: number;

  if (bounds) {
    // Fixed viewport: project the given corners and fit them to maxWidth,
    // deriving height from the (undistorted) Mercator aspect ratio. Geometry
    // outside the box simply extends past the viewBox and is clipped in SVG.
    minX = toRad(bounds.minLng);
    maxX = toRad(bounds.maxLng);
    minY = mercY(bounds.minLat);
    maxY = mercY(bounds.maxLat);
    pad = 0;
    scale = maxWidth / (maxX - minX);
    width = maxWidth;
    height = Math.round((maxY - minY) * scale);
  } else {
    // Auto-fit: find projected bounds across every coordinate.
    minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
    for (const f of geo.features) {
      for (const ring of ringsOf(f)) {
        for (const [lng, lat] of ring) {
          const x = toRad(lng);
          const y = mercY(lat);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    pad = padding;
    scale = Math.min((maxWidth - 2 * pad) / spanX, (maxHeight - 2 * pad) / spanY);
    width = Math.round(spanX * scale + 2 * pad);
    height = Math.round(spanY * scale + 2 * pad);
  }

  const toXY = (lng: number, lat: number) => ({
    x: pad + (toRad(lng) - minX) * scale,
    // Flip Y: north (large mercY) maps to the top of the SVG.
    y: pad + (maxY - mercY(lat)) * scale,
  });

  // 3. Build one path string per feature.
  const round = (n: number) => Math.round(n * 10) / 10;
  const states = geo.features.map((f) => {
    const d = ringsOf(f)
      .map((ring) =>
        ring
          .map(([lng, lat], i) => {
            const { x, y } = toXY(lng, lat);
            return `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
          })
          .join(' ') + ' Z',
      )
      .join(' ');
    return {
      id: String(f.properties.id ?? ''),
      name: String(f.properties.name ?? ''),
      d,
    };
  });

  return {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    states,
    toXY,
    proj: { minX, maxY, scale, pad },
  };
}
