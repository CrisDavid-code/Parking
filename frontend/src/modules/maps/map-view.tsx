import { lazy, Suspense, Component, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { env } from "@/config/env";
import { Skeleton } from "@/components/ui/skeleton";
import { StateView } from "@/components/common/state-view";
import { FreshnessBadge } from "@/components/common/badges";
import type { MapViewProps } from "./types";

const LeafletMap = lazy(() => import("./leaflet-map"));

class MapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function MapFallbackList(props: MapViewProps) {
  return (
    <div className="surface-card p-4">
      <StateView kind="map-unavailable" compact />
      <ul className="divide-y divide-border text-sm">
        {props.markers?.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-2">
            <span>{m.label}</span>
            <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              {m.lat.toFixed(5)}, {m.lng.toFixed(5)} {m.status !== "user" && <FreshnessBadge value={m.status} />}
            </span>
          </li>
        ))}
        {props.circles?.map((c) => (
          <li key={c.id} className="py-2">{c.label} · radio {c.radiusMeters} m</li>
        ))}
      </ul>
    </div>
  );
}

/** Punto de entrada del proveedor de mapas. Cambiar VITE_MAP_PROVIDER para otro proveedor. */
export function MapView(props: MapViewProps) {
  if (env.mapProvider === "none") return <MapFallbackList {...props} />;
  const sk = <Skeleton style={{ height: props.height ?? 360 }} className="w-full rounded-xl" />;
  return (
    <MapBoundary fallback={<MapFallbackList {...props} />}>
      <ClientOnly fallback={sk}>
        <Suspense fallback={sk}>
          <LeafletMap {...props} />
        </Suspense>
      </ClientOnly>
    </MapBoundary>
  );
}
