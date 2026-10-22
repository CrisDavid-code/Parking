import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Car, Cpu, MapPin, Navigation, Plus } from "lucide-react";
import { useSelectedVehicle } from "@/modules/vehicles/api";
import { VehiclePicker } from "@/modules/vehicles/vehicle-picker";
import { useActiveParking, useParkingSessions, describeSpot } from "@/modules/parking/api";
import { useLastLocation } from "@/modules/tracking/api";
import { useDevices } from "@/modules/devices/api";
import { useNotifications } from "@/modules/notifications/api";
import { useMySubscription } from "@/modules/subscriptions/api";
import { useAuth } from "@/modules/auth/auth-context";
import { PageHeader, Section, Field } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView, ErrorState } from "@/components/common/state-view";
import { FreshnessBadge, TrackingBadge, StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";
import { StartNavigationButton } from "@/modules/indoor-navigation/start-button";

export const Route = createFileRoute("/app/")({ head: () => seo("Inicio"), component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const { query, vehicle, select } = useSelectedVehicle();
  const f = useFormat();
  const active = useActiveParking(vehicle?.id);
  const last = useLastLocation(vehicle && vehicle.trackingStatus !== "none" ? vehicle.id : null);
  const recent = useParkingSessions({ vehicleId: vehicle?.id, pageSize: 5 });
  const devices = useDevices();
  const notes = useNotifications(5);
  const sub = useMySubscription();

  if (query.isPending) return <StateView kind="loading" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!vehicle)
    return (
      <>
        <PageHeader title={`Hola, ${user?.fullName.split(" ")[0] ?? ""}`} />
        <StateView kind="empty" title="Agrega tu primer vehículo" description="Para guardar estacionamientos necesitas al menos un vehículo."
          action={<Button asChild><Link to="/app/vehicles/new"><Plus className="size-4" /> Agregar vehículo</Link></Button>} />
      </>
    );
  const p = active.data;
  return (
    <>
      <PageHeader title={`Hola, ${user?.fullName.split(" ")[0] ?? ""}`} description="Resumen de tu vehículo"
        actions={<VehiclePicker vehicles={query.data.items} value={vehicle.id} onChange={select} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="hero-bg relative overflow-hidden rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm opacity-70">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
              <h2 className="text-2xl font-semibold">{vehicle.alias}</h2>
            </div>
            <TrackingBadge value={vehicle.trackingStatus} />
          </div>
          <div className="mt-6">
            {active.isPending ? <p className="opacity-70">Cargando estacionamiento…</p> : active.isError ? (
              <p className="opacity-80">No se pudo cargar el estacionamiento activo.</p>
            ) : p ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest opacity-60">Estacionado</p>
                <p className="font-display text-xl font-semibold">{describeSpot(p)}</p>
                <p className="text-sm opacity-75">{p.address ?? "Sin dirección"} · {f.date(p.startedAt)}{p.accuracyMeters != null && ` · ±${Math.round(p.accuracyMeters)} m`}</p>
              </div>
            ) : (
              <p className="opacity-80">No hay un estacionamiento activo para este vehículo.</p>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {p ? <StartNavigationButton parkingSessionId={p.id} label="Encontrar mi vehículo" className="shadow-glow" /> : null}
            <Button asChild variant={p ? "secondary" : "default"}><Link to="/app/parking/new"><MapPin className="size-4" /> Guardar estacionamiento</Link></Button>
          </div>
        </section>
        <Section title="Última ubicación">
          {vehicle.trackingStatus === "none" ? (
            <StateView kind="unknown-position" compact description="Este vehículo no tiene rastreo. Vincula un dispositivo."
              action={<Button asChild size="sm" variant="outline"><Link to="/app/devices">Dispositivos</Link></Button>} />
          ) : (
            <QueryView query={last} compact>
              {(l) => (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Frescura" value={last.freshness && <FreshnessBadge value={last.freshness} />} />
                  <Field label="Precisión" value={`±${Math.round(l.accuracyMeters)} m`} />
                  <Field label="Capturada" value={f.date(l.capturedAt)} />
                  <Field label="Canal" value={last.transport === "websocket" ? "Tiempo real" : "Cada 15 s"} />
                  <div className="col-span-2"><Button asChild size="sm" variant="outline"><Link to="/app/tracking"><Navigation className="size-4" /> Ver rastreo</Link></Button></div>
                </dl>
              )}
            </QueryView>
          )}
        </Section>
        <Section title="Alertas" actions={<Link to="/app/notifications" className="text-xs text-primary">Ver todas</Link>}>
          <QueryView query={notes} compact isEmpty={(d) => d.items.length === 0} empty={<StateView kind="empty" compact description="Sin alertas recientes." />}>
            {(d) => (
              <ul className="space-y-3">
                {d.items.map((n) => (
                  <li key={n.id} className="flex gap-3 text-sm">
                    <Bell className={`mt-0.5 size-4 shrink-0 ${n.readAt ? "text-muted-foreground" : "text-primary"}`} aria-hidden />
                    <div><p className="font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{f.date(n.createdAt)}</p></div>
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
        </Section>
        <Section title="Historial reciente" actions={<Link to="/app/history" className="text-xs text-primary">Ver historial</Link>}>
          <QueryView query={recent} compact isEmpty={(d) => d.items.length === 0}>
            {(d) => (
              <ul className="divide-y divide-border text-sm">
                {d.items.map((s) => (
                  <li key={s.id}><Link to="/app/parking/$id" params={{ id: s.id }} className="flex justify-between gap-2 py-2 hover:text-primary">
                    <span className="truncate">{describeSpot(s)}</span><span className="shrink-0 text-xs text-muted-foreground">{f.date(s.startedAt, false)}</span>
                  </Link></li>
                ))}
              </ul>
            )}
          </QueryView>
        </Section>
        <Section title="Dispositivos y plan">
          <div className="space-y-4 text-sm">
            <QueryView query={devices} compact>
              {(d) => (
                <p className="flex items-center gap-2"><Cpu className="size-4 text-primary" aria-hidden />
                  {d.items.filter((x) => x.status === "active").length} activos de {d.total}</p>
              )}
            </QueryView>
            <QueryView query={sub} compact>
              {(s) => (
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2"><Car className="size-4 text-teal" aria-hidden /> Plan <strong className="uppercase">{s.planCode}</strong></p>
                  <StatusBadge value={s.status} />
                </div>
              )}
            </QueryView>
            <Button asChild variant="outline" size="sm"><Link to="/app/subscription">Gestionar plan</Link></Button>
          </div>
        </Section>
      </div>
    </>
  );
}
