export type Freshness = 'live' | 'recent' | 'stale';

export const LIVE_MS = 60_000;
export const RECENT_MS = 15 * 60_000;

/** Freshness is computed from capture time, never from the client's claim. */
export function freshness(capturedAt: Date, now = new Date()): Freshness {
  const age = now.getTime() - capturedAt.getTime();
  if (age <= LIVE_MS) return 'live';
  if (age <= RECENT_MS) return 'recent';
  return 'stale';
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
