import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapViewProps } from "./types";

const colorVar: Record<string, string> = {
  live: "var(--success)", recent: "var(--brand-blue)", stale: "var(--warning)", saved: "var(--brand-night)", user: "var(--brand-teal)",
};

export default function LeafletMap({ markers = [], circles = [], polyline, height = 360, onMapClick }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([14.6, -90.5], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "© OpenStreetMap",
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    markers.forEach((mk) => {
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;border:3px solid white;background:${colorVar[mk.status]};box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
      });
      L.marker([mk.lat, mk.lng], { icon, title: mk.label, keyboard: true }).bindPopup(mk.label).addTo(g);
      if (mk.accuracyMeters) L.circle([mk.lat, mk.lng], { radius: mk.accuracyMeters, weight: 1, opacity: 0.4, fillOpacity: 0.08 }).addTo(g);
      pts.push([mk.lat, mk.lng]);
    });
    circles.forEach((c) => {
      L.circle([c.lat, c.lng], { radius: c.radiusMeters, color: "var(--brand-teal)", weight: 2, fillOpacity: 0.12 }).bindTooltip(c.label).addTo(g);
      pts.push([c.lat, c.lng]);
    });
    if (polyline && polyline.length > 1) {
      L.polyline(polyline, { color: "var(--brand-blue)", weight: 4 }).addTo(g);
      polyline.forEach((p) => pts.push(p));
    }
    if (pts.length === 1 && pts[0]) m.setView(pts[0], 16);
    else if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
  }, [markers, circles, polyline]);

  return <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-xl" role="application" aria-label="Mapa" />;
}
