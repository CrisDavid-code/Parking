import type { IndoorEdge, IndoorNode, Level } from "@/types/api";

const nodeFill: Record<string, string> = {
  elevator: "var(--brand-blue)", stairs: "var(--chart-4)", ramp: "var(--chart-3)", entrance: "var(--brand-teal)",
  exit: "var(--brand-teal)", parking_spot: "var(--destructive)", landmark: "var(--warning)", corridor: "var(--muted-foreground)",
};

/** Plano 2D de un nivel (coordenadas x/y en 0–100). */
export function FloorPlan({ level, nodes, edges, routeNodeIds = [], originId, targetId, onNodeClick }: {
  level: Level; nodes: IndoorNode[]; edges: IndoorEdge[]; routeNodeIds?: string[] | undefined; originId?: string | undefined; targetId?: string | undefined;
  onNodeClick?: ((n: IndoorNode) => void) | undefined;
}) {
  const ln = nodes.filter((n) => n.levelId === level.id);
  const byId = new Map(ln.map((n) => [n.id, n]));
  const le = edges.filter((e) => byId.has(e.fromNodeId) && byId.has(e.toNodeId));
  const routeSet = new Set(routeNodeIds);
  const routePts = routeNodeIds.map((id) => byId.get(id)).filter((n): n is IndoorNode => !!n);
  return (
    <svg viewBox="0 0 100 100" className="aspect-[4/3] w-full rounded-xl border border-border bg-muted/50" role="img" aria-label={`Plano de ${level.name}`}>
      <rect x="2" y="2" width="96" height="96" rx="3" fill="var(--card)" stroke="var(--border)" strokeWidth="0.6" />
      {le.map((e) => {
        const a = byId.get(e.fromNodeId)!, b = byId.get(e.toNodeId)!;
        return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.status === "closed" ? "var(--destructive)" : "var(--border)"} strokeWidth="1.4" strokeDasharray={e.status === "closed" ? "2 1.5" : undefined} />;
      })}
      {routePts.length > 1 && (
        <polyline points={routePts.map((n) => `${n.x},${n.y}`).join(" ")} fill="none" stroke="var(--brand-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <animate attributeName="stroke-dasharray" values="0 300;300 0" dur="1.6s" fill="freeze" />
        </polyline>
      )}
      {ln.map((n) => (
        <g key={n.id} onClick={() => onNodeClick?.(n)} className={onNodeClick ? "cursor-pointer" : undefined}>
          <circle cx={n.x} cy={n.y} r={n.id === targetId || n.id === originId ? 3.4 : 2.4} fill={nodeFill[n.type]}
            stroke={routeSet.has(n.id) ? "var(--brand-blue)" : "var(--card)"} strokeWidth="0.8" />
          <text x={n.x} y={n.y - 4} fontSize="3.2" textAnchor="middle" fill="var(--foreground)">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

/** Pisos apilados con CSS 3D. */
export function IsometricView({ levels, currentLevelId, targetLevelId, routeLevelIds = [], illustrative }: {
  levels: { id: string; code: string; name: string; ordinal: number }[]; currentLevelId?: string | null | undefined; targetLevelId?: string | null | undefined;
  routeLevelIds?: string[] | undefined; illustrative?: boolean | undefined;
}) {
  const sorted = [...levels].sort((a, b) => b.ordinal - a.ordinal);
  const gap = 34;
  const top = sorted[0]?.ordinal ?? 0;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-night p-4 text-night-foreground">
      {illustrative && <span className="absolute left-3 top-3 z-10 rounded-md bg-warning px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">Visualización ilustrativa</span>}
      <div className="iso-stage flex justify-center" style={{ height: Math.max(240, sorted.length * gap + 140) }}>
        <div className="iso-stack relative mt-10 h-40 w-40" aria-hidden>
          {sorted.map((l) => {
            const z = (l.ordinal - top) * gap;
            const isCur = l.id === currentLevelId, isTgt = l.id === targetLevelId, inRoute = routeLevelIds.includes(l.id);
            return (
              <div key={l.id} className="absolute inset-0 rounded-md border transition-all duration-500"
                style={{
                  transform: `translateZ(${z}px)`,
                  background: isTgt ? "oklch(0.577 0.22 27 / 0.45)" : isCur ? "oklch(0.704 0.14 182.5 / 0.5)" : inRoute ? "oklch(0.546 0.215 262.9 / 0.35)" : "oklch(1 0 0 / 0.07)",
                  borderColor: isCur || isTgt ? "var(--night-foreground)" : "oklch(1 0 0 / 0.25)",
                }}>
                <span className="absolute -left-1 top-1 text-[10px] font-bold">{l.code}</span>
              </div>
            );
          })}
          <div className="absolute left-3 top-1/2 w-1 rounded bg-primary" style={{ height: 4, transform: `translateZ(${(sorted.at(-1)!.ordinal - top) * gap}px)` }} />
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs">
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-teal" /> Tu nivel</li>
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-destructive" /> Vehículo</li>
        <li className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-primary" /> Ruta</li>
      </ul>
    </div>
  );
}
