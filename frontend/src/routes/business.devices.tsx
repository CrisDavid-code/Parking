import { createFileRoute } from "@tanstack/react-router";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useDeviceMutations } from "@/modules/devices/api";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/lib/format";
import type { Device } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/devices")({
  head: () => seo("Dispositivos de flota"),
  component: () => <OrgGate>{(_p, o) => <Page orgId={o.id} />}</OrgGate>,
});

function Page({ orgId }: { orgId: string }) {
  const f = useFormat();
  const m = useDeviceMutations();
  return (
    <>
      <PageHeader
        title="Dispositivos"
        description="Para vincular nuevos dispositivos usa la sección Dispositivos de tu cuenta."
      />
      <PaginatedTable<Device>
        path={`/devices?organizationId=${orgId}`}
        queryKey={["devices", "org", orgId]}
        filters={[
          {
            name: "status",
            label: "Estado",
            options: [
              { value: "pending", label: "Pendiente" },
              { value: "active", label: "Activo" },
              { value: "revoked", label: "Revocado" },
            ],
          },
        ]}
        columns={[
          { header: "Nombre", cell: (d) => <span className="font-medium">{d.name}</span> },
          { header: "Tipo", cell: (d) => d.type },
          { header: "Serie", cell: (d) => <span className="font-mono text-xs">{d.serial}</span> },
          {
            header: "Batería",
            cell: (d) => (d.batteryPercent != null ? `${d.batteryPercent}%` : "—"),
          },
          { header: "Última señal", cell: (d) => f.date(d.lastSeenAt) },
          { header: "Estado", cell: (d) => <StatusBadge value={d.status} /> },
        ]}
        actions={(d) =>
          d.status !== "revoked" ? (
            <ConfirmButton
              title="Revocar dispositivo"
              description={d.name}
              successMessage="Dispositivo revocado"
              trigger={
                <Button size="sm" variant="ghost">
                  Revocar
                </Button>
              }
              onConfirm={() => m.revoke.mutateAsync(d.id)}
            />
          ) : null
        }
      />
    </>
  );
}
