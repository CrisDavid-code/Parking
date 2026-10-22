import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { useVehicles, useVehicleMutations } from "@/modules/vehicles/api";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { TrackingBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/vehicles/")({
  head: () => seo("Vehículos"),
  component: Vehicles,
});

function Vehicles() {
  const q = useVehicles();
  const { setPrimary } = useVehicleMutations();
  return (
    <>
      <PageHeader
        title="Vehículos"
        actions={
          <Button asChild>
            <Link to="/app/vehicles/new">
              <Plus className="size-4" /> Nuevo vehículo
            </Link>
          </Button>
        }
      />
      <QueryView
        query={q}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <StateView
            kind="empty"
            title="Sin vehículos"
            action={
              <Button asChild>
                <Link to="/app/vehicles/new">Agregar vehículo</Link>
              </Button>
            }
          />
        }
      >
        {(d) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.items.map((v) => (
              <article key={v.id} className="surface-card lift overflow-hidden">
                <div className="flex h-32 items-center justify-center bg-muted">
                  {v.photoUrl ? (
                    <img
                      src={v.photoUrl}
                      alt={v.alias}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Car className="size-10 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-semibold">{v.alias}</h2>
                    <TrackingBadge value={v.trackingStatus} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {v.make} {v.model} · {v.year} · {v.color}
                    {v.plate && ` · ${v.plate}`}
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/app/vehicles/$id" params={{ id: v.id }}>
                        Ver detalle
                      </Link>
                    </Button>
                    {v.isPrimary ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-teal">
                        <Star className="size-3.5 fill-current" /> Principal
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={setPrimary.isPending}
                        onClick={() =>
                          setPrimary
                            .mutateAsync(v.id)
                            .then(() => toast.success("Vehículo principal actualizado"))
                            .catch((e) => toast.error(errorMessage(e)))
                        }
                      >
                        Hacer principal
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryView>
    </>
  );
}
