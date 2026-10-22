import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBuildings } from "@/modules/parking/api";
import { FloorPlan } from "@/modules/indoor-navigation/floor-plan";
import { PageHeader, Section } from "@/components/common/page-header";
import { StateView, ErrorState, InlineSpinner } from "@/components/common/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import type { IndoorEdge, IndoorMap, IndoorNode, Level, NodeType } from "@/types/api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/admin/indoor-maps")({
  validateSearch: (s: Record<string, unknown>): { buildingId?: string } => (typeof s["buildingId"] === "string" ? { buildingId: s["buildingId"] } : {}),
  head: () => seo("Editor de mapas interiores"),
  component: IndoorEditor,
});

const nodeTypes: NodeType[] = ["corridor", "elevator", "stairs", "ramp", "entrance", "exit", "parking_spot", "landmark"];
const uid = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;

function IndoorEditor() {
  const { buildingId } = Route.useSearch();
  const navigate = useNavigate();
  const buildings = useBuildings();
  return (
    <>
      <PageHeader title="Mapas interiores" description="Editor simple de nodos y aristas por nivel." />
      <div className="mb-4 max-w-sm space-y-1.5">
        <Label htmlFor="b">Edificio</Label>
        <select id="b" className="native-select" value={buildingId ?? ""} onChange={(e) => navigate({ to: "/admin/indoor-maps", search: e.target.value ? { buildingId: e.target.value } : {} })}>
          <option value="">Selecciona…</option>
          {buildings.data?.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {buildingId ? <Editor key={buildingId} buildingId={buildingId} /> : <StateView kind="empty" title="Selecciona un edificio" className="surface-card" />}
    </>
  );
}

function Editor({ buildingId }: { buildingId: string }) {
  const qc = useQueryClient();
  const map = useQuery({
    queryKey: ["indoor-map", buildingId],
    queryFn: async () => {
      try {
        return await api.get<IndoorMap>(`/indoor-maps/${buildingId}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          const levels = await api.get<Level[]>(`/buildings/${buildingId}/levels`);
          return { building: { id: buildingId, name: "" }, levels, nodes: [], edges: [], version: 0 } satisfies IndoorMap;
        }
        throw e;
      }
    },
  });
  const [nodes, setNodes] = useState<IndoorNode[]>([]);
  const [edges, setEdges] = useState<IndoorEdge[]>([]);
  const [levelId, setLevelId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (map.data) {
      setNodes(map.data.nodes);
      setEdges(map.data.edges);
      setLevelId((l) => l || map.data.levels[0]?.id || "");
    }
  }, [map.data]);

  if (map.isPending) return <StateView kind="loading" />;
  if (map.isError) return <ErrorState error={map.error} onRetry={() => map.refetch()} />;
  const levels = [...map.data.levels].sort((a, b) => b.ordinal - a.ordinal);
  if (levels.length === 0) return <StateView kind="empty" title="El edificio no tiene niveles" description="Crea niveles desde Edificios." className="surface-card" />;
  const level = (levels.find((l) => l.id === levelId) ?? levels[0])!;
  const ln = nodes.filter((n) => n.levelId === level.id);
  const setNode = (id: string, patch: Partial<IndoorNode>) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const setEdge = (id: string, patch: Partial<IndoorEdge>) => setEdges((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const levelEdges = edges.filter((e) => ln.some((n) => n.id === e.fromNodeId || n.id === e.toNodeId));
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/indoor-maps/${buildingId}`, { nodes, edges, version: map.data.version });
      toast.success("Mapa guardado");
      qc.invalidateQueries({ queryKey: ["indoor-map", buildingId] });
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">{levels.map((l) => <Button key={l.id} size="sm" variant={l.id === level.id ? "default" : "outline"} onClick={() => setLevelId(l.id)}>{l.code}</Button>)}</div>
        <Button onClick={save} disabled={saving}>{saving ? <InlineSpinner /> : <Save className="size-4" />} Guardar versión {map.data.version + 1}</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Vista previa · ${level.name}`}><FloorPlan level={level} nodes={nodes} edges={edges} /></Section>
        <Section title="Nodos" actions={<Button size="sm" variant="outline" onClick={() => setNodes((n) => [...n, { id: uid(), levelId: level.id, x: 50, y: 50, type: "corridor", label: "Nuevo nodo" }])}><Plus className="size-4" /> Nodo</Button>}>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Etiqueta</TableHead><TableHead>Tipo</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {ln.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell><Input aria-label="Etiqueta" value={n.label} onChange={(e) => setNode(n.id, { label: e.target.value })} className="h-8" /></TableCell>
                    <TableCell><select aria-label="Tipo" className="native-select h-8" value={n.type} onChange={(e) => setNode(n.id, { type: e.target.value as NodeType })}>{nodeTypes.map((t) => <option key={t}>{t}</option>)}</select></TableCell>
                    <TableCell><Input aria-label="X" type="number" min={0} max={100} value={n.x} onChange={(e) => setNode(n.id, { x: Number(e.target.value) })} className="h-8 w-16" /></TableCell>
                    <TableCell><Input aria-label="Y" type="number" min={0} max={100} value={n.y} onChange={(e) => setNode(n.id, { y: Number(e.target.value) })} className="h-8 w-16" /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" aria-label="Eliminar nodo" onClick={() => { setNodes((ns) => ns.filter((x) => x.id !== n.id)); setEdges((es) => es.filter((e) => e.fromNodeId !== n.id && e.toNodeId !== n.id)); }}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      </div>
      <Section title="Aristas (conexiones)" actions={<Button size="sm" variant="outline" disabled={ln.length < 1 || nodes.length < 2}
        onClick={() => setEdges((e) => [...e, { id: uid(), fromNodeId: ln[0]!.id, toNodeId: nodes.find((n) => n.id !== ln[0]!.id)!.id, distanceMeters: 10, type: "walk", accessible: true, status: "open" }])}><Plus className="size-4" /> Arista</Button>}>
        {levelEdges.length === 0 ? <StateView kind="empty" compact description="Sin conexiones en este nivel." /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Desde</TableHead><TableHead>Hasta</TableHead><TableHead>Distancia (m)</TableHead><TableHead>Tipo</TableHead><TableHead>Accesible</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {levelEdges.map((e) => (
                  <TableRow key={e.id}>
                    {(["fromNodeId", "toNodeId"] as const).map((k) => (
                      <TableCell key={k}><select aria-label={k} className="native-select h-8" value={e[k]} onChange={(ev) => setEdge(e.id, { [k]: ev.target.value })}>
                        {nodes.map((n) => <option key={n.id} value={n.id}>{levels.find((l) => l.id === n.levelId)?.code} · {label(n.id)}</option>)}</select></TableCell>
                    ))}
                    <TableCell><Input aria-label="Distancia" type="number" min={0} value={e.distanceMeters} onChange={(ev) => setEdge(e.id, { distanceMeters: Number(ev.target.value) })} className="h-8 w-20" /></TableCell>
                    <TableCell><select aria-label="Tipo" className="native-select h-8" value={e.type} onChange={(ev) => setEdge(e.id, { type: ev.target.value })}>{["walk", "elevator", "stairs", "ramp"].map((t) => <option key={t}>{t}</option>)}</select></TableCell>
                    <TableCell><input aria-label="Accesible" type="checkbox" checked={e.accessible} onChange={(ev) => setEdge(e.id, { accessible: ev.target.checked })} /></TableCell>
                    <TableCell><select aria-label="Estado" className="native-select h-8" value={e.status} onChange={(ev) => setEdge(e.id, { status: ev.target.value as IndoorEdge["status"] })}><option value="open">open</option><option value="closed">closed</option></select></TableCell>
                    <TableCell><Button size="icon" variant="ghost" aria-label="Eliminar arista" onClick={() => setEdges((es) => es.filter((x) => x.id !== e.id))}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
