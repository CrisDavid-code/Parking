import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSelectedVehicle } from "@/modules/vehicles/api";
import { VehiclePicker } from "@/modules/vehicles/vehicle-picker";
import { useLastLocation, useLocationHistory } from "@/modules/tracking/api";
import { useNotifications } from "@/modules/notifications/api";
import { MapView } from "@/modules/maps/map-view";
import { PageHeader, Section, Field } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { FreshnessBadge } from "@/components/common/badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeFreshness, useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/tracking")({
  validateSearch: (s: Record<string, unknown>): { vehicleId?: string } => (typeof s["vehicleId"] === "string" ? { vehicleId: s["vehicleId"] } : {}),
  head: () => seo("Rastreo"),
  component: Tracking,
});

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function Tracking() {
  const { vehicleId: fromUrl } = Route.useSearch();
  const { query, vehicle, select } = useSelectedVehicle();
  const v = query.data?.items.find((x) => x.id === fromUrl) ?? vehicle;
  const last = useLastLocation(v && v.trackingStatus !== "none" ? v.id : null);
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 864e5)));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const hist = useLocationHistory(v && v.trackingStatus !== "none" ? v.id : undefined, `${from}T00:00:00Z`, `${to}T23:59:59Z`);
  const alerts = useNotifications(5);
  const f = useFormat();

  if (query.isPending) return <StateView kind="loading" />;
  if (!v) return <StateView kind="empty" title="Sin vehículos" />;
  return (
    <>
      <PageHeader title="Rastreo" description={v.alias} actions={<VehiclePicker vehicles={query.data?.items ?? []} value={v.id} onChange={select} />} />
      {v.trackingStatus === "none" ? (
        <StateView kind="unknown-position" className="surface-card" description="Este vehículo no tiene un dispositivo de rastreo vinculado." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Ubicación actual" actions={last.freshness && <FreshnessBadge value={last.freshness} />}>
            <QueryView query={last} compact>
              {(l) => (
                <div className="space-y-3">
                  {last.freshness === "stale" && <StateView kind="stale" compact />}
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Precisión" value={`±${Math.round(l.accuracyMeters)} m`} />
                    <Field label="Velocidad" value={l.speedMetersPerSecond != null ? `${(l.speedMetersPerSecond * 3.6).toFixed(0)} km/h` : null} />
                    <Field label="Rumbo" value={l.headingDegrees != null ? `${Math.round(l.headingDegrees)}°` : null} />
                    <Field label="Fuente" value={l.source} />
                    <Field label="Capturada" value={f.date(l.capturedAt)} />
                    <Field label="Recibida" value={f.date(l.receivedAt)} />
                  </dl>
                  <p className="text-xs text-muted-foreground">Actualización: {last.transport === "websocket" ? "tiempo real" : "cada 15 s"}</p>
                </div>
              )}
            </QueryView>
          </Section>
          <div className="lg:col-span-2">
            <MapView height={360}
              markers={last.data ? [{ id: "last", lat: last.data.latitude, lng: last.data.longitude, label: v.alias, status: last.freshness ?? "stale", accuracyMeters: last.data.accuracyMeters }] : []}
              polyline={hist.data?.map((p) => [p.latitude, p.longitude] as [number, number])} />
          </div>
          <div className="lg:col-span-2">
            <Section title="Historial de ubicaciones">
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="space-y-1"><Label htmlFor="from">Desde</Label><Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="to">Hasta</Label><Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              </div>
              <QueryView query={hist} isEmpty={(d) => d.length === 0}>
                {(d) => (
                  <div className="max-h-80 overflow-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Coordenadas</TableHead><TableHead>Precisión</TableHead><TableHead>Velocidad</TableHead><TableHead>Frescura</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {d.map((p) => (
                          <TableRow key={p.capturedAt}>
                            <TableCell>{f.date(p.capturedAt)}</TableCell>
                            <TableCell className="font-mono text-xs">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</TableCell>
                            <TableCell>±{Math.round(p.accuracyMeters)} m</TableCell>
                            <TableCell>{p.speedMetersPerSecond != null ? `${(p.speedMetersPerSecond * 3.6).toFixed(0)} km/h` : "—"}</TableCell>
                            <TableCell><FreshnessBadge value={computeFreshness(p.capturedAt)} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </QueryView>
            </Section>
          </div>
          <Section title="Alertas">
            <QueryView query={alerts} compact isEmpty={(d) => d.items.length === 0}>
              {(d) => <ul className="space-y-2 text-sm">{d.items.map((n) => <li key={n.id}><p className="font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{n.body}</p></li>)}</ul>}
            </QueryView>
          </Section>
        </div>
      )}
    </>
  );
}
