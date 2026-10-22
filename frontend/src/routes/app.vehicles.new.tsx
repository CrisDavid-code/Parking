import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { VehicleForm } from "@/modules/vehicles/vehicle-form";
import { useVehicleMutations } from "@/modules/vehicles/api";
import { ApiError, errorMessage } from "@/lib/api/client";
import { StateView } from "@/components/common/state-view";
import { seo } from "@/lib/seo";
import { useState } from "react";

export const Route = createFileRoute("/app/vehicles/new")({
  head: () => seo("Nuevo vehículo"),
  component: NewVehicle,
});

function NewVehicle() {
  const { create } = useVehicleMutations();
  const navigate = useNavigate();
  const [limit, setLimit] = useState(false);
  return (
    <>
      <PageHeader title="Nuevo vehículo" />
      {limit && <StateView kind="plan-limit" compact className="surface-card mb-4" />}
      <div className="surface-card max-w-2xl p-6">
        <VehicleForm
          submitLabel="Crear vehículo"
          onSubmit={async (v) => {
            try {
              const created = await create.mutateAsync(v);
              toast.success("Vehículo creado");
              navigate({ to: "/app/vehicles/$id", params: { id: created.id } });
            } catch (e) {
              if (e instanceof ApiError && e.status === 402) setLimit(true);
              toast.error(errorMessage(e));
            }
          }}
        />
      </div>
    </>
  );
}
