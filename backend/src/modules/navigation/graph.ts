/**
 * Pure multi-level routing over an indoor navigation graph.
 * Coordinates: x = east, y = north, in meters, per level. Levels connect ONLY through explicit
 * vertical edges (elevator/stairs/ramp) — sharing x/y never implies a connection.
 */
export type NodeType = 'corridor' | 'elevator' | 'stairs' | 'ramp' | 'entrance' | 'exit' | 'parking_spot' | 'landmark';
export type EdgeType = 'walk' | 'elevator' | 'stairs' | 'ramp';

export interface GNode { id: string; levelId: string; levelCode: string; levelOrdinal: number; x: number; y: number; type: NodeType; label: string | null; restricted: boolean }
export interface GEdge { id: string; from: string; to: string; distanceMeters: number; type: EdgeType; accessible: boolean; bidirectional: boolean; status: string }
export interface RouteOptions { accessibleOnly?: boolean; avoidEdgeIds?: Set<string> }
export interface RawRoute { nodeIds: string[]; edgeIds: string[]; distanceMeters: number }

export interface RouteStep { order: number; instruction: string; levelId: string; levelCode: string; nodeId: string; distanceMeters: number; type: 'walk' | 'turn' | 'vertical' | 'arrive' }
export interface RouteResult { totalDistanceMeters: number; steps: RouteStep[]; legs: { levelId: string; levelCode: string; nodeIds: string[] }[]; nodeIds: string[]; edgeIds: string[] }

const VERTICAL: EdgeType[] = ['elevator', 'stairs', 'ramp'];

/** Dijkstra. Skips closed edges, inaccessible edges (if requested), avoided edges and restricted nodes (except endpoints). */
export function shortestPath(nodes: Map<string, GNode>, edges: GEdge[], fromId: string, toId: string, opts: RouteOptions = {}): RawRoute | null {
  if (!nodes.has(fromId) || !nodes.has(toId)) return null;
  const adj = new Map<string, { to: string; edge: GEdge }[]>();
  const push = (a: string, b: string, e: GEdge) => (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, edge: e });
  for (const e of edges) {
    if (e.status !== 'open') continue;
    if (opts.accessibleOnly && !e.accessible) continue;
    if (opts.avoidEdgeIds?.has(e.id)) continue;
    push(e.from, e.to, e);
    if (e.bidirectional) push(e.to, e.from, e);
  }
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, { node: string; edge: string }>();
  const done = new Set<string>();
  // ponytail: linear-scan frontier is O(V²); swap for a binary heap if maps exceed ~10k nodes.
  const frontier = new Set<string>([fromId]);
  while (frontier.size) {
    let cur = '';
    let best = Infinity;
    for (const n of frontier) if (dist.get(n)! < best) { best = dist.get(n)!; cur = n; }
    frontier.delete(cur);
    if (cur === toId) break;
    done.add(cur);
    for (const { to, edge } of adj.get(cur) ?? []) {
      if (done.has(to)) continue;
      const n = nodes.get(to);
      if (!n || (n.restricted && to !== toId)) continue;
      const d = best + edge.distanceMeters;
      if (d < (dist.get(to) ?? Infinity)) {
        dist.set(to, d);
        prev.set(to, { node: cur, edge: edge.id });
        frontier.add(to);
      }
    }
  }
  if (!dist.has(toId)) return null;
  const nodeIds = [toId];
  const edgeIds: string[] = [];
  for (let c = toId; c !== fromId; ) {
    const p = prev.get(c)!;
    edgeIds.unshift(p.edge);
    nodeIds.unshift(p.node);
    c = p.node;
  }
  return { nodeIds, edgeIds, distanceMeters: dist.get(toId)! };
}

const round = (m: number) => Math.max(1, Math.round(m));
const name = (n: GNode) => n.label ?? ({ elevator: 'el ascensor', stairs: 'las escaleras', ramp: 'la rampa', entrance: 'la entrada', exit: 'la salida', parking_spot: 'la plaza', landmark: 'el punto de referencia', corridor: 'el pasillo' } as const)[n.type];
const NOTABLE: NodeType[] = ['elevator', 'stairs', 'ramp', 'entrance', 'exit', 'landmark', 'parking_spot'];
const TURN_DEG = 45;

function turnAt(a: GNode, b: GNode, c: GNode): 'left' | 'right' | null {
  const v1 = [b.x - a.x, b.y - a.y];
  const v2 = [c.x - b.x, c.y - b.y];
  if ((!v1[0] && !v1[1]) || (!v2[0] && !v2[1])) return null;
  const angle = (Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]) * 180) / Math.PI;
  if (Math.abs(angle) < TURN_DEG) return null;
  return angle > 0 ? 'left' : 'right';
}

/** Turns a raw path into human instructions (Spanish) and per-level legs. */
export function describeRoute(nodes: Map<string, GNode>, edges: Map<string, GEdge>, raw: RawRoute, destinationLabel?: string): RouteResult {
  const steps: RouteStep[] = [];
  const add = (s: Omit<RouteStep, 'order'>) => steps.push({ ...s, order: steps.length + 1 });
  let walked = 0;
  for (let i = 0; i < raw.edgeIds.length; i++) {
    const e = edges.get(raw.edgeIds[i])!;
    const a = nodes.get(raw.nodeIds[i])!;
    const b = nodes.get(raw.nodeIds[i + 1])!;
    if (VERTICAL.includes(e.type) && a.levelId !== b.levelId) {
      if (walked) { add({ instruction: `Camina ${round(walked)} m hasta ${name(a)}`, levelId: a.levelId, levelCode: a.levelCode, nodeId: a.id, distanceMeters: round(walked), type: 'walk' }); walked = 0; }
      const dir = b.levelOrdinal < a.levelOrdinal ? 'Baja' : 'Sube';
      const via = e.type === 'elevator' ? `Toma ${name(a)}` : `${dir} por ${name(a)}`;
      add({ instruction: e.type === 'elevator' ? `${via} y ve al nivel ${b.levelCode}` : `${via} hasta el nivel ${b.levelCode}`, levelId: b.levelId, levelCode: b.levelCode, nodeId: b.id, distanceMeters: round(e.distanceMeters), type: 'vertical' });
      continue;
    }
    walked += e.distanceMeters;
    const c = i + 2 < raw.nodeIds.length ? nodes.get(raw.nodeIds[i + 2]) : undefined;
    const nextEdge = i + 1 < raw.edgeIds.length ? edges.get(raw.edgeIds[i + 1]) : undefined;
    const turn = c && c.levelId === b.levelId && nextEdge?.type === 'walk' ? turnAt(a, b, c) : null;
    const isEnd = i === raw.edgeIds.length - 1;
    if (turn || (!isEnd && NOTABLE.includes(b.type) && nextEdge?.type === 'walk' && b.type !== 'parking_spot')) {
      add({ instruction: `Camina ${round(walked)} m hasta ${name(b)}`, levelId: b.levelId, levelCode: b.levelCode, nodeId: b.id, distanceMeters: round(walked), type: 'walk' });
      walked = 0;
      if (turn) add({ instruction: `Gira a la ${turn === 'left' ? 'izquierda' : 'derecha'}`, levelId: b.levelId, levelCode: b.levelCode, nodeId: b.id, distanceMeters: 0, type: 'turn' });
    }
  }
  const end = nodes.get(raw.nodeIds[raw.nodeIds.length - 1])!;
  if (walked) add({ instruction: `Camina ${round(walked)} m hasta ${destinationLabel ?? name(end)}`, levelId: end.levelId, levelCode: end.levelCode, nodeId: end.id, distanceMeters: round(walked), type: 'walk' });
  add({ instruction: `Llegaste a ${destinationLabel ?? name(end)} (nivel ${end.levelCode}). Confirma que el vehículo coincide con la fotografía guardada.`, levelId: end.levelId, levelCode: end.levelCode, nodeId: end.id, distanceMeters: 0, type: 'arrive' });

  const legs: RouteResult['legs'] = [];
  for (const id of raw.nodeIds) {
    const n = nodes.get(id)!;
    const last = legs[legs.length - 1];
    if (last && last.levelId === n.levelId) last.nodeIds.push(id);
    else legs.push({ levelId: n.levelId, levelCode: n.levelCode, nodeIds: [id] });
  }
  return { totalDistanceMeters: Math.round(raw.distanceMeters * 10) / 10, steps, legs, nodeIds: raw.nodeIds, edgeIds: raw.edgeIds };
}

/** Primary route plus, when one exists, an alternative that avoids the primary's vertical connections. */
export function planRoutes(nodes: Map<string, GNode>, edgeList: GEdge[], fromId: string, toId: string, opts: RouteOptions = {}, destinationLabel?: string) {
  const edges = new Map(edgeList.map((e) => [e.id, e]));
  const primary = shortestPath(nodes, edgeList, fromId, toId, opts);
  if (!primary) return null;
  const vertical = primary.edgeIds.filter((id) => VERTICAL.includes(edges.get(id)!.type));
  const altRaw = vertical.length ? shortestPath(nodes, edgeList, fromId, toId, { ...opts, avoidEdgeIds: new Set([...(opts.avoidEdgeIds ?? []), ...vertical]) }) : null;
  return {
    ...describeRoute(nodes, edges, primary, destinationLabel),
    alternatives: altRaw ? [describeRoute(nodes, edges, altRaw, destinationLabel)] : [],
  };
}
