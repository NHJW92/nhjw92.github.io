// Small helpers for the logbook details: stop numbers, coordinates and distance travelled.
import type { MapPoint } from './posts';
import type { TravelMode } from './travel';

/** 8°40′S 115°12′E */
export function formatCoords(lat: number, lng: number) {
  const part = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.round((a - d) * 60);
    const [dd, mm] = m === 60 ? [d + 1, 0] : [d, m];
    return `${dd}°${String(mm).padStart(2, '0')}′${v < 0 ? neg : pos}`;
  };
  return `${part(lat, 'N', 'S')} ${part(lng, 'E', 'W')}`;
}

function haversine(a: MapPoint, b: MapPoint) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Straight-line kilometres along the route, leg by leg. */
export function routeKm(points: MapPoint[]) {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversine(points[i - 1], points[i]);
  return Math.round(km);
}

export type Leg = { n: number; mode: TravelMode; from?: string; coords: string };

/** Where a story sits on the route: its stop number and how we got there. */
export function legFor(points: MapPoint[], url: string): Leg | undefined {
  const i = points.findIndex((p) => p.url === url);
  if (i < 0) return undefined;
  const p = points[i];
  return { n: i + 1, mode: p.travel, from: points[i - 1]?.location, coords: formatCoords(p.lat, p.lng) };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
