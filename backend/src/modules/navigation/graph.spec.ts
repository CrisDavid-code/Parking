import { GEdge, GNode, planRoutes, shortestPath } from './graph';

/**
 * Test building (mirrors the product example): user on level 3, car on B2 row C spot 148.
 *   L3: corridor A(0,0) -> elevator E1@L3 (20,0); stairs S@L3 (0,30)
 *   B2: E1@B2 (20,0) -> C row (20,40) -> spot 148 (25,40); S@B2 (0,30) -> C row
 *   L3 and B2 share x/y but are only connected through E1 and S.
 */
function building() {
  const n = (id: string, level: 'L3' | 'B2', x: number, y: number, type: GNode['type'], label: string | null = null, restricted = false): GNode =>
    ({ id, levelId: level, levelCode: level, levelOrdinal: level === 'L3' ? 3 : -2, x, y, type, label, restricted });
  const nodes = new Map<string, GNode>([
    ['A', n('A', 'L3', 0, 0, 'corridor', 'Pasillo central')],
    ['E1_3', n('E1_3', 'L3', 20, 0, 'elevator', 'Ascensor norte')],
    ['S_3', n('S_3', 'L3', 0, 30, 'stairs', 'Escalera este')],
    ['E1_B2', n('E1_B2', 'B2', 20, 0, 'elevator', 'Ascensor norte')],
    ['S_B2', n('S_B2', 'B2', 0, 30, 'stairs', 'Escalera este')],
    ['ROWC', n('ROWC', 'B2', 20, 40, 'corridor', 'Fila C')],
    ['P148', n('P148', 'B2', 25, 40, 'parking_spot', 'Plaza 148')],
    ['X', n('X', 'B2', 0, 0, 'corridor', 'Bodega', true)],
  ]);
  const e = (id: string, from: string, to: string, d: number, type: GEdge['type'] = 'walk', accessible = true): GEdge =>
    ({ id, from, to, distanceMeters: d, type, accessible, bidirectional: true, status: 'open' });
  const edges: GEdge[] = [
    e('a-e1', 'A', 'E1_3', 20),
    e('a-s', 'A', 'S_3', 30),
    e('e1', 'E1_3', 'E1_B2', 15, 'elevator'),
    e('s', 'S_3', 'S_B2', 25, 'stairs', false),
    e('e1b-c', 'E1_B2', 'ROWC', 40),
    e('sb-c', 'S_B2', 'ROWC', 22.4),
    e('c-148', 'ROWC', 'P148', 5),
    // shortcut through a restricted storage room — must never be used
    e('e1b-x', 'E1_B2', 'X', 20),
    e('x-148', 'X', 'P148', 1),
  ];
  return { nodes, edges };
}

describe('indoor routing graph', () => {
  it('routes across levels through the elevator and produces step-by-step instructions', () => {
    const { nodes, edges } = building();
    const r = planRoutes(nodes, edges, 'A', 'P148', {}, 'la plaza 148')!;
    expect(r.nodeIds).toEqual(['A', 'E1_3', 'E1_B2', 'ROWC', 'P148']);
    expect(r.totalDistanceMeters).toBe(80);
    expect(r.legs.map((l) => l.levelCode)).toEqual(['L3', 'B2']);
    const text = r.steps.map((s) => s.instruction);
    expect(text[0]).toBe('Camina 20 m hasta Ascensor norte');
    expect(text[1]).toBe('Toma Ascensor norte y ve al nivel B2');
    expect(text.at(-1)).toContain('Llegaste a la plaza 148 (nivel B2)');
    // y-down: heading down the screen from the elevator to row C, then +x is a left turn
    expect(text).toContain('Gira a la izquierda');
    expect(r.alternatives).toHaveLength(1);
    expect(r.alternatives[0].nodeIds).toContain('S_3');
  });

  it('never routes through restricted zones', () => {
    const { nodes, edges } = building();
    const r = shortestPath(nodes, edges, 'A', 'P148')!;
    expect(r.nodeIds).not.toContain('X');
  });

  it('falls back to stairs when the elevator is out of service', () => {
    const { nodes, edges } = building();
    const closed = edges.map((e) => (e.id === 'e1' ? { ...e, status: 'closed' } : e));
    const r = planRoutes(nodes, closed, 'A', 'P148')!;
    expect(r.nodeIds).toEqual(['A', 'S_3', 'S_B2', 'ROWC', 'P148']);
    expect(r.steps.some((s) => s.instruction.startsWith('Baja por Escalera este hasta el nivel B2'))).toBe(true);
  });

  it('returns no route when the only remaining connection is inaccessible and accessibleOnly is set', () => {
    const { nodes, edges } = building();
    const closed = edges.map((e) => (e.id === 'e1' ? { ...e, status: 'closed' } : e));
    expect(shortestPath(nodes, closed, 'A', 'P148', { accessibleOnly: true })).toBeNull();
  });

  it('does not connect levels that merely share coordinates', () => {
    const { nodes, edges } = building();
    const noVertical = edges.filter((e) => e.type === 'walk');
    expect(shortestPath(nodes, noVertical, 'A', 'P148')).toBeNull();
  });

  it('respects one-way edges', () => {
    const { nodes, edges } = building();
    const oneWay = edges.map((e) => (e.id === 'e1' || e.id === 's' ? { ...e, bidirectional: false } : e));
    expect(shortestPath(nodes, oneWay, 'P148', 'A')).toBeNull();
    expect(shortestPath(nodes, oneWay, 'A', 'P148')).not.toBeNull();
  });

  it('returns null for unknown nodes', () => {
    const { nodes, edges } = building();
    expect(shortestPath(nodes, edges, 'A', 'nope')).toBeNull();
  });
});
