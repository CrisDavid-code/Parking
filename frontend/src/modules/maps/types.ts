import type { Freshness } from "@/types/api";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  status: Freshness | "saved" | "user";
  accuracyMeters?: number | null | undefined;
}
export interface MapCircle {
  id: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  label: string;
}
/** Contrato común para cualquier proveedor de mapas (Leaflet hoy, otros mañana). */
export interface MapViewProps {
  markers?: MapMarker[] | undefined;
  circles?: MapCircle[] | undefined;
  polyline?: [number, number][] | undefined;
  height?: number | undefined;
  onMapClick?: ((lat: number, lng: number) => void) | undefined;
}
