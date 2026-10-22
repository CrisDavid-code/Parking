import { useCallback, useState } from "react";

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}
type GeoState = "idle" | "requesting" | "ok" | "denied" | "unavailable" | "error";

/** Solicita la geolocalización solo cuando el usuario la pide. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>("idle");
  const [fix, setFix] = useState<GeoFix | null>(null);
  const request = useCallback(
    () =>
      new Promise<GeoFix | null>((resolve) => {
        if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
          setState("unavailable");
          return resolve(null);
        }
        setState("requesting");
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const f = {
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracy: p.coords.accuracy,
              at: p.timestamp,
            };
            setFix(f);
            setState("ok");
            resolve(f);
          },
          (err) => {
            setState(err.code === err.PERMISSION_DENIED ? "denied" : "error");
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      }),
    [],
  );
  return { state, fix, request };
}
