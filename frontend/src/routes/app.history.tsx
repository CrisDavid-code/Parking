import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { StatusBadge } from "@/components/common/badges";
import { describeSpot } from "@/modules/parking/api";
import { useVehicles } from "@/modules/vehicles/api";
import { useFormat } from "@/lib/format";
import type { ParkingSession } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/history")({ head: () => seo("Historial"), component: History });

function History() {
  const f = useFormat();
  const vehicles = useVehicles();
  const opts = vehicles.data?.items.map((v) => ({ value: v.id, label: v.alias })) ?? [];
  return (
    <>
      <PageHeader title="Historial de estacionamientos" />
      <PaginatedTable<ParkingSession> path="/parking-sessions" queryKey={["parking", "history"]} searchable={false}
        filters={[
          { name: "vehicleId", label: "Vehículo", options: opts },
          { name: "status", label: "Estado", options: [{ value: "active", label: "Activo" }, { value: "ended", label: "Finalizado" }] },
        ]}
        columns={[
          { header: "Inicio", cell: (s) => f.date(s.startedAt) },
          { header: "Vehículo", cell: (s) => opts.find((o) => o.value === s.vehicleId)?.label ?? "—" },
          { header: "Lugar", cell: (s) => <Link to="/app/parking/$id" params={{ id: s.id }} className="text-primary hover:underline">{describeSpot(s)}</Link> },
          { header: "Dirección", cell: (s) => s.address ?? "—" },
          { header: "Fin", cell: (s) => f.date(s.endedAt) },
          { header: "Estado", cell: (s) => <StatusBadge value={s.status} /> },
        ]} />
    </>
  );
}
