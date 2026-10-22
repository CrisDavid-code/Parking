import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { api, createApp, prisma, register, resetDb, setPlan, TestUser } from './helpers';

describe('Sharing, organizations & fleet (e2e)', () => {
  let app: INestApplication;
  let owner: TestUser;
  let friend: TestUser;
  let stranger: TestUser;
  let vehicleId: string;

  beforeAll(async () => {
    await resetDb();
    app = await createApp();
    owner = await register(app);
    friend = await register(app);
    stranger = await register(app);
    vehicleId = (await api(app, owner).post('/vehicles').send({ alias: 'Familiar', make: 'Kia', model: 'Picanto' }).expect(201)).body.id;
    await api(app, owner).post('/parking-sessions').send({ vehicleId, levelLabel: 'B2', row: 'C', spot: '148' }).expect(201);
  });
  afterAll(() => app.close());

  describe('sharing', () => {
    let token: string;
    let shareId: string;

    it('creates an invitation with a link and does not grant access before acceptance', async () => {
      const res = await api(app, owner).post('/shares').send({ vehicleId, granteeEmail: friend.email, permissions: ['view_parking'] }).expect(201);
      shareId = res.body.id;
      token = res.body.inviteUrl.split('/invite/')[1];
      expect(res.body.emailDelivered).toBe(false); // email provider not configured: reported, not faked
      await api(app, friend).get(`/vehicles/${vehicleId}`).expect(404);
    });

    it('previews publicly without leaking private data', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/shares/invitations/${token}`).expect(200);
      expect(res.body).toMatchObject({ status: 'pending', vehicle: { alias: 'Familiar' }, permissions: ['view_parking'] });
      expect(JSON.stringify(res.body)).not.toContain(friend.email);
    });

    it('can only be accepted by the invited email', async () => {
      await api(app, stranger).post(`/shares/invitations/${token}/accept`).expect(403);
      await api(app, friend).post(`/shares/invitations/${token}/accept`).expect(200);
      await api(app, friend).get(`/parking-sessions/active?vehicleId=${vehicleId}`).expect(200);
      await api(app, friend).get(`/tracking/vehicles/${vehicleId}/last`).expect(403); // no view_location
      await api(app, friend).post('/parking-sessions').send({ vehicleId, levelLabel: 'B1' }).expect(403); // view-only
      const list = await api(app, friend).get('/shares').expect(200);
      expect(list.body.items[0].direction).toBe('incoming');
    });

    it('revocation removes access immediately', async () => {
      await api(app, owner).delete(`/shares/${shareId}`).expect(204);
      await api(app, friend).get(`/vehicles/${vehicleId}`).expect(404);
    });

    it('expired shares grant nothing', async () => {
      const res = await api(app, owner).post('/shares').send({ vehicleId, granteeEmail: friend.email, permissions: ['view_parking'], expiresAt: new Date(Date.now() + 60_000).toISOString() }).expect(201);
      await api(app, friend).post(`/invitations/${res.body.inviteUrl.split('/invite/')[1]}/accept`).expect(200);
      await api(app, friend).get(`/vehicles/${vehicleId}`).expect(200);
      await prisma.locationShare.update({ where: { id: res.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await api(app, friend).get(`/vehicles/${vehicleId}`).expect(404);
    });
  });

  describe('organizations & fleet', () => {
    let orgA: string;
    let orgB: string;
    let fleetVehicle: string;
    let deviceToken: string;
    let deviceId: string;

    it('creates organizations with derived slug and gives the creator ORG_ADMIN', async () => {
      orgA = (await api(app, owner).post('/organizations').send({ name: 'Transportes Ñandú' }).expect(201)).body.id;
      orgB = (await api(app, stranger).post('/organizations').send({ name: 'Otra Empresa' }).expect(201)).body.id;
      const me = await api(app, owner).get('/users/me').expect(200);
      expect(me.body.roles).toContain('ORG_ADMIN');
      expect(me.body.organizationId).toBe(orgA);
      await setPlan({ organizationId: orgA }, 'business');
    });

    it('isolates organizations from each other', async () => {
      await api(app, stranger).get(`/organizations/${orgA}/vehicles`).expect(404);
      await api(app, stranger).get(`/organizations/${orgA}/geofences`).expect(404);
      await api(app, stranger).get(`/organizations/${orgA}/reports/summary`).expect(404);
      await api(app, owner).post(`/organizations/${orgB}/drivers`).send({ fullName: 'Intruso' }).expect(404);
    });

    it('manages fleet vehicles, drivers and assignments', async () => {
      fleetVehicle = (await api(app, owner).post(`/organizations/${orgA}/vehicles`).send({ alias: 'Camión 1', make: 'Isuzu', model: 'NPR', year: 2022, color: 'Blanco' }).expect(201)).body.id;
      const driver = (await api(app, owner).post(`/organizations/${orgA}/drivers`).send({ fullName: 'Juan Pérez', email: 'juan@test.local' }).expect(201)).body;
      const drivers = await api(app, owner).get(`/organizations/${orgA}/drivers?status=active&q=juan`).expect(200);
      expect(drivers.body.items[0]).toMatchObject({ fullName: 'Juan Pérez', status: 'active' });
      await api(app, owner).post(`/organizations/${orgA}/assignments`).send({ vehicleId: fleetVehicle, driverId: driver.id }).expect(201);
      const as = await api(app, owner).get(`/organizations/${orgA}/assignments`).expect(200);
      expect(as.body.items[0]).toMatchObject({ vehicleAlias: 'Camión 1', driverName: 'Juan Pérez', status: 'active' });
      // a vehicle from another account can't be assigned
      await api(app, owner).post(`/organizations/${orgA}/assignments`).send({ vehicleId, driverId: driver.id }).expect(400);
    });

    it('records geofence enter/exit from real device points and lists them as alerts', async () => {
      await api(app, owner).post(`/organizations/${orgA}/geofences`).send({ name: 'Bodega', centerLat: 14.6, centerLng: -90.5, radiusMeters: 200, type: 'circle' }).expect(201);
      const dev = (await api(app, owner).post('/devices').send({ name: 'GPS camión', type: 'gps', serial: 'TRK-1', vehicleId: fleetVehicle, organizationId: orgA }).expect(201)).body;
      deviceToken = dev.deviceToken;
      deviceId = dev.id;
      const send = (lat: number, msAgo: number) =>
        request(app.getHttpServer()).post('/api/v1/tracking/ingest').set('Authorization', `Device ${deviceToken}`)
          .send({ deviceId, vehicleId: fleetVehicle, latitude: lat, longitude: -90.5, accuracyMeters: 5, capturedAt: new Date(Date.now() - msAgo).toISOString() }).expect(202);
      await send(14.6, 3000); // inside
      await send(14.61, 2000); // ~1.1 km north: exit
      await send(14.62, 1000); // further away, still outside: no new event
      expect(await prisma.geofenceEvent.count()).toBe(2);
      const alerts = await api(app, owner).get(`/organizations/${orgA}/alerts`).expect(200);
      const exit = alerts.body.items.find((a: { type: string }) => a.type === 'geofence_exit');
      expect(exit.acknowledged).toBe(false);
      await api(app, owner).post(`/organizations/${orgA}/alerts/${exit.id}/ack`).expect(204);
      const after = await api(app, owner).get(`/organizations/${orgA}/alerts?severity=info`).expect(200);
      expect(after.body.items.find((a: { id: string }) => a.id === exit.id).acknowledged).toBe(true);
    });

    it('reports real distance travelled (PostGIS) per day', async () => {
      const res = await api(app, owner).get(`/organizations/${orgA}/reports/summary`).expect(200);
      const today = res.body.series.at(-1);
      expect(res.body.series).toHaveLength(30);
      expect(today.distanceKm).toBeGreaterThan(2); // ~2.2 km between the 3 points
      expect(today.distanceKm).toBeLessThan(2.5);
      expect(res.body.totals).toMatchObject({ vehicles: 1, activeVehicles: 1, drivers: 1, devices: 1 });
      await api(app, owner).get(`/organizations/${orgA}/reports/summary?from=2026-02-10&to=2026-01-01`).expect(400);
    });

    it('invites members bound to their email and enforces at least one admin', async () => {
      const inv = await api(app, owner).post(`/organizations/${orgA}/members`).send({ email: friend.email, role: 'ORG_MEMBER' }).expect(201);
      await api(app, friend).post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).expect(200);
      const members = await api(app, owner).get(`/organizations/${orgA}/members`).expect(200);
      expect(members.body.total).toBe(2);
      await api(app, friend).post(`/organizations/${orgA}/drivers`).send({ fullName: 'No admin' }).expect(403);
      await api(app, friend).get(`/tracking/vehicles/${fleetVehicle}/last`).expect(200); // ORG_MEMBER can see fleet location
      await api(app, owner).delete(`/organizations/${orgA}/members/${owner.id}`).expect(400);
    });
  });

  it('support tickets reach platform admins only', async () => {
    await api(app, owner).post('/support/tickets').send({ subject: 'No veo mi auto', message: 'El mapa no carga en el sótano.' }).expect(201);
    await api(app, owner).get('/admin/support').expect(403);
    await prisma.user.update({ where: { id: stranger.id }, data: { role: 'PLATFORM_ADMIN' } });
    const list = await api(app, stranger).get('/admin/support?status=open').expect(200);
    expect(list.body.items[0]).toMatchObject({ subject: 'No veo mi auto', userEmail: owner.email });
    await api(app, stranger).patch(`/admin/support/${list.body.items[0].id}`).send({ status: 'closed' }).expect(200);
    const audit = await api(app, stranger).get('/admin/audit?q=support').expect(200);
    expect(audit.body.items[0]).toMatchObject({ action: 'support.status', actorEmail: stranger.email });
  });
});
