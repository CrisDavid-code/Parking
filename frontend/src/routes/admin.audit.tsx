import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { useFormat } from "@/lib/format";
import type { AuditEntry } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/audit")({ head: () => seo("Auditoría"), component: Audit });

function Audit() {
  const f = useFormat();
  return (
    <>
      <PageHeader title="Auditoría" />
      <PaginatedTable<AuditEntry> path="/admin/audit" queryKey={["admin", "audit"]} pageSize={20}
        columns={[
          { header: "Fecha", cell: (a) => f.date(a.createdAt) },
          { header: "Actor", cell: (a) => a.actorEmail },
          { header: "Acción", cell: (a) => <span className="font-mono text-xs">{a.action}</span> },
          { header: "Objetivo", cell: (a) => <span className="font-mono text-xs">{a.target}</span> },
          { header: "IP", cell: (a) => a.ip ?? "—" },
        ]} />
    </>
  );
}
