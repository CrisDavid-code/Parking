import { createFileRoute } from "@tanstack/react-router";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useOrgMutation } from "@/modules/fleet/api";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { OrgAlert } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/alerts")({ head: () => seo("Alertas de flota"), component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate> });

function Page({ orgPath }: { orgPath: string }) {
  const f = useFormat();
  const ack = useOrgMutation((id: string) => api.post(`${orgPath}/alerts/${id}/ack`));
  return (
    <>
      <PageHeader title="Alertas" />
      <PaginatedTable<OrgAlert> path={`${orgPath}/alerts`} queryKey={["org", orgPath, "alerts"]}
        filters={[{ name: "severity", label: "Severidad", options: [{ value: "info", label: "Info" }, { value: "warning", label: "Advertencia" }, { value: "critical", label: "Crítica" }] }]}
        columns={[
          { header: "Fecha", cell: (a) => f.date(a.createdAt) },
          { header: "Tipo", cell: (a) => a.type },
          { header: "Mensaje", cell: (a) => a.message },
          { header: "Severidad", cell: (a) => <Badge variant={a.severity === "critical" ? "destructive" : a.severity === "warning" ? "stale" : "secondary"}>{a.severity}</Badge> },
        ]}
        actions={(a) => a.acknowledged ? <span className="text-xs text-muted-foreground">Atendida</span> : <Button size="sm" variant="ghost" onClick={() => ack.mutate(a.id)}>Marcar atendida</Button>} />
    </>
  );
}
