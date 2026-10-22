import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

export const prisma = new PrismaClient();

export async function createApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'spatial_ref_sys')`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  await prisma.plan.createMany({
    data: [
      { code: 'free', name: 'Free', priceMonthly: 0, sortOrder: 0, limits: { vehicles: 1, devices: 0, historyDays: 7, members: 1 } },
      { code: 'plus', name: 'Plus', priceMonthly: 29, sortOrder: 1, limits: { vehicles: 3, devices: 0, historyDays: 30, members: 3 } },
      { code: 'tracking', name: 'Tracking', priceMonthly: 79, sortOrder: 2, limits: { vehicles: 3, devices: 3, historyDays: 90, members: 5 } },
      { code: 'business', name: 'Business', priceMonthly: 499, sortOrder: 3, limits: { vehicles: 50, devices: 50, historyDays: 365, members: 50 } },
    ],
  });
}

let n = 0;
export interface TestUser { id: string; email: string; token: string; refreshToken: string }

export async function register(app: INestApplication, opts: { accountType?: 'personal' | 'business' } = {}): Promise<TestUser> {
  const email = `user${++n}-${Date.now()}@test.local`;
  const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password: 'Password123', fullName: 'Test User', ...opts }).expect(201);
  return { id: res.body.user.id, email, token: res.body.accessToken, refreshToken: res.body.refreshToken };
}

/** Sets a plan directly, for tests that aren't about billing (billing activation is tested via signed webhooks). */
export async function setPlan(where: { userId?: string; organizationId?: string }, planCode: string) {
  await prisma.subscription.updateMany({ where, data: { planCode, status: 'active' } });
}

export const api = (app: INestApplication, u?: TestUser) => {
  const s = request(app.getHttpServer());
  const auth = (r: request.Test) => (u ? r.set('Authorization', `Bearer ${u.token}`) : r);
  return {
    get: (p: string) => auth(s.get(`/api/v1${p}`)),
    post: (p: string) => auth(s.post(`/api/v1${p}`)),
    patch: (p: string) => auth(s.patch(`/api/v1${p}`)),
    put: (p: string) => auth(s.put(`/api/v1${p}`)),
    delete: (p: string) => auth(s.delete(`/api/v1${p}`)),
  };
};
