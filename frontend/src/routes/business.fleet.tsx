import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useGeofences, useOrgVehicles } from "@/modules/fleet/api";
import { MapView } from "@/modules/maps/map-view";
import type { MapMarker } from "@/modules/maps/types";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { FreshnessBadge, TrackingBadge } from "@/components/common/badges";
import { api } from "@/lib/api/client";
import { computeFreshness, useFormat } from "@/lib/format";
import type { LastLocation, Vehicle } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/fleet")({
  head: () => seo("Mapa de flota"),
  component: () => <OrgGate>{(p) => <Fleet orgPath={p} />}</OrgGate>,
});

function Fleet({ orgPath }: { orgPath: string }) {
  const vehicles = useOrgVehicles(orgPath);
  const geofences = useGeofences(orgPath);
  return (
    <>
      <PageHeader
        title="Mapa de flota"
        description="Últimas ubicaciones reales reportadas por dispositivos."
      />
      <QueryView query={vehicles} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <FleetMap
            vehicles={d.items}
            circles={
              geofences.data?.items
                .filter((g) => g.active)
                .map((g) => ({
                  id: g.id,
                  lat: g.centerLat,
                  lng: g.centerLng,
                  radiusMeters: g.radiusMeters,
                  label: g.name,
                })) ?? []
            }
          />
        )}
      </QueryView>
    </>
  );
}

function FleetMap({
  vehicles,
  circles,
}: {
  vehicles: Vehicle[];
  circles: { id: string; lat: number; lng: number; radiusMeters: number; label: string }[];
}) {
  const f = useFormat();
  const tracked = vehicles.filter((v) => v.trackingStatus !== "none");
  const lasts = useQueries({
    queries: tracked.map((v) => ({
      queryKey: ["tracking", "last", v.id],
      queryFn: () => api.get<LastLocation>(`/tracking/vehicles/${v.id}/last`),
      refetchInterval: 15_000,
    })),
  });
  const markers: MapMarker[] = lasts.flatMap((q, i) =>
    q.data && tracked[i]
      ? [
          {
            id: tracked[i].id,
            lat: q.data.latitude,
            lng: q.data.longitude,
            label: tracked[i].alias,
            status: computeFreshness(q.data.capturedAt),
            accuracyMeters: q.data.accuracyMeters,
          },
        ]
      : [],
  );
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {markers.length === 0 && circles.length === 0 ? (
          <StateView kind="unknown-position" className="surface-card" />
        ) : (
          <MapView markers={markers} circles={circles} height={520} />
        )}
      </div>
      <ul className="surface-card divide-y divide-border">
        {vehicles.map((v) => {
          const idx = tracked.findIndex((t) => t.id === v.id);
          const l = idx >= 0 ? lasts[idx]?.data : undefined;
          return (
            <li key={v.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium">{v.alias}</p>
                <p className="text-xs text-muted-foreground">
                  {l ? f.date(l.capturedAt) : "Sin ubicación"}
                </p>
              </div>
              {l ? (
                <FreshnessBadge value={computeFreshness(l.capturedAt)} />
              ) : (
                <TrackingBadge value={v.trackingStatus} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
