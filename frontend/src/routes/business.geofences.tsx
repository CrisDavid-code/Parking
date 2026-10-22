import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Plus } from "lucide-react";
import { OrgGate } from "@/modules/fleet/org-gate";
import { useGeofences, useOrgMutation } from "@/modules/fleet/api";
import { MapView } from "@/modules/maps/map-view";
import { PageHeader, Section } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmButton } from "@/components/common/confirm-button";
import { StatusBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/business/geofences")({ head: () => seo("Geocercas"), component: () => <OrgGate>{(p) => <Page orgPath={p} />}</OrgGate> });

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  centerLat: z.number({ invalid_type_error: "Latitud inválida" }).min(-90).max(90),
  centerLng: z.number({ invalid_type_error: "Longitud inválida" }).min(-180).max(180),
  radiusMeters: z.number({ invalid_type_error: "Radio inválido" }).min(20, "Mínimo 20 m").max(100000),
  active: z.boolean().default(true),
});
const fields = [
  { name: "name", label: "Nombre" }, { name: "radiusMeters", label: "Radio (m)", type: "number" as const },
  { name: "centerLat", label: "Latitud", type: "number" as const }, { name: "centerLng", label: "Longitud", type: "number" as const },
  { name: "active", label: "Activa", type: "checkbox" as const },
];

function Page({ orgPath }: { orgPath: string }) {
  const q = useGeofences(orgPath);
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const create = useOrgMutation((d: z.infer<typeof schema>) => api.post(`${orgPath}/geofences`, { ...d, type: "circle" }));
  const update = useOrgMutation(({ id, ...d }: Partial<z.infer<typeof schema>> & { id: string }) => api.patch(`${orgPath}/geofences/${id}`, d));
  const remove = useOrgMutation((id: string) => api.delete(`${orgPath}/geofences/${id}`));
  return (
    <>
      <PageHeader title="Geocercas" description="Haz clic en el mapa para tomar el centro de una nueva geocerca."
        actions={<FormDialog key={pick ? `${pick.lat}${pick.lng}` : "new"} title="Nueva geocerca" schema={schema} fields={fields}
          defaultValues={{ name: "", radiusMeters: 300, centerLat: pick ? Number(pick.lat.toFixed(6)) : undefined, centerLng: pick ? Number(pick.lng.toFixed(6)) : undefined, active: true }}
          trigger={<Button><Plus className="size-4" /> Nueva</Button>} onSubmit={(d) => create.mutateAsync(d)} />} />
      <QueryView query={q}>
        {(d) => (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MapView height={460} onMapClick={(lat, lng) => setPick({ lat, lng })}
                markers={pick ? [{ id: "pick", lat: pick.lat, lng: pick.lng, label: "Centro seleccionado", status: "user" }] : []}
                circles={d.items.map((g) => ({ id: g.id, lat: g.centerLat, lng: g.centerLng, radiusMeters: g.radiusMeters, label: g.name }))} />
              {pick && <p className="mt-2 text-xs text-muted-foreground">Centro: {pick.lat.toFixed(5)}, {pick.lng.toFixed(5)} — pulsa “Nueva” para crearla.</p>}
            </div>
            <Section title={`${d.total} geocercas`}>
              <ul className="divide-y divide-border text-sm">
                {d.items.map((g) => (
                  <li key={g.id} className="space-y-2 py-3">
                    <div className="flex justify-between"><span className="font-medium">{g.name}</span><StatusBadge value={g.active ? "active" : "inactive"} /></div>
                    <p className="text-xs text-muted-foreground">Radio {g.radiusMeters} m</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: g.id, active: !g.active })}>{g.active ? "Desactivar" : "Activar"}</Button>
                      <ConfirmButton title="Eliminar geocerca" description={g.name} successMessage="Geocerca eliminada" trigger={<Button size="sm" variant="ghost">Eliminar</Button>} onConfirm={() => remove.mutateAsync(g.id)} />
                    </div>
                  </li>
                ))}
                {d.items.length === 0 && <li className="py-4 text-muted-foreground">Sin geocercas.</li>}
              </ul>
            </Section>
          </div>
        )}
      </QueryView>
    </>
  );
}
