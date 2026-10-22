# Veyro (nombre provisional)

Superapp SaaS de movilidad: guardar dónde estacionaste, encontrar el vehículo, navegación interior multinivel de regreso a la plaza, rastreo de dispositivos autorizados, compartir acceso, flotas y suscripciones.

| Carpeta | Contenido |
|---|---|
| `frontend/` | App web (TanStack Start + React + Tailwind + shadcn) generada en Lovable y ajustada al backend real |
| `backend/` | API NestJS 11 + Prisma + PostgreSQL 16/PostGIS 3.4, REST `/api/v1`, WebSocket `/tracking`, Swagger `/api/docs` |
| `docs/` | `openapi.json`, integración, operación/despliegue, capacidades nativas/hardware, capturas |
| `docker-compose.yml` | PostGIS + API |

> Estado: código implementado y probado en local (67 pruebas backend, 4 frontend, flujo E2E en navegador). **No está listo para producción**: ver `docs/OPERATIONS.md` → "Pendiente para producción".

## Arranque en desarrollo

Requisitos: Node 22, Bun 1.x, PostgreSQL 16 con PostGIS 3.4 (o Docker).

```bash
# 1. Base de datos (opción Docker)
docker compose up -d db            # expone 5433 → usa DATABASE_URL=...@localhost:5433/veyro, usuario/clave veyro/veyro-local-only

# 2. Backend
cd backend
cp .env.example .env               # completa DATABASE_URL y, opcionalmente, SEED_*
npm ci
npx prisma migrate deploy
SEED_TEST_BUILDING=true npx prisma db seed   # planes + admin (si SEED_ADMIN_*) + edificio de prueba
npm run start:dev                  # http://localhost:3000  · Swagger: /api/docs · salud: /health

# 3. Frontend
cd ../frontend
cp .env.example .env               # VITE_API_BASE_URL=http://localhost:3000
bun install
bun run dev                        # http://localhost:8080
```

`CORS_ORIGINS` del backend debe incluir el origen exacto del frontend (`http://localhost:8080`; `127.0.0.1` es otro origen).

## Pruebas

```bash
cd backend && npm run lint && npm run typecheck && npx jest --runInBand   # requiere BD veyro_test (TEST_DATABASE_URL)
cd frontend && bun run lint && bunx tsc --noEmit && bun run test && bun run build
```

CI: `.github/workflows/ci.yml` (PostGIS como servicio).

## Documentación

- `docs/INTEGRATION.md` — contrato frontend↔backend, WebSocket, errores, modo demo.
- `docs/OPERATIONS.md` — variables de entorno, despliegue, respaldos/restauración, seguridad, pendientes.
- `docs/NATIVE_AND_HARDWARE.md` — qué requiere app nativa, sensores o mapas interiores.
- `docs/openapi.json` — regenerar con `cd backend && npm run openapi`.
