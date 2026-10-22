import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { useFormat } from "@/lib/format";
import type { Organization } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/organizations")({
  head: () => seo("Organizaciones"),
  component: Orgs,
});

function Orgs() {
  const f = useFormat();
  return (
    <>
      <PageHeader title="Organizaciones" />
      <PaginatedTable<Organization>
        path="/admin/organizations"
        queryKey={["admin", "orgs"]}
        filters={[
          {
            name: "planCode",
            label: "Plan",
            options: ["free", "plus", "tracking", "business"].map((p) => ({ value: p, label: p })),
          },
        ]}
        columns={[
          { header: "Nombre", cell: (o) => <span className="font-medium">{o.name}</span> },
          { header: "ID", cell: (o) => <span className="font-mono text-xs">{o.id}</span> },
          { header: "Plan", cell: (o) => o.planCode ?? "—" },
          { header: "Creada", cell: (o) => f.date(o.createdAt, false) },
        ]}
      />
    </>
  );
}
