import { usePreferences, type Preferences } from "@/config/i18n";
import type { Freshness } from "@/types/api";

export function formatDate(iso: string | null | undefined, p: Preferences, withTime = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: p.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const date = p.dateFormat
    .replace("dd", g("day"))
    .replace("MM", g("month"))
    .replace("yyyy", g("year"));
  return withTime ? `${date} ${g("hour")}:${g("minute")}` : date;
}

export function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale === "es" ? "es-GT" : "en-US", { style: "currency", currency }).format(amount);
}

export function useFormat() {
  const { prefs } = usePreferences();
  return {
    date: (iso?: string | null, withTime = true) => formatDate(iso, prefs, withTime),
    money: (n: number, currency?: string) => formatMoney(n, currency ?? prefs.currency, prefs.locale),
    meters: (m?: number | null) =>
      m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`,
  };
}

/** live < 60 s, recent < 15 min, de lo contrario stale */
export function computeFreshness(capturedAt: string, now = Date.now()): Freshness {
  const age = now - new Date(capturedAt).getTime();
  if (age < 60_000) return "live";
  if (age < 15 * 60_000) return "recent";
  return "stale";
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const externalNav = {
  google: (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  waze: (lat: number, lng: number) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
};
