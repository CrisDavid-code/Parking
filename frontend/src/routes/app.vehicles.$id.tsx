import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { useVehicle, useVehicleMembers, useVehicleMutations } from "@/modules/vehicles/api";
import { VehicleForm } from "@/modules/vehicles/vehicle-form";
import { useDevices } from "@/modules/devices/api";
import { useParkingSessions, describeSpot } from "@/modules/parking/api";
import { PageHeader } from "@/components/common/page-header";
import { QueryView } from "@/components/common/query-view";
import { ConfirmButton } from "@/components/common/confirm-button";
import { FormDialog } from "@/components/common/form-dialog";
import { TrackingBadge, StatusBadge } from "@/components/common/badges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { useFormat } from "@/lib/format";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/app/vehicles/$id")({ head: () => seo("Detalle de vehículo"), component: VehicleDetail });

function VehicleDetail() {
  const { id } = Route.useParams();
  const q = useVehicle(id);
  const m = useVehicleMutations();
  const navigate = useNavigate();
  return (
    <QueryView query={q}>
      {(v) => (
        <>
          <PageHeader title={v.alias} description={`${v.make} ${v.model} · ${v.year}`}
            actions={<>
              <TrackingBadge value={v.trackingStatus} />
              {!v.isPrimary && <Button variant="outline" size="sm" onClick={() => m.setPrimary.mutateAsync(v.id).then(() => toast.success("Ahora es principal")).catch((e) => toast.error(errorMessage(e)))}>Hacer principal</Button>}
              <ConfirmButton title="Eliminar vehículo" description="Se eliminará el vehículo y su historial asociado."
                trigger={<Button variant="destructive" size="sm"><Trash2 className="size-4" /> Eliminar</Button>} successMessage="Vehículo eliminado"
                onConfirm={async () => { await m.remove.mutateAsync(v.id); navigate({ to: "/app/vehicles" }); }} />
            </>} />
          <Tabs defaultValue="info">
            <TabsList className="flex-wrap">
              <TabsTrigger value="info">Datos</TabsTrigger>
              <TabsTrigger value="members">Miembros</TabsTrigger>
              <TabsTrigger value="devices">Dispositivos</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="surface-card mt-4 max-w-2xl p-6">
              <VehicleForm defaultValues={{ ...v, plate: v.plate ?? "", photoUrl: v.photoUrl ?? "" }}
                onSubmit={async (d) => { try { await m.update.mutateAsync({ id: v.id, ...d }); toast.success("Cambios guardados"); } catch (e) { toast.error(errorMessage(e)); } }} />
              <Button asChild variant="link" className="mt-2 px-0"><Link to="/app/tracking" search={{ vehicleId: v.id }}>Ver rastreo de este vehículo</Link></Button>
            </TabsContent>
            <TabsContent value="members" className="mt-4"><Members id={v.id} /></TabsContent>
            <TabsContent value="devices" className="mt-4"><VehicleDevices id={v.id} /></TabsContent>
            <TabsContent value="history" className="mt-4"><VehicleHistory id={v.id} /></TabsContent>
          </Tabs>
        </>
      )}
    </QueryView>
  );
}

function Members({ id }: { id: string }) {
  const q = useVehicleMembers(id);
  const m = useVehicleMutations();
  return (
    <div className="surface-card p-4">
      <div className="mb-3 flex justify-end">
        <FormDialog title="Agregar miembro" schema={z.object({ email: z.string().email("Correo inválido") })} fields={[{ name: "email", label: "Correo", type: "email" }]}
          trigger={<Button size="sm"><UserPlus className="size-4" /> Agregar</Button>} onSubmit={(d) => m.addMember.mutateAsync({ id, email: d.email })} />
      </div>
      <QueryView query={q} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <ul className="divide-y divide-border">
            {d.items.map((mem) => (
              <li key={mem.id} className="flex items-center justify-between py-2 text-sm">
                <span>{mem.fullName ?? mem.email} <span className="text-muted-foreground">· {mem.role}</span></span>
                {mem.role !== "owner" && (
                  <ConfirmButton title="Quitar miembro" description={`${mem.email} perderá el acceso.`} successMessage="Miembro eliminado"
                    trigger={<Button variant="ghost" size="sm">Quitar</Button>} onConfirm={() => m.removeMember.mutateAsync({ id, memberId: mem.id })} />
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
    </div>
  );
}

function VehicleDevices({ id }: { id: string }) {
  const q = useDevices(id);
  return (
    <div className="surface-card p-4">
      <QueryView query={q} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <ul className="divide-y divide-border text-sm">
            {d.items.map((dv) => <li key={dv.id} className="flex justify-between py-2"><span>{dv.name} · {dv.serial}</span><StatusBadge value={dv.status} /></li>)}
          </ul>
        )}
      </QueryView>
      <Button asChild variant="link" className="px-0"><Link to="/app/devices">Gestionar dispositivos</Link></Button>
    </div>
  );
}

function VehicleHistory({ id }: { id: string }) {
  const q = useParkingSessions({ vehicleId: id, pageSize: 20 });
  const f = useFormat();
  return (
    <div className="surface-card p-4">
      <QueryView query={q} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <ul className="divide-y divide-border text-sm">
            {d.items.map((s) => (
              <li key={s.id}><Link to="/app/parking/$id" params={{ id: s.id }} className="flex justify-between py-2 hover:text-primary">
                <span>{describeSpot(s)}</span><span className="text-muted-foreground">{f.date(s.startedAt)}</span></Link></li>
            ))}
          </ul>
        )}
      </QueryView>
    </div>
  );
}
