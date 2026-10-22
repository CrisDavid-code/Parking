import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Plus } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useOrgMutation } from "@/modules/fleet/api";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { Driver } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/drivers")({
  head: () => seo("Conductores"),
  component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate>,
});

const schema = z.object({
  fullName: z.string().min(2, "Requerido"),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  licenseNumber: z.string().optional(),
});
const fields = [
  { name: "fullName", label: "Nombre completo" },
  { name: "email", label: "Correo", type: "email" as const },
  { name: "phone", label: "Teléfono" },
  { name: "licenseNumber", label: "Licencia" },
];

function Page({ orgPath }: { orgPath: string }) {
  const create = useOrgMutation((d: z.infer<typeof schema>) => api.post(`${orgPath}/drivers`, d));
  const update = useOrgMutation(({ id, ...d }: z.infer<typeof schema> & { id: string }) =>
    api.patch(`${orgPath}/drivers/${id}`, d),
  );
  const remove = useOrgMutation((id: string) => api.delete(`${orgPath}/drivers/${id}`));
  return (
    <>
      <PageHeader
        title="Conductores"
        actions={
          <FormDialog
            title="Nuevo conductor"
            schema={schema}
            fields={fields}
            trigger={
              <Button>
                <Plus className="size-4" /> Agregar
              </Button>
            }
            onSubmit={(d) => create.mutateAsync(d)}
          />
        }
      />
      <PaginatedTable<Driver>
        path={`${orgPath}/drivers`}
        queryKey={["org", orgPath, "drivers"]}
        filters={[
          {
            name: "status",
            label: "Estado",
            options: [
              { value: "active", label: "Activo" },
              { value: "inactive", label: "Inactivo" },
            ],
          },
        ]}
        columns={[
          { header: "Nombre", cell: (d) => <span className="font-medium">{d.fullName}</span> },
          { header: "Correo", cell: (d) => d.email ?? "—" },
          { header: "Teléfono", cell: (d) => d.phone ?? "—" },
          { header: "Licencia", cell: (d) => d.licenseNumber ?? "—" },
          { header: "Estado", cell: (d) => <StatusBadge value={d.status} /> },
        ]}
        actions={(d) => (
          <div className="flex justify-end gap-1">
            <FormDialog
              title="Editar conductor"
              schema={schema}
              fields={fields}
              defaultValues={{
                fullName: d.fullName,
                email: d.email ?? "",
                phone: d.phone ?? "",
                licenseNumber: d.licenseNumber ?? "",
              }}
              trigger={
                <Button size="sm" variant="ghost">
                  Editar
                </Button>
              }
              onSubmit={(v) => update.mutateAsync({ id: d.id, ...v })}
            />
            <ConfirmButton
              title="Eliminar conductor"
              description={d.fullName}
              successMessage="Conductor eliminado"
              trigger={
                <Button size="sm" variant="ghost">
                  Eliminar
                </Button>
              }
              onConfirm={() => remove.mutateAsync(d.id)}
            />
          </div>
        )}
      />
    </>
  );
}
