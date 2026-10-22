import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { Crosshair, ExternalLink } from "lucide-react";
import { useVehicles } from "@/modules/vehicles/api";
import { useParkingSessions, describeSpot } from "@/modules/parking/api";
import { MapView } from "@/modules/maps/map-view";
import { useGeolocation } from "@/modules/maps/use-geolocation";
import type { MapMarker } from "@/modules/maps/types";
import { PageHeader } from "@/components/common/page-header";
import { StateView, ErrorState, InlineSpinner } from "@/components/common/state-view";
import { FreshnessBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { computeFreshness, externalNav, haversineMeters, useFormat } from "@/lib/format";
import type { LastLocation } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/map")({ head: () => seo("Mapa"), component: MapPage });

function MapPage() {
  const vehicles = useVehicles();
  const parking = useParkingSessions({ status: "active", pageSize: 50 });
  const geo = useGeolocation();
  const f = useFormat();
  const tracked = vehicles.data?.items.filter((v) => v.trackingStatus !== "none") ?? [];
  const lasts = useQueries({
    queries: tracked.map((v) => ({
      queryKey: ["tracking", "last", v.id],
      queryFn: () => api.get<LastLocation>(`/tracking/vehicles/${v.id}/last`),
      refetchInterval: 15_000,
    })),
  });
  const lastsData = lasts.map((l) => l.data);
  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    lastsData.forEach((l) => {
      if (!l) return;
      const v = vehicles.data?.items.find((x) => x.id === l.vehicleId);
      out.push({
        id: `t-${l.vehicleId}`,
        lat: l.latitude,
        lng: l.longitude,
        label: `${v?.alias ?? "Vehículo"} (rastreo)`,
        status: computeFreshness(l.capturedAt),
        accuracyMeters: l.accuracyMeters,
      });
    });
    parking.data?.items.forEach((p) => {
      if (p.latitude == null || p.longitude == null) return;
      const v = vehicles.data?.items.find((x) => x.id === p.vehicleId);
      out.push({
        id: `p-${p.id}`,
        lat: p.latitude,
        lng: p.longitude,
        label: `${v?.alias ?? "Vehículo"} · ${describeSpot(p)}`,
        status: "saved",
        accuracyMeters: p.accuracyMeters,
      });
    });
    if (geo.fix)
      out.push({
        id: "me",
        lat: geo.fix.lat,
        lng: geo.fix.lng,
        label: "Tu ubicación",
        status: "user",
        accuracyMeters: geo.fix.accuracy,
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lastsData), parking.data, vehicles.data, geo.fix]);

  if (vehicles.isPending || parking.isPending) return <StateView kind="loading" />;
  if (vehicles.isError)
    return <ErrorState error={vehicles.error} onRetry={() => vehicles.refetch()} />;
  const vehicleMarkers = markers.filter((m) => m.id !== "me");
  return (
    <>
      <PageHeader
        title="Mapa"
        description="Vehículos rastreados y estacionamientos guardados con coordenadas reales."
        actions={
          <Button
            variant="outline"
            onClick={() => geo.request()}
            disabled={geo.state === "requesting"}
          >
            {geo.state === "requesting" ? <InlineSpinner /> : <Crosshair className="size-4" />}{" "}
            Mostrar mi ubicación
          </Button>
        }
      />
      {geo.state === "denied" && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Permiso de ubicación denegado; no se calcularán distancias.
        </p>
      )}
      {vehicleMarkers.length === 0 ? (
        <StateView
          kind="unknown-position"
          className="surface-card"
          description="No hay ubicaciones reales registradas. Guarda un estacionamiento con GPS o vincula un dispositivo."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MapView markers={markers} height={480} />
          </div>
          <ul className="space-y-2">
            {vehicleMarkers.map((m) => (
              <li key={m.id} className="surface-card space-y-2 p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{m.label}</p>
                  {m.status !== "user" && <FreshnessBadge value={m.status} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.accuracyMeters != null && `Precisión ±${Math.round(m.accuracyMeters)} m`}
                  {geo.fix &&
                    ` · a ${f.meters(haversineMeters({ lat: geo.fix.lat, lng: geo.fix.lng }, m))} de ti`}
                </p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={externalNav.google(m.lat, m.lng)} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" /> Google Maps
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={externalNav.waze(m.lat, m.lng)} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" /> Waze
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
