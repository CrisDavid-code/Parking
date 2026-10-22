import { INestApplication } from '@nestjs/common';
import { api, createApp, prisma, register, resetDb, TestUser } from './helpers';

/**
 * Test map (product example): user on L3 food court, car on B2 row C spot 148.
 * Levels connect only via elevator E1 and stairs S1 (stairs not accessible).
 */
const MAP = {
  nodes: [
    { key: 'FOOD', levelCode: 'L3', x: 0, y: 0, type: 'landmark', label: 'Plaza de comidas' },
    { key: 'E1_3', levelCode: 'L3', x: 20, y: 0, type: 'elevator', label: 'Ascensor norte' },
    { key: 'S1_3', levelCode: 'L3', x: 0, y: 30, type: 'stairs', label: 'Escalera este' },
    { key: 'E1_B2', levelCode: 'B2', x: 20, y: 0, type: 'elevator', label: 'Ascensor norte' },
    { key: 'S1_B2', levelCode: 'B2', x: 0, y: 30, type: 'stairs', label: 'Escalera este' },
    { key: 'ROWC', levelCode: 'B2', x: 20, y: 40, type: 'corridor', label: 'Fila C' },
    { key: 'P148', levelCode: 'B2', x: 25, y: 40, type: 'parking_spot', label: 'Plaza 148' },
  ],
  edges: [
    { from: 'FOOD', to: 'E1_3' },
    { from: 'FOOD', to: 'S1_3' },
    { from: 'E1_3', to: 'E1_B2', type: 'elevator', distanceMeters: 15 },
    { from: 'S1_3', to: 'S1_B2', type: 'stairs', distanceMeters: 25 },
    { from: 'E1_B2', to: 'ROWC' },
    { from: 'S1_B2', to: 'ROWC' },
    { from: 'ROWC', to: 'P148' },
  ],
  places: [{ levelCode: 'B2', code: '148', row: 'C', nodeKey: 'P148' }],
  landmarks: [{ levelCode: 'L3', name: 'Plaza de comidas', nodeKey: 'FOOD' }],
};

describe('Indoor maps & navigation (e2e)', () => {
  let app: INestApplication;
  let admin: TestUser;
  let user: TestUser;
  let buildingId: string;
  let levels: Record<string, string>;
  let node: Record<string, string>;
  let vehicleId: string;
  let parkingId: string;
  let sessionId: string;

  beforeAll(async () => {
    await resetDb();
    app = await createApp();
    admin = await register(app);
    user = await register(app);
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'PLATFORM_ADMIN' } });
    buildingId = (await api(app, admin).post('/buildings').send({ name: 'Centro Comercial de Prueba', latitude: 14.6, longitude: -90.51 }).expect(201)).body.id;
    for (const [code, ordinal] of [['L3', 3], ['B2', -2]] as const) await api(app, admin).post(`/buildings/${buildingId}/levels`).send({ code, name: code, ordinal }).expect(201);
    levels = Object.fromEntries((await api(app, user).get(`/buildings/${buildingId}/levels`).expect(200)).body.map((l: { code: string; id: string }) => [l.code, l.id]));
    vehicleId = (await api(app, user).post('/vehicles').send({ alias: 'Mi auto', make: 'Toyota', model: 'Yaris' }).expect(201)).body.id;
  });
  afterAll(() => app.close());

  it('rejects maps whose levels are joined without an explicit vertical connector', async () => {
    const bad = { ...MAP, places: [], landmarks: [], edges: [{ from: 'FOOD', to: 'ROWC' }] };
    const res = await api(app, admin).post(`/indoor-maps/${buildingId}/versions`).send(bad).expect(400);
    expect(res.body.message).toContain('crosses levels but is a walk edge');
    await api(app, user).post(`/indoor-maps/${buildingId}/versions`).send(MAP).expect(403);
  });

  it('returns 404 when the building has no published map', async () => {
    await api(app, user).get(`/indoor-maps/${buildingId}`).expect(404);
  });

  it('versions and publishes a valid map', async () => {
    const v = await api(app, admin).post(`/indoor-maps/${buildingId}/versions`).send(MAP).expect(201);
    await api(app, admin).post(`/indoor-maps/${buildingId}/versions/${v.body.version}/publish`).expect(201);
    const map = await api(app, user).get(`/indoor-maps/${buildingId}`).expect(200);
    expect(map.body.levels.map((l: { code: string }) => l.code)).toEqual(['L3', 'B2']);
    node = Object.fromEntries(map.body.nodes.map((n: { key: string; id: string }) => [n.key, n.id]));
  });

  it('suggests the building near a GPS fix (PostGIS)', async () => {
    const res = await api(app, user).get('/locations/nearby-buildings?lat=14.6005&lng=-90.51').expect(200);
    expect(res.body[0]).toMatchObject({ id: buildingId, hasIndoorMap: true });
    expect(res.body[0].distanceMeters).toBeGreaterThan(40);
    expect((await api(app, user).get('/locations/nearby-buildings?lat=15&lng=-90.51').expect(200)).body).toHaveLength(0);
  });

  it('links a manually saved spot to the mapped parking place', async () => {
    const p = await api(app, user).post('/parking-sessions').send({ vehicleId, buildingId, levelId: levels.B2, row: 'C', spot: '148' }).expect(201);
    parkingId = p.body.id;
    expect(p.body.levelLabel).toBe('B2');
    expect(p.body.parkingPlaceId).toBeTruthy();
  });

  it('starts an indoor session but refuses to route while the position is unknown', async () => {
    const s = await api(app, user).post('/navigation/sessions').send({ parkingSessionId: parkingId, mode: 'indoor' }).expect(201);
    sessionId = s.body.id;
    expect(s.body.availableModes).toEqual(['basic', 'indoor', 'sensor']);
    expect(s.body.sensorSupport).toBe('requires_native_app');
    const r = await api(app, user).get(`/navigation/sessions/${sessionId}/route`).expect(409);
    expect(r.body.code).toBe('position_unknown');
  });

  it('a weak sensor estimate never moves the position nor switches level', async () => {
    const r = await api(app, user).post(`/navigation/sessions/${sessionId}/position`).send({ source: 'barometer', levelId: levels.B2, nodeId: node.E1_B2, confidence: 0.3, capturedAt: new Date().toISOString() }).expect(200);
    expect(r.body).toMatchObject({ positionConfirmed: false, requiresConfirmation: true, currentLevelId: null, currentNodeId: null });
  });

  it('manual level selection sets the level but still asks for a landmark', async () => {
    const r = await api(app, user).post(`/navigation/sessions/${sessionId}/position`).send({ levelId: levels.L3 }).expect(200);
    expect(r.body).toMatchObject({ positionConfirmed: false, currentLevelId: levels.L3 });
    const route = await api(app, user).get(`/navigation/sessions/${sessionId}/route`).expect(409);
    expect(route.body.landmarks.map((l: { name: string }) => l.name)).toEqual(['Plaza de comidas']);
  });

  it('confirming a landmark recalibrates and yields step-by-step multi-level instructions', async () => {
    await api(app, user).post(`/navigation/sessions/${sessionId}/confirm-landmark`).send({ nodeId: node.FOOD }).expect(200);
    const s = await api(app, user).get(`/navigation/sessions/${sessionId}`).expect(200);
    expect(s.body).toMatchObject({ positionConfirmed: true, confirmedNodeId: node.FOOD });
    const r = await api(app, user).get(`/navigation/sessions/${sessionId}/route`).expect(200);
    const steps = r.body.steps.map((x: { instruction: string }) => x.instruction);
    expect(steps).toEqual([
      'Camina 20 m hasta Ascensor norte',
      'Toma Ascensor norte y ve al nivel B2',
      'Camina 40 m hasta Fila C',
      'Gira a la izquierda',
      'Camina 5 m hasta la plaza 148',
      'Llegaste a la plaza 148 (nivel B2). Confirma que el vehículo coincide con la fotografía guardada.',
    ]);
    expect(r.body.legs.map((l: { levelCode: string }) => l.levelCode)).toEqual(['L3', 'B2']);
    expect(r.body.alternatives[0].steps[1].instruction).toBe('Baja por Escalera este hasta el nivel B2');
  });

  it('reroutes by stairs when the elevator is out of service, and finds nothing accessible', async () => {
    const map = await api(app, user).get(`/indoor-maps/${buildingId}`).expect(200);
    const elevator = map.body.edges.find((e: { type: string }) => e.type === 'elevator');
    await api(app, user).patch(`/indoor-maps/edges/${elevator.id}`).send({ status: 'closed' }).expect(403);
    await api(app, admin).patch(`/indoor-maps/edges/${elevator.id}`).send({ status: 'closed' }).expect(200);
    const r = await api(app, user).get(`/navigation/sessions/${sessionId}/route`).expect(200);
    expect(r.body.steps.some((x: { instruction: string }) => x.instruction.startsWith('Baja por Escalera este'))).toBe(true);
    const acc = await api(app, user).get(`/navigation/sessions/${sessionId}/route?accessibleOnly=true`).expect(422);
    expect(acc.body.code).toBe('no_route');
    await api(app, admin).patch(`/indoor-maps/edges/${elevator.id}`).send({ status: 'open' }).expect(200);
  });

  it('direct node-to-node routing validates node ids and building visibility', async () => {
    await api(app, user).post('/navigation/route').send({ buildingId, fromNodeId: node.FOOD, toNodeId: '00000000-0000-4000-8000-000000000000' }).expect(400);
    const r = await api(app, user).post('/navigation/route').send({ buildingId, fromNodeId: node.FOOD, toNodeId: node.P148 }).expect(200);
    expect(r.body.totalDistanceMeters).toBe(80);
  });

  it('falls back to basic guidance (only saved data) when there is no map', async () => {
    const other = (await api(app, user).post('/parking-sessions').send({ vehicleId, levelLabel: 'B3', row: 'A', spot: '12', referenceType: 'elevator', referencePoint: 'Ascensor A' }).expect(201)).body.id;
    await api(app, user).post('/navigation/sessions').send({ parkingSessionId: other, mode: 'indoor' }).expect(422);
    const s = await api(app, user).post('/navigation/sessions').send({ parkingSessionId: other }).expect(201);
    expect(s.body.mode).toBe('basic');
    expect((await api(app, user).get(`/navigation/sessions/${s.body.id}/route`).expect(422)).body.code).toBe("mode_unavailable");
    const g = await api(app, user).get(`/navigation/sessions/${s.body.id}`).expect(200);
    expect(g.body.guidance.positionAvailable).toBe(false);
    expect(g.body.guidance.steps).toEqual(expect.arrayContaining(['Dirígete al nivel B3.', 'Usa como referencia: ascensor Ascensor A.', 'Busca la plaza 12.']));
  });

  it('other users cannot read someone else\'s navigation session', async () => {
    const intruder = await register(app);
    await api(app, intruder).get(`/navigation/sessions/${sessionId}`).expect(404);
    await api(app, intruder).post('/navigation/sessions').send({ parkingSessionId: parkingId }).expect(404);
  });

  it('editor PUT saves a new published version, keeping node keys and rejecting stale saves', async () => {
    const map = (await api(app, admin).get(`/indoor-maps/${buildingId}`).expect(200)).body;
    const body = {
      version: map.version,
      nodes: [...map.nodes, { id: 'tmp-kiosk', levelId: levels.L3, x: 5, y: 5, type: 'landmark', label: 'Kiosco' }],
      edges: [...map.edges, { fromNodeId: node.FOOD, toNodeId: 'tmp-kiosk', distanceMeters: 7, type: 'walk', accessible: true, status: 'open' }],
    };
    const saved = await api(app, admin).put(`/indoor-maps/${buildingId}`).send(body).expect(200);
    expect(saved.body.version).toBe(map.version + 1);
    expect(saved.body.nodes.find((n: { key: string }) => n.key === 'P148')).toBeTruthy();
    await api(app, admin).put(`/indoor-maps/${buildingId}`).send(body).expect(409);
    // the parking place still resolves on the new version
    const s = await api(app, user).post('/navigation/sessions').send({ parkingSessionId: parkingId }).expect(201);
    expect(s.body.mode).toBe('indoor');
  });
});
