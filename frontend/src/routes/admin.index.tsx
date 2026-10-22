import { createFileRoute } from "@tanstack/react-router";
import { Activity, Car, Cpu, Users } from "lucide-react";
import { useAdminHealth, useAdminUsage } from "@/modules/admin/api";
import { PageHeader, Section } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { Kpi } from "@/components/common/kpi";
import { StatusBadge } from "@/components/common/badges";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/")({
  head: () => seo("Panel de administración"),
  component: AdminHome,
});

function AdminHome() {
  const usage = useAdminUsage();
  const health = useAdminHealth();
  const f = useFormat();
  return (
    <>
      <PageHeader title="Administración" />
      <div className="space-y-4">
        <QueryView query={usage}>
          {(u) => (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Usuarios activos" value={u.activeUsers} icon={Users} />
              <Kpi label="Vehículos" value={u.vehicles} icon={Car} />
              <Kpi label="Estacionamientos 30 d" value={u.parkingSessions30d} icon={Activity} />
              <Kpi label="Dispositivos activos" value={u.devicesActive} icon={Cpu} />
            </div>
          )}
        </QueryView>
        <Section
          title="Estado de servicios"
          actions={
            health.data && (
              <span className="text-xs text-muted-foreground">
                Verificado {f.date(health.data.checkedAt)}
              </span>
            )
          }
        >
          <QueryView query={health} isEmpty={(h) => h.services.length === 0}>
            {(h) => (
              <ul className="grid gap-2 sm:grid-cols-3">
                {h.services.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.latencyMs != null && `${s.latencyMs} ms`}
                      <StatusBadge value={s.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
        </Section>
      </div>
    </>
  );
}
