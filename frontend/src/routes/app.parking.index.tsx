import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParkingSessions, describeSpot } from "@/modules/parking/api";
import { useVehicles } from "@/modules/vehicles/api";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/parking/")({
  head: () => seo("Estacionamientos"),
  component: ParkingList,
});

function ParkingList() {
  const active = useParkingSessions({ status: "active", pageSize: 50 });
  const vehicles = useVehicles();
  const f = useFormat();
  const name = (id: string) => vehicles.data?.items.find((v) => v.id === id)?.alias ?? "Vehículo";
  return (
    <>
      <PageHeader
        title="Estacionamientos activos"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/app/history">Historial</Link>
            </Button>
            <Button asChild>
              <Link to="/app/parking/new">
                <Plus className="size-4" /> Guardar
              </Link>
            </Button>
          </>
        }
      />
      <QueryView
        query={active}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <StateView
            kind="empty"
            title="Sin estacionamientos activos"
            action={
              <Button asChild>
                <Link to="/app/parking/new">Guardar estacionamiento</Link>
              </Button>
            }
          />
        }
      >
        {(d) => (
          <div className="grid gap-3 md:grid-cols-2">
            {d.items.map((s) => (
              <Link
                key={s.id}
                to="/app/parking/$id"
                params={{ id: s.id }}
                className="surface-card lift flex gap-4 p-4"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <MapPin className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {name(s.vehicleId)}{" "}
                    <Badge variant="live" className="ml-1">
                      Activo
                    </Badge>
                  </p>
                  <p className="truncate text-sm">{describeSpot(s)}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.address ?? "Sin dirección"} · {f.date(s.startedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </QueryView>
    </>
  );
}
