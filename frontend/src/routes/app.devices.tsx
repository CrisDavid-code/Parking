import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Battery, Copy, Cpu, Plus, Signal } from "lucide-react";
import { toast } from "sonner";
import { useDevices, useDeviceMutations } from "@/modules/devices/api";
import { useVehicles } from "@/modules/vehicles/api";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { StateView } from "@/components/common/state-view";
import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/devices")({
  head: () => seo("Dispositivos"),
  component: Devices,
});

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  type: z.string().min(1, "Requerido"),
  serial: z.string().min(3, "Serie inválida"),
  vehicleId: z.string().optional(),
});

function Devices() {
  const q = useDevices();
  const vehicles = useVehicles();
  const m = useDeviceMutations();
  const f = useFormat();
  const [token, setToken] = useState<string | null>(null);
  const vName = (id?: string | null) =>
    vehicles.data?.items.find((v) => v.id === id)?.alias ?? "Sin asignar";
  return (
    <>
      <PageHeader
        title="Dispositivos"
        description="Rastreadores vinculados a tus vehículos."
        actions={
          <FormDialog
            title="Vincular dispositivo"
            schema={schema}
            trigger={
              <Button>
                <Plus className="size-4" /> Vincular
              </Button>
            }
            fields={[
              { name: "name", label: "Nombre" },
              {
                name: "type",
                label: "Tipo",
                type: "select",
                options: [
                  { value: "obd", label: "OBD" },
                  { value: "gps", label: "GPS" },
                  { value: "beacon", label: "Beacon" },
                ],
              },
              { name: "serial", label: "Número de serie" },
              {
                name: "vehicleId",
                label: "Vehículo",
                type: "select",
                options: vehicles.data?.items.map((v) => ({ value: v.id, label: v.alias })) ?? [],
              },
            ]}
            onSubmit={async (d) => {
              const created = await m.create.mutateAsync({
                ...d,
                vehicleId: d.vehicleId || undefined,
              });
              setToken(created.deviceToken);
            }}
          />
        }
      />
      {token && (
        <Alert className="mb-4 border-warning">
          <AlertTitle>Token del dispositivo — guárdalo ahora</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Este token se muestra <strong>una sola vez</strong>. No podrás volver a verlo.
            </p>
            <code className="block break-all rounded bg-muted p-2 font-mono text-xs">{token}</code>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(token).then(() => toast.success("Copiado"))
                }
              >
                <Copy className="size-3.5" /> Copiar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setToken(null)}>
                Ya lo guardé
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <QueryView
        query={q}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <StateView
            kind="empty"
            title="Sin dispositivos"
            description="Vincula un rastreador para ver la ubicación en vivo."
          />
        }
      >
        {(d) => (
          <div className="grid gap-3 md:grid-cols-2">
            {d.items.map((dv) => (
              <article key={dv.id} className="surface-card space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <Cpu className="size-5 text-primary" aria-hidden />
                    <div>
                      <p className="font-semibold">{dv.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dv.type} · {dv.serial}
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={dv.status} />
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Vehículo: {vName(dv.vehicleId)}</span>
                  <span>Última señal: {f.date(dv.lastSeenAt)}</span>
                  {dv.batteryPercent != null && (
                    <span className="flex items-center gap-1">
                      <Battery className="size-3.5" /> {dv.batteryPercent}%
                    </span>
                  )}
                  {dv.signal != null && (
                    <span className="flex items-center gap-1">
                      <Signal className="size-3.5" /> {dv.signal}/5
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {dv.status !== "revoked" && (
                    <ConfirmButton
                      title="Revocar dispositivo"
                      description="El dispositivo dejará de enviar ubicaciones."
                      successMessage="Dispositivo revocado"
                      trigger={
                        <Button size="sm" variant="outline">
                          Revocar
                        </Button>
                      }
                      onConfirm={() => m.revoke.mutateAsync(dv.id)}
                    />
                  )}
                  <ConfirmButton
                    title="Eliminar dispositivo"
                    description="Se eliminará el registro."
                    successMessage="Dispositivo eliminado"
                    trigger={
                      <Button size="sm" variant="ghost">
                        Eliminar
                      </Button>
                    }
                    onConfirm={() => m.remove.mutateAsync(dv.id)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryView>
    </>
  );
}
