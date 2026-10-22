import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sha256 } from '../src/common/http';
import { api, createApp, prisma, register, resetDb } from './helpers';

describe('Auth & security (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    await resetDb();
    app = await createApp();
  });
  afterAll(() => app.close());

  it('registers, returns tokens and profile without password hash', async () => {
    const res = await api(app).post('/auth/register').send({ email: 'Ana@Test.local', password: 'Password123', fullName: 'Ana' }).expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('ana@test.local');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const sub = await prisma.subscription.findFirst({ where: { userId: res.body.user.id } });
    expect(sub?.planCode).toBe('free');
  });

  it('rejects weak passwords and duplicate emails; strips privilege fields', async () => {
    await api(app).post('/auth/register').send({ email: 'weak@test.local', password: 'short', fullName: 'W' }).expect(400);
    await api(app).post('/auth/register').send({ email: 'ana@test.local', password: 'Password123', fullName: 'Ana' }).expect(409);
    const r = await api(app).post('/auth/register').send({ email: 'x@test.local', password: 'Password123', fullName: 'Xavi', role: 'PLATFORM_ADMIN', roles: ['PLATFORM_ADMIN'] }).expect(201);
    expect(r.body.user.role).toBe('USER');
    expect(r.body.user.roles).toEqual(['USER']);
  });

  it('requires a token on protected routes and rejects forged tokens', async () => {
    await api(app).get('/users/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/users/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
  });

  it('locks the account after 5 failed logins (brute-force protection)', async () => {
    const u = await register(app);
    for (let i = 0; i < 5; i++) await api(app).post('/auth/login').send({ email: u.email, password: 'WrongPass999' }).expect(401);
    const locked = await api(app).post('/auth/login').send({ email: u.email, password: 'Password123' }).expect(401);
    expect(locked.body.message).toMatch(/locked/i);
    expect(await prisma.auditEvent.count({ where: { actorUserId: u.id, action: 'auth.locked' } })).toBe(1);
  });

  it('rotates refresh tokens and revokes all sessions on reuse', async () => {
    const u = await register(app);
    const r1 = await api(app).post('/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
    expect(r1.body.refreshToken).not.toBe(u.refreshToken);
    // reuse of the old (rotated) token => everything revoked
    await api(app).post('/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await api(app).post('/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const u = await register(app);
    await api(app).post('/auth/logout').send({ refreshToken: u.refreshToken }).expect(204);
    await api(app).post('/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
  });

  it('forgot-password does not reveal whether an email exists; reset works once and revokes sessions', async () => {
    const u = await register(app);
    await api(app).post('/auth/forgot-password').send({ email: 'nobody@test.local' }).expect(202);
    await api(app).post('/auth/forgot-password').send({ email: u.email }).expect(202);
    expect(await prisma.passwordResetToken.count({ where: { userId: u.id } })).toBe(1);
    // the emailed token is not retrievable (only its hash is stored), so plant a known one
    await prisma.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256('known-token'), expiresAt: new Date(Date.now() + 60_000) } });
    await api(app).post('/auth/reset-password').send({ token: 'known-token', password: 'NewPassword456' }).expect(204);
    await api(app).post('/auth/reset-password').send({ token: 'known-token', password: 'NewPassword789' }).expect(400);
    await api(app).post('/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    await api(app).post('/auth/login').send({ email: u.email, password: 'NewPassword456' }).expect(200);
  });

  it('exports and deletes personal data (anonymised, can no longer log in)', async () => {
    const u = await register(app);
    const v = await api(app, u).post('/vehicles').send({ alias: 'Mío', make: 'Toyota', model: 'Yaris' }).expect(201);
    await api(app, u).post('/parking-sessions').send({ vehicleId: v.body.id, latitude: 14.6, longitude: -90.5 }).expect(201);
    const exp = await api(app, u).get('/users/me/export').expect(200);
    expect(exp.body.vehicles).toHaveLength(1);
    expect(exp.body.parking).toHaveLength(1);
    await api(app, u).delete('/users/me').send({ password: 'bad' }).expect(401);
    await api(app, u).delete('/users/me').send({ password: 'Password123' }).expect(204);
    expect(await prisma.parkingSession.count({ where: { vehicleId: v.body.id } })).toBe(0);
    await api(app, u).get('/users/me').expect(401);
    await api(app).post('/auth/login').send({ email: u.email, password: 'Password123' }).expect(401);
  });

  it('applies rate limiting on auth endpoints when enabled', async () => {
    process.env.THROTTLE_DISABLED = 'false';
    try {
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) codes.push((await api(app).post('/auth/login').send({ email: 'rl@test.local', password: 'Password123' })).status);
      expect(codes).toContain(429);
    } finally {
      process.env.THROTTLE_DISABLED = 'true';
    }
  });

  it('blocks non-admins from /admin and allows platform admins', async () => {
    const u = await register(app);
    await api(app, u).get('/admin/users').expect(403);
    await prisma.user.update({ where: { id: u.id }, data: { role: 'PLATFORM_ADMIN' } });
    const res = await api(app, u).get('/admin/usage').expect(200);
    expect(res.body.activeUsers).toBeGreaterThan(0);
    expect(res.body.series.length).toBe(30);
    const h = await api(app, u).get('/admin/health').expect(200);
    expect(h.body.services.find((s: { name: string }) => s.name.startsWith('PostgreSQL')).status).toBe('up');
  });

  it('health reports DB/PostGIS and unconfigured integrations honestly', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.database).toBe('up');
    expect(res.body.integrations.payments).toBe('configured'); // test env sets a fake provider
    expect(res.body.integrations.storage).toBe('not_configured');
  });
});
