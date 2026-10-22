import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { ParkingForm } from "@/modules/parking/parking-form";
import { useParkingMutations } from "@/modules/parking/api";
import { useVehicles } from "@/modules/vehicles/api";
import { errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/parking/new")({ head: () => seo("Guardar estacionamiento"), component: NewParking });

function NewParking() {
  const vehicles = useVehicles();
  const m = useParkingMutations();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Guardar estacionamiento" description="Usa tu ubicación o registra el lugar manualmente." />
      <QueryView query={vehicles} isEmpty={(d) => d.items.length === 0}
        empty={<StateView kind="empty" title="Necesitas un vehículo" action={<Button asChild><Link to="/app/vehicles/new">Agregar vehículo</Link></Button>} />}>
        {(d) => (
          <ParkingForm vehicles={d.items} onSubmit={async (input, files) => {
            try {
              const s = await m.create.mutateAsync(input);
              if (files.length) await m.upload.mutateAsync({ id: s.id, files }).catch((e) => toast.error(`Fotos: ${errorMessage(e)}`));
              toast.success("Estacionamiento guardado");
              navigate({ to: "/app/parking/$id", params: { id: s.id } });
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }} />
        )}
      </QueryView>
    </>
  );
}
