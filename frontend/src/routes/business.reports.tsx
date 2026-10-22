import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useReportSummary } from "@/modules/fleet/api";
import { TrendChart, BarsChart } from "@/modules/reports/charts";
import { PageHeader, Section } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReportSummary } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/reports")({
  head: () => seo("Reportes"),
  component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate>,
});

function toCsv(d: ReportSummary) {
  return [
    "fecha,distancia_km,estacionamientos,alertas",
    ...d.series.map((r) => `${r.date},${r.distanceKm},${r.parkingSessions},${r.alerts}`),
  ].join("\n");
}

function Page({ orgPath }: { orgPath: string }) {
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const q = useReportSummary(orgPath, from, to);
  const download = () => {
    if (!q.data) return;
    const url = URL.createObjectURL(new Blob([toCsv(q.data)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title="Reportes"
        actions={
          <Button variant="outline" onClick={download} disabled={!q.data}>
            <Download className="size-4" /> Exportar CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <QueryView query={q} isEmpty={(d) => d.series.length === 0}>
        {(d) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Distancia (km)">
              <TrendChart
                data={d.series}
                x="date"
                series={[{ key: "distanceKm", label: "km", color: "var(--chart-1)" }]}
              />
            </Section>
            <Section title="Estacionamientos">
              <BarsChart
                data={d.series}
                x="date"
                series={[{ key: "parkingSessions", label: "Sesiones", color: "var(--chart-2)" }]}
              />
            </Section>
            <Section title="Alertas">
              <BarsChart
                data={d.series}
                x="date"
                series={[{ key: "alerts", label: "Alertas", color: "var(--chart-5)" }]}
              />
            </Section>
          </div>
        )}
      </QueryView>
    </>
  );
}
