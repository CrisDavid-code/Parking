import { createFileRoute, Link } from "@tanstack/react-router";
import { Navigation } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { useParkingSessions, describeSpot } from "@/modules/parking/api";
import { useVehicles } from "@/modules/vehicles/api";
import { StartNavigationButton } from "@/modules/indoor-navigation/start-button";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/navigation/")({
  head: () => seo("Navegación"),
  component: NavIndex,
});

function NavIndex() {
  const q = useParkingSessions({ status: "active", pageSize: 50 });
  const vehicles = useVehicles();
  const f = useFormat();
  return (
    <>
      <PageHeader
        title="Navegación hacia tu vehículo"
        description="Elige un estacionamiento activo para iniciar la guía."
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["A · Básica", "Foto, nivel, fila y plaza con instrucciones."],
          ["B · Interior", "Plano por niveles si el edificio tiene mapa."],
          ["C · Sensores/AR", "Requiere la app móvil nativa."],
        ].map(([t, d]) => (
          <div key={t} className="surface-card p-4">
            <p className="font-semibold">{t}</p>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <QueryView
        query={q}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <StateView
            kind="empty"
            title="No hay estacionamientos activos"
            action={
              <Button asChild>
                <Link to="/app/parking/new">Guardar estacionamiento</Link>
              </Button>
            }
          />
        }
      >
        {(d) => (
          <ul className="space-y-3">
            {d.items.map((s) => (
              <li
                key={s.id}
                className="surface-card flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  <Navigation className="size-5 text-primary" aria-hidden />
                  <div>
                    <p className="font-medium">
                      {vehicles.data?.items.find((v) => v.id === s.vehicleId)?.alias ?? "Vehículo"}{" "}
                      · {describeSpot(s)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.address ?? "Sin dirección"} · {f.date(s.startedAt)}
                    </p>
                  </div>
                </div>
                <StartNavigationButton parkingSessionId={s.id} label="Iniciar" />
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </>
  );
}
