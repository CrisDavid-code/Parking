import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { StatusBadge } from "@/components/common/badges";
import { api, errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { SupportTicket } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/support")({
  head: () => seo("Soporte (admin)"),
  component: AdminSupport,
});

function AdminSupport() {
  const f = useFormat();
  const qc = useQueryClient();
  const setStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/support/${id}`, { status });
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["admin", "support"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader title="Casos de soporte" />
      <PaginatedTable<SupportTicket>
        path="/admin/support"
        queryKey={["admin", "support"]}
        filters={[
          {
            name: "status",
            label: "Estado",
            options: [
              { value: "open", label: "Abierto" },
              { value: "pending", label: "Pendiente" },
              { value: "closed", label: "Cerrado" },
            ],
          },
        ]}
        columns={[
          { header: "Fecha", cell: (t) => f.date(t.createdAt) },
          { header: "Usuario", cell: (t) => t.userEmail ?? "—" },
          { header: "Asunto", cell: (t) => <span className="font-medium">{t.subject}</span> },
          { header: "Estado", cell: (t) => <StatusBadge value={t.status} /> },
        ]}
        actions={(t) => (
          <select
            aria-label="Cambiar estado"
            className="native-select w-32"
            defaultValue={t.status}
            onChange={(e) => setStatus(t.id, e.target.value)}
          >
            <option value="open">Abierto</option>
            <option value="pending">Pendiente</option>
            <option value="closed">Cerrado</option>
          </select>
        )}
      />
    </>
  );
}
