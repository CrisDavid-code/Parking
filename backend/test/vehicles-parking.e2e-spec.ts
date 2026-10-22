import { INestApplication } from '@nestjs/common';
import { api, createApp, register, resetDb, setPlan, TestUser } from './helpers';

describe('Vehicles & parking (e2e)', () => {
  let app: INestApplication;
  let a: TestUser;
  let b: TestUser;
  let vehicleId: string;
  beforeAll(async () => {
    await resetDb();
    app = await createApp();
    a = await register(app);
    b = await register(app);
  });
  afterAll(() => app.close());

  it('creates the first vehicle as primary', async () => {
    const res = await api(app, a).post('/vehicles').send({ alias: 'Rojo', make: 'Mazda', model: '3', year: 2020, color: 'Rojo', plate: 'P123ABC' }).expect(201);
    vehicleId = res.body.id;
    expect(res.body.isPrimary).toBe(true);
    expect(res.body.trackingStatus).toBe('none');
    expect(res.body.photoUrl).toBeNull();
  });

  it('enforces the plan vehicle limit server-side (402)', async () => {
    const res = await api(app, a).post('/vehicles').send({ alias: 'Otro', make: 'Kia', model: 'Rio' }).expect(402);
    expect(res.body.limit).toBe('vehicles');
    await setPlan({ userId: a.id }, 'plus');
    await api(app, a).post('/vehicles').send({ alias: 'Otro', make: 'Kia', model: 'Rio' }).expect(201);
  });

  it('isolates users: B cannot see, edit or park A\'s vehicle', async () => {
    await api(app, b).get(`/vehicles/${vehicleId}`).expect(404);
    await api(app, b).patch(`/vehicles/${vehicleId}`).send({ alias: 'hack' }).expect(404);
    await api(app, b).post('/parking-sessions').send({ vehicleId, latitude: 1, longitude: 1 }).expect(404);
    const list = await api(app, b).get('/vehicles').expect(200);
    expect(list.body.items).toHaveLength(0);
  });

  it('validates coordinates and references', async () => {
    await api(app, a).post('/parking-sessions').send({ vehicleId, latitude: 95, longitude: 10 }).expect(400);
    await api(app, a).post('/parking-sessions').send({ vehicleId, latitude: 14.6 }).expect(400);
    await api(app, a).post('/parking-sessions').send({ vehicleId, buildingId: '00000000-0000-4000-8000-000000000000' }).expect(400);
    await api(app, a).post('/parking-sessions').send({ vehicleId, startedAt: new Date(Date.now() + 3_600_000).toISOString() }).expect(400);
    await api(app, a).get('/parking-sessions/not-a-uuid').expect(400);
  });

  it('records GPS and fully manual parking; a new session ends the previous one', async () => {
    const gps = await api(app, a).post('/parking-sessions').send({ vehicleId, latitude: 14.6, longitude: -90.5, accuracyMeters: 12 }).expect(201);
    expect(gps.body.source).toBe('gps');
    const manual = await api(app, a)
      .post('/parking-sessions')
      .send({ vehicleId, levelLabel: 'B2', zone: 'Norte', row: 'C', spot: '148', referenceType: 'elevator', referencePoint: 'Ascensor norte', notes: 'Junto a la columna azul' })
      .expect(201);
    expect(manual.body.source).toBe('manual');
    expect(manual.body.latitude).toBeNull();
    const active = await api(app, a).get(`/parking-sessions/active?vehicleId=${vehicleId}`).expect(200);
    expect(active.body.id).toBe(manual.body.id);
    const old = await api(app, a).get(`/parking-sessions/${gps.body.id}`).expect(200);
    expect(old.body.status).toBe('ended');
  });

  it('updates, ends, lists history and deletes', async () => {
    const p = await api(app, a).post('/parking-sessions').send({ vehicleId, levelLabel: 'B1' }).expect(201);
    await api(app, a).patch(`/parking-sessions/${p.body.id}`).send({ spot: '22' }).expect(200);
    const ended = await api(app, a).post(`/parking-sessions/${p.body.id}/end`).expect(200);
    expect(ended.body.endedAt).toBeTruthy();
    await api(app, a).post(`/parking-sessions/${p.body.id}/end`).expect(400);
    const hist = await api(app, a).get(`/parking-sessions?vehicleId=${vehicleId}&pageSize=2`).expect(200);
    expect(hist.body.total).toBeGreaterThanOrEqual(3);
    expect(hist.body.items).toHaveLength(2);
    await api(app, a).delete(`/parking-sessions/${p.body.id}`).expect(204);
    await api(app, a).get(`/parking-sessions/${p.body.id}`).expect(404);
  });

  it('reports storage as not configured instead of faking uploads', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const res = await api(app, a).post(`/vehicles/${vehicleId}/photo`).attach('file', png, 'x.png').expect(503);
    expect(res.body.code).toBe('storage_not_configured');
    await api(app, a).post(`/vehicles/${vehicleId}/photo`).attach('file', Buffer.from('not an image'), 'x.png').expect(400);
  });

  it('lets the owner add a member with limited permissions', async () => {
    await api(app, a).post(`/vehicles/${vehicleId}/members`).send({ email: b.email, permissions: ['view_parking'] }).expect(201);
    const members = await api(app, a).get(`/vehicles/${vehicleId}/members`).expect(200);
    expect(members.body.items.map((m: { role: string }) => m.role)).toEqual(['owner', 'member']);
    await api(app, b).get(`/vehicles/${vehicleId}`).expect(200);
    await api(app, b).patch(`/vehicles/${vehicleId}`).send({ alias: 'x' }).expect(403);
    await api(app, b).get(`/tracking/vehicles/${vehicleId}/last`).expect(403);
    await api(app, a).delete(`/vehicles/${vehicleId}/members/${b.id}`).expect(204);
    await api(app, b).get(`/vehicles/${vehicleId}`).expect(404);
  });

  it('soft-deletes vehicles', async () => {
    const v = await api(app, a).post('/vehicles').send({ alias: 'Temp', make: 'VW', model: 'Gol' }).expect(201);
    await api(app, a).delete(`/vehicles/${v.body.id}`).expect(204);
    await api(app, a).get(`/vehicles/${v.body.id}`).expect(404);
  });
});
