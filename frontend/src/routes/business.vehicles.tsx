import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useOrgMutation } from "@/modules/fleet/api";
import { vehicleSchema } from "@/modules/vehicles/vehicle-form";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { FormDialog } from "@/components/common/form-dialog";
import { TrackingBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { Vehicle } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/vehicles")({ head: () => seo("Vehículos de la flota"), component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate> });

function Page({ orgPath }: { orgPath: string }) {
  const create = useOrgMutation((d: unknown) => api.post(`${orgPath}/vehicles`, d));
  return (
    <>
      <PageHeader title="Vehículos" actions={
        <FormDialog title="Nuevo vehículo de flota" schema={vehicleSchema} trigger={<Button><Plus className="size-4" /> Agregar</Button>}
          fields={[{ name: "alias", label: "Alias" }, { name: "make", label: "Marca" }, { name: "model", label: "Modelo" }, { name: "year", label: "Año", type: "number" }, { name: "color", label: "Color" }, { name: "plate", label: "Placa" }]}
          onSubmit={(d) => create.mutateAsync(d)} />} />
      <PaginatedTable<Vehicle> path={`${orgPath}/vehicles`} queryKey={["org", orgPath, "vehicles"]}
        filters={[{ name: "trackingStatus", label: "Rastreo", options: [{ value: "live", label: "En vivo" }, { value: "stale", label: "Desactualizado" }, { value: "offline", label: "Desconectado" }, { value: "none", label: "Sin rastreo" }] }]}
        columns={[
          { header: "Alias", cell: (v) => <span className="font-medium">{v.alias}</span> },
          { header: "Vehículo", cell: (v) => `${v.make} ${v.model} ${v.year}` },
          { header: "Placa", cell: (v) => v.plate ?? "—" },
          { header: "Rastreo", cell: (v) => <TrackingBadge value={v.trackingStatus} /> },
        ]} />
    </>
  );
}
