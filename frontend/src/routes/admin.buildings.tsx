import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { PaginatedTable } from "@/components/common/paginated-table";
import { FormDialog } from "@/components/common/form-dialog";
import { ConfirmButton } from "@/components/common/confirm-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QueryView } from "@/components/common/query-view";
import { api } from "@/lib/api/client";
import type { Building, Level } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/buildings")({ head: () => seo("Edificios"), component: Buildings });

const schema = z.object({
  name: z.string().min(1, "Requerido"),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional().or(z.nan().transform(() => undefined)),
  longitude: z.number().min(-180).max(180).optional().or(z.nan().transform(() => undefined)),
});
const fields = [{ name: "name", label: "Nombre" }, { name: "address", label: "Dirección" }, { name: "latitude", label: "Latitud", type: "number" as const }, { name: "longitude", label: "Longitud", type: "number" as const }];
const levelSchema = z.object({ code: z.string().min(1, "Requerido").max(6), name: z.string().min(1, "Requerido"), ordinal: z.number({ invalid_type_error: "Número" }).int() });

function Levels({ b }: { b: Building }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["buildings", b.id, "levels"], queryFn: () => api.get<Level[]>(`/buildings/${b.id}/levels`) });
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Niveles</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Niveles · {b.name}</DialogTitle></DialogHeader>
        <QueryView query={q} isEmpty={(d) => d.length === 0} compact>
          {(d) => <ul className="divide-y divide-border text-sm">{[...d].sort((a, c) => c.ordinal - a.ordinal).map((l) => <li key={l.id} className="flex justify-between py-2"><span>{l.code} — {l.name}</span><span className="text-muted-foreground">orden {l.ordinal}</span></li>)}</ul>}
        </QueryView>
        <FormDialog title="Nuevo nivel" schema={levelSchema} fields={[{ name: "code", label: "Código (PB, B1…)" }, { name: "name", label: "Nombre" }, { name: "ordinal", label: "Orden (0 = PB, negativos sótanos)", type: "number" }]}
          trigger={<Button size="sm"><Plus className="size-4" /> Agregar nivel</Button>}
          onSubmit={async (d) => { await api.post(`/buildings/${b.id}/levels`, d); qc.invalidateQueries({ queryKey: ["buildings", b.id, "levels"] }); }} />
      </DialogContent>
    </Dialog>
  );
}

function Buildings() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["buildings"] });
  return (
    <>
      <PageHeader title="Edificios" actions={<FormDialog title="Nuevo edificio" schema={schema} fields={fields} trigger={<Button><Plus className="size-4" /> Nuevo</Button>}
        onSubmit={async (d) => { await api.post("/buildings", d); inv(); }} />} />
      <PaginatedTable<Building> path="/buildings" queryKey={["buildings", "admin"]}
        columns={[
          { header: "Nombre", cell: (b) => <span className="font-medium">{b.name}</span> },
          { header: "Dirección", cell: (b) => b.address ?? "—" },
          { header: "Coordenadas", cell: (b) => (b.latitude != null && b.longitude != null ? <span className="font-mono text-xs">{b.latitude}, {b.longitude}</span> : "—") },
        ]}
        actions={(b) => (
          <div className="flex justify-end gap-1">
            <Levels b={b} />
            <Button asChild size="sm" variant="ghost"><Link to="/admin/indoor-maps" search={{ buildingId: b.id }}>Mapa</Link></Button>
            <FormDialog title="Editar edificio" schema={schema} fields={fields} defaultValues={{ name: b.name, address: b.address ?? "", latitude: b.latitude ?? undefined, longitude: b.longitude ?? undefined }}
              trigger={<Button size="sm" variant="ghost">Editar</Button>} onSubmit={async (d) => { await api.patch(`/buildings/${b.id}`, d); inv(); }} />
            <ConfirmButton title="Eliminar edificio" description={b.name} successMessage="Edificio eliminado" trigger={<Button size="sm" variant="ghost">Eliminar</Button>}
              onConfirm={async () => { await api.delete(`/buildings/${b.id}`); inv(); }} />
          </div>
        )} />
    </>
  );
}
