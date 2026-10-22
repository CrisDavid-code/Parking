/**
 * Idempotent seed.
 *  - Always: plans (prices are PROVISIONAL placeholders — set real ones via /admin/plans).
 *  - SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD: creates/promotes a platform admin.
 *  - SEED_TEST_BUILDING=true: a small test building ("Centro Comercial de Prueba") with levels L3 and B2,
 *    an elevator and stairs, row C and spot 148. It is test data for routing, not a real building.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PLANS = [
  { code: 'free', name: 'Free', priceMonthly: 0, sortOrder: 0, limits: { vehicles: 1, devices: 0, historyDays: 7, members: 1 } },
  { code: 'plus', name: 'Plus', priceMonthly: 29, sortOrder: 1, limits: { vehicles: 3, devices: 0, historyDays: 30, members: 3 } },
  { code: 'tracking', name: 'Tracking', priceMonthly: 79, sortOrder: 2, limits: { vehicles: 3, devices: 3, historyDays: 90, members: 5 } },
  { code: 'business', name: 'Business', priceMonthly: 499, sortOrder: 3, limits: { vehicles: 50, devices: 50, historyDays: 365, members: 50 } },
];

async function main() {
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { code: p.code }, create: { ...p, currency: 'GTQ' }, update: {} });
  }

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: await argon2.hash(password), fullName: 'Platform Admin', role: 'PLATFORM_ADMIN', profile: { create: {} }, subscriptions: { create: { planCode: 'free' } } },
      update: { role: 'PLATFORM_ADMIN' },
    });
  }

  if (process.env.SEED_TEST_BUILDING === 'true' && !(await prisma.building.findFirst({ where: { name: 'Centro Comercial de Prueba' } }))) {
    const b = await prisma.building.create({
      data: {
        name: 'Centro Comercial de Prueba',
        address: 'Datos de prueba — no corresponde a un edificio real',
        latitude: 14.6,
        longitude: -90.51,
        levels: { create: [{ code: 'L3', name: 'Nivel 3', ordinal: 3 }, { code: 'B2', name: 'Sótano 2', ordinal: -2 }] },
      },
      include: { levels: true },
    });
    const L = Object.fromEntries(b.levels.map((l) => [l.code, l.id]));
    const v = await prisma.indoorMapVersion.create({ data: { buildingId: b.id, version: 1, status: 'published', publishedAt: new Date(), notes: 'Mapa de prueba' } });
    const nodes = [
      ['L3_FOOD', 'L3', 0, 0, 'landmark', 'Plaza de comidas'],
      ['L3_E1', 'L3', 20, 0, 'elevator', 'Ascensor norte'],
      ['L3_S1', 'L3', 0, 30, 'stairs', 'Escalera este'],
      ['B2_E1', 'B2', 20, 0, 'elevator', 'Ascensor norte'],
      ['B2_S1', 'B2', 0, 30, 'stairs', 'Escalera este'],
      ['B2_ROWC', 'B2', 20, 40, 'corridor', 'Fila C'],
      ['B2_P148', 'B2', 25, 40, 'parking_spot', 'Plaza 148'],
    ] as const;
    for (const [key, lvl, x, y, type, label] of nodes) await prisma.navigationNode.create({ data: { mapVersionId: v.id, levelId: L[lvl], key, x, y, type, label } });
    const id = Object.fromEntries((await prisma.navigationNode.findMany({ where: { mapVersionId: v.id } })).map((n) => [n.key, n.id]));
    const edges: [string, string, number, 'walk' | 'elevator' | 'stairs', boolean][] = [
      ['L3_FOOD', 'L3_E1', 20, 'walk', true],
      ['L3_FOOD', 'L3_S1', 30, 'walk', true],
      ['L3_E1', 'B2_E1', 15, 'elevator', true],
      ['L3_S1', 'B2_S1', 25, 'stairs', false],
      ['B2_E1', 'B2_ROWC', 40, 'walk', true],
      ['B2_S1', 'B2_ROWC', 22.4, 'walk', true],
      ['B2_ROWC', 'B2_P148', 5, 'walk', true],
    ];
    await prisma.navigationEdge.createMany({ data: edges.map(([f, t, d, type, accessible]) => ({ mapVersionId: v.id, fromNodeId: id[f], toNodeId: id[t], distanceMeters: d, type, accessible })) });
    await prisma.parkingPlace.create({ data: { levelId: L.B2, nodeId: id.B2_P148, code: '148', row: 'C' } });
    await prisma.indoorLandmark.create({ data: { levelId: L.L3, nodeId: id.L3_FOOD, name: 'Plaza de comidas', description: 'Frente a la fuente central' } });
    await prisma.building.update({ where: { id: b.id }, data: { publishedVersion: 1 } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
