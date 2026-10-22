import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import request from 'supertest';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { api, createApp, prisma, register, resetDb, TestUser } from './helpers';

const sign = (body: string) => createHmac('sha256', 'whsec_test').update(body).digest('hex');

describe('Subscriptions, devices & tracking (e2e)', () => {
  let app: INestApplication;
  let owner: TestUser;
  let other: TestUser;
  let vehicleId: string;
  let deviceId: string;
  let token: string;

  const ingest = (body: Record<string, unknown>, t: string | null = token) => {
    const r = request(app.getHttpServer()).post('/api/v1/tracking/ingest');
    return (t ? r.set('Authorization', `Device ${t}`) : r).send(body);
  };
  const point = (over: Record<string, unknown> = {}) => ({ deviceId, vehicleId, latitude: 14.6, longitude: -90.5, accuracyMeters: 8, speedMetersPerSecond: 0, headingDegrees: 90, capturedAt: new Date().toISOString(), source: 'gps', ...over });

  beforeAll(async () => {
    await resetDb();
    app = await createApp();
    await app.listen(0);
    owner = await register(app);
    other = await register(app);
    vehicleId = (await api(app, owner).post('/vehicles').send({ alias: 'Auto', make: 'Honda', model: 'Civic' }).expect(201)).body.id;
  });
  afterAll(() => app.close());

  describe('subscriptions', () => {
    it('blocks devices on the free plan and refuses to fake a paid upgrade', async () => {
      await api(app, owner).post('/devices').send({ name: 'GPS', type: 'gps_tracker', serial: 'SN1', vehicleId }).expect(402);
      const res = await api(app, owner).post('/subscriptions/change').send({ planCode: 'tracking' }).expect(200);
      expect(res.body.status).toBe('pending_payment');
      expect((await api(app, owner).get('/subscriptions/me').expect(200)).body.planCode).toBe('free');
    });

    it('rejects webhooks with a bad signature or unknown provider', async () => {
      const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: owner.id } });
      const body = JSON.stringify({ id: 'evt_bad', type: 'subscription.activated', data: { subscriptionId: sub.id, planCode: 'business' } });
      await request(app.getHttpServer()).post('/api/v1/subscriptions/webhooks/testpay').set('Content-Type', 'application/json').set('x-signature', 'deadbeef').send(body).expect(401);
      await request(app.getHttpServer()).post('/api/v1/subscriptions/webhooks/otherpay').set('Content-Type', 'application/json').set('x-signature', sign(body)).send(body).expect(404);
    });

    it('activates the plan only through a verified webhook, idempotently', async () => {
      const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: owner.id } });
      const body = JSON.stringify({ id: 'evt_1', type: 'subscription.activated', data: { subscriptionId: sub.id, providerRef: 'cus_1' } });
      const send = () => request(app.getHttpServer()).post('/api/v1/subscriptions/webhooks/testpay').set('Content-Type', 'application/json').set('x-signature', sign(body)).send(body).expect(200);
      expect((await send()).body.duplicate).toBeUndefined();
      expect((await send()).body.duplicate).toBe(true);
      expect((await api(app, owner).get('/subscriptions/me').expect(200)).body.planCode).toBe('tracking');
      expect(await prisma.billingEvent.count()).toBe(1);
    });
  });

  describe('devices', () => {
    it('creates a device and returns its token exactly once', async () => {
      const res = await api(app, owner).post('/devices').send({ name: 'GPS', type: 'gps_tracker', serial: 'SN1', vehicleId }).expect(201);
      deviceId = res.body.id;
      token = res.body.deviceToken;
      expect(token).toMatch(/^vdt_/);
      const fetched = await api(app, owner).get(`/devices/${deviceId}`).expect(200);
      expect(JSON.stringify(fetched.body)).not.toContain(token.slice(17));
      expect(fetched.body.connection).toBe('never');
    });

    it('cannot bind a device to someone else\'s vehicle', async () => {
      const otherVehicle = (await api(app, other).post('/vehicles').send({ alias: 'B', make: 'X', model: 'Y' }).expect(201)).body.id;
      await api(app, owner).post('/devices').send({ name: 'GPS2', type: 'gps_tracker', serial: 'SN2', vehicleId: otherVehicle }).expect(404);
      await api(app, other).get(`/devices/${deviceId}`).expect(404);
    });
  });

  describe('tracking ingest', () => {
    it('rejects missing/forged credentials and mismatched ids', async () => {
      await ingest(point(), null).expect(401);
      await ingest(point(), 'vdt_AAAAAAAAAAAA_' + 'A'.repeat(43)).expect(401);
      await ingest(point({ vehicleId: '00000000-0000-4000-8000-000000000000' })).expect(403);
      await ingest(point({ deviceId: '00000000-0000-4000-8000-000000000000' })).expect(403);
      await ingest(point({ latitude: 200 })).expect(400);
      await ingest(point({ capturedAt: new Date(Date.now() + 3_600_000).toISOString() })).expect(400);
    });

    it('accepts a point, is idempotent and exposes live freshness', async () => {
      const p = point();
      expect((await ingest(p).expect(202)).body).toMatchObject({ accepted: true, duplicate: false, latest: true });
      expect((await ingest(p).expect(202)).body.duplicate).toBe(true);
      expect(await prisma.locationEvent.count({ where: { deviceId } })).toBe(1);
      const last = await api(app, owner).get(`/tracking/vehicles/${vehicleId}/last`).expect(200);
      expect(last.body.freshness).toBe('live');
      const dev = await api(app, owner).get(`/devices/${deviceId}`).expect(200);
      expect(dev.body.status).toBe('active');
      expect(dev.body.connection).toBe('online');
    });

    it('stores late points in history without overwriting the latest location', async () => {
      const old = new Date(Date.now() - 30 * 60_000).toISOString();
      expect((await ingest(point({ capturedAt: old, latitude: 14.7 })).expect(202)).body.latest).toBe(false);
      const last = await api(app, owner).get(`/tracking/vehicles/${vehicleId}/last`).expect(200);
      expect(last.body.latitude).toBe(14.6);
      const hist = await api(app, owner).get(`/tracking/vehicles/${vehicleId}/history`).expect(200);
      expect(hist.body).toHaveLength(2);
      expect(hist.body[0].historyDays).toBe(90);
    });

    it('marks stale data as stale, never as live', async () => {
      await prisma.vehicleLastLocation.update({ where: { vehicleId }, data: { capturedAt: new Date(Date.now() - 3_600_000) } });
      const last = await api(app, owner).get(`/tracking/vehicles/${vehicleId}/last`).expect(200);
      expect(last.body.freshness).toBe('stale');
      expect((await api(app, owner).get(`/vehicles/${vehicleId}`).expect(200)).body.trackingStatus).toBe('stale');
    });

    it('hides locations from unauthorized users', async () => {
      await api(app, other).get(`/tracking/vehicles/${vehicleId}/last`).expect(404);
      await api(app, other).get(`/tracking/vehicles/${vehicleId}/history`).expect(404);
      expect((await api(app, other).get('/tracking/vehicles').expect(200)).body).toHaveLength(0);
    });

    it('alerts the owner when the vehicle moves away from its parking spot (once)', async () => {
      await api(app, owner).post('/parking-sessions').send({ vehicleId, latitude: 14.6, longitude: -90.5, accuracyMeters: 10 }).expect(201);
      await ingest(point({ latitude: 14.61 })).expect(202); // ~1.1 km away
      await ingest(point({ latitude: 14.62, capturedAt: new Date(Date.now() + 1000).toISOString() })).expect(202);
      const notes = await api(app, owner).get('/notifications').expect(200);
      expect(notes.body.items.filter((n: { type: string }) => n.type === 'vehicle.moved')).toHaveLength(1);
    });

    it('pushes live updates over WebSocket only to authorized subscribers', async () => {
      const base = `ws://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/tracking?vehicleId=${vehicleId}`;
      const open = (t: string) => new Promise<{ ws: WebSocket; closed: Promise<number> }>((res) => {
        const ws = new WebSocket(`${base}&token=${t}`);
        const closed = new Promise<number>((c) => ws.on('close', (code) => c(code)));
        ws.on('open', () => setTimeout(() => res({ ws, closed }), 100));
      });
      const ok = await open(owner.token);
      const intruder = await open(other.token);
      expect(await intruder.closed).toBe(4401);
      const got = new Promise<{ event: string; data: { freshness: string } }>((res) => ok.ws.once('message', (m) => res(JSON.parse(String(m)))));
      await ingest(point({ capturedAt: new Date(Date.now() + 5000).toISOString() })).expect(202);
      const msg = await got;
      expect(msg.event).toBe('location');
      expect(msg.data.freshness).toBe('live');
      ok.ws.close();
    });

    it('revoked devices can no longer report', async () => {
      await api(app, owner).post(`/devices/${deviceId}/revoke`).expect(200);
      await ingest(point({ capturedAt: new Date(Date.now() + 10_000).toISOString() })).expect(401);
      expect(await prisma.auditEvent.count({ where: { action: 'device.revoke', resourceId: deviceId } })).toBe(1);
    });
  });

  describe('retention', () => {
    it('purges location events beyond the plan window', async () => {
      const dev = await prisma.trackingDevice.findUniqueOrThrow({ where: { id: deviceId } });
      await prisma.locationEvent.create({ data: { vehicleId, deviceId: dev.id, latitude: 1, longitude: 1, capturedAt: new Date(Date.now() - 120 * 86_400_000) } });
      const admin = await register(app);
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'PLATFORM_ADMIN' } });
      const before = await prisma.locationEvent.count({ where: { vehicleId } });
      const r = await api(app, admin).post('/admin/retention/run').expect(200);
      expect(r.body.locationEvents).toBe(1);
      expect(await prisma.locationEvent.count({ where: { vehicleId } })).toBe(before - 1);
    });
  });
});
