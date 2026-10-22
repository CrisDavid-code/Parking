import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Plus } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useOrgMutation, useOrgVehicles } from "@/modules/fleet/api";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import type { Assignment, Driver, Paginated } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/assignments")({ head: () => seo("Asignaciones"), component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate> });

const schema = z.object({
  vehicleId: z.string().min(1, "Selecciona vehículo"),
  driverId: z.string().min(1, "Selecciona conductor"),
  startsAt: z.string().min(1, "Requerido"),
  endsAt: z.string().optional(),
});

function Page({ orgPath }: { orgPath: string }) {
  const f = useFormat();
  const vehicles = useOrgVehicles(orgPath);
  const drivers = useQuery({ queryKey: ["org", orgPath, "drivers", "all"], queryFn: () => api.get<Paginated<Driver>>(`${orgPath}/drivers`, { page: 1, pageSize: 200 }) });
  const create = useOrgMutation((d: z.infer<typeof schema>) => api.post(`${orgPath}/assignments`, { ...d, startsAt: new Date(d.startsAt).toISOString(), endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : undefined }));
  const remove = useOrgMutation((id: string) => api.delete(`${orgPath}/assignments/${id}`));
  return (
    <>
      <PageHeader title="Asignaciones" actions={
        <FormDialog title="Nueva asignación" schema={schema} trigger={<Button><Plus className="size-4" /> Asignar</Button>}
          fields={[
            { name: "vehicleId", label: "Vehículo", type: "select", options: vehicles.data?.items.map((v) => ({ value: v.id, label: v.alias })) ?? [] },
            { name: "driverId", label: "Conductor", type: "select", options: drivers.data?.items.map((d) => ({ value: d.id, label: d.fullName })) ?? [] },
            { name: "startsAt", label: "Inicio", type: "datetime-local" },
            { name: "endsAt", label: "Fin (opcional)", type: "datetime-local" },
          ]} onSubmit={(d) => create.mutateAsync(d)} />} />
      <PaginatedTable<Assignment> path={`${orgPath}/assignments`} queryKey={["org", orgPath, "assignments"]}
        filters={[{ name: "status", label: "Estado", options: [{ value: "scheduled", label: "Programada" }, { value: "active", label: "Activa" }, { value: "ended", label: "Finalizada" }] }]}
        columns={[
          { header: "Vehículo", cell: (a) => a.vehicleAlias ?? a.vehicleId },
          { header: "Conductor", cell: (a) => a.driverName ?? a.driverId },
          { header: "Inicio", cell: (a) => f.date(a.startsAt) },
          { header: "Fin", cell: (a) => f.date(a.endsAt) },
          { header: "Estado", cell: (a) => <StatusBadge value={a.status} /> },
        ]}
        actions={(a) => <ConfirmButton title="Eliminar asignación" description="Se eliminará la asignación." successMessage="Asignación eliminada" trigger={<Button size="sm" variant="ghost">Eliminar</Button>} onConfirm={() => remove.mutateAsync(a.id)} />} />
    </>
  );
}
