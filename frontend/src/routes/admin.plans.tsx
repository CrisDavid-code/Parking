import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { FormDialog } from "@/components/common/form-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { Plan } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/plans")({ head: () => seo("Planes"), component: Plans });

const num = (msg: string) => z.number({ invalid_type_error: msg }).min(0);
const schema = z.object({ name: z.string().min(1), priceMonthly: num("Precio inválido"), currency: z.string().length(3, "Código ISO de 3 letras"),
  vehicles: num("Inválido"), devices: num("Inválido"), historyDays: num("Inválido"), members: num("Inválido") });

function Plans() {
  const f = useFormat();
  const qc = useQueryClient();
  return (
    <>
      <PageHeader title="Planes" />
      <PaginatedTable<Plan & { id: string }> path="/admin/plans" queryKey={["admin", "plans"]} searchable={false}
        columns={[
          { header: "Código", cell: (p) => <span className="font-mono">{p.code}</span> },
          { header: "Nombre", cell: (p) => p.name },
          { header: "Precio", cell: (p) => f.money(p.priceMonthly, p.currency) },
          { header: "Límites", cell: (p) => `${p.limits.vehicles} veh · ${p.limits.devices} disp · ${p.limits.historyDays} d · ${p.limits.members} miem` },
        ]}
        actions={(p) => (
          <FormDialog title={`Editar plan ${p.code}`} schema={schema} trigger={<Button size="sm" variant="ghost">Editar</Button>}
            defaultValues={{ name: p.name, priceMonthly: p.priceMonthly, currency: p.currency, ...p.limits }}
            fields={[{ name: "name", label: "Nombre" }, { name: "priceMonthly", label: "Precio mensual", type: "number" }, { name: "currency", label: "Moneda" },
              { name: "vehicles", label: "Vehículos", type: "number" }, { name: "devices", label: "Dispositivos", type: "number" },
              { name: "historyDays", label: "Días de historial", type: "number" }, { name: "members", label: "Miembros", type: "number" }]}
            onSubmit={async (d) => {
              const { vehicles, devices, historyDays, members, ...rest } = d;
              await api.patch(`/admin/plans/${p.code}`, { ...rest, limits: { vehicles, devices, historyDays, members } });
              qc.invalidateQueries({ queryKey: ["admin", "plans"] });
              qc.invalidateQueries({ queryKey: ["plans"] });
            }} />
        )} />
    </>
  );
}
