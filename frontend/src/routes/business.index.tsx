import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Car, Cpu, Radar, UserCog } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useReportSummary } from "@/modules/fleet/api";
import { TrendChart, BarsChart } from "@/modules/reports/charts";
import { PageHeader, Section } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { Kpi } from "@/components/common/kpi";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/")({ head: () => seo("Panel de empresa"), component: () => <OrgGate>{(p, o) => <Dashboard orgPath={p} name={o.name} />}</OrgGate> });

function Dashboard({ orgPath, name }: { orgPath: string; name: string }) {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const q = useReportSummary(orgPath, from, to);
  return (
    <>
      <PageHeader title={name} description="Resumen de los últimos 7 días" />
      <QueryView query={q}>
        {(d) => (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Vehículos" value={d.totals.vehicles} icon={Car} />
              <Kpi label="Activos" value={d.totals.activeVehicles} icon={Radar} />
              <Kpi label="Conductores" value={d.totals.drivers} icon={UserCog} />
              <Kpi label="Dispositivos" value={d.totals.devices} icon={Cpu} />
              <Kpi label="Alertas" value={d.totals.alerts} icon={AlertTriangle} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Distancia recorrida (km)"><TrendChart data={d.series} x="date" series={[{ key: "distanceKm", label: "km", color: "var(--chart-1)" }]} /></Section>
              <Section title="Estacionamientos y alertas"><BarsChart data={d.series} x="date" series={[{ key: "parkingSessions", label: "Estacionamientos", color: "var(--chart-2)" }, { key: "alerts", label: "Alertas", color: "var(--chart-3)" }]} /></Section>
            </div>
          </div>
        )}
      </QueryView>
    </>
  );
}
