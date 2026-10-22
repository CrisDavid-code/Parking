# Operación, despliegue y seguridad

## Variables de entorno

- Backend: `backend/.env.example` (comentado). Obligatorias en producción: `DATABASE_URL`, `JWT_SECRET` (≥32 caracteres; el arranque falla si no), `CORS_ORIGINS`, `APP_URL`.
- Frontend: `frontend/.env.example`. Solo valores públicos (`VITE_*` terminan en el navegador). **Nunca** pongas secretos en `VITE_*`.

## Despliegue (referencia)

1. PostgreSQL 16 + PostGIS 3.4 gestionado (o `postgis/postgis:16-3.4`), con backups automáticos y TLS.
2. API: imagen `backend/Dockerfile` (ejecuta `prisma migrate deploy` al iniciar, healthcheck en `/health/live`). Detrás de un proxy TLS que soporte WebSocket. **Una sola réplica** mientras el gateway de tracking no use Redis.
3. Frontend: `bun run build` (preset nitro/cloudflare de Lovable) o servirlo como estático/SSR en la plataforma elegida; `VITE_API_BASE_URL` y `VITE_WS_URL` apuntando a la API (`https`/`wss`).
4. Seed en producción: solo planes (`npx prisma db seed` sin `SEED_TEST_BUILDING`); crear el admin con `SEED_ADMIN_EMAIL/PASSWORD` una vez y luego quitar esas variables.
5. `RETENTION_JOB_ENABLED=true` en una sola instancia (borra ubicaciones/estimaciones antiguas según plan).

> El `Dockerfile` se escribió pero **no se pudo construir** en el entorno de desarrollo (límite de descargas de Docker Hub). Sí se verificó con la imagen PostGIS de `docker-compose.yml`: migraciones, seed, ausencia de drift y backup/restore.

## Respaldos y restauración

```bash
# Respaldo (formato custom, comprimido)
pg_dump "$DATABASE_URL" -Fc -f veyro-$(date +%F).dump
# con docker compose:
docker compose exec -T db pg_dump -U veyro -d veyro -Fc > veyro.dump

# Restauración en una BD nueva con PostGIS disponible
createdb veyro_restore
pg_restore -d veyro_restore --no-owner veyro.dump
```

Verificado: dump → restore en BD nueva con conteos idénticos (planes, nodos, aristas, migraciones) y PostGIS activo. Recomendado: respaldo diario + WAL/PITR del proveedor, retención 30 días, prueba de restauración mensual. Las fotos en S3 requieren versionado del bucket aparte.

## Seguridad implementada

- argon2 para contraseñas; bloqueo tras 5 intentos fallidos/15 min; throttling global (`RATE_LIMIT_PER_MINUTE`).
- JWT corto + refresh rotatorio con hash y detección de reutilización.
- Tokens de dispositivo hasheados (sha256), mostrados una vez; revocables.
- Autorización en cada request (`AccessService`): propiedad, permisos compartidos y roles de organización; 404 para recursos ajenos.
- `ValidationPipe` con whitelist (descarta campos no declarados, p. ej. `role`, `ownerId`).
- helmet, CORS restrictivo, logs pino con redacción de `authorization`/contraseñas/tokens.
- Webhook de pagos con HMAC-SHA256 (`x-signature`) e idempotencia.
- Subidas: S3 privado, URLs firmadas, verificación de tipo por bytes mágicos.
- Auditoría (`audit_events`) de acciones sensibles; exportación y borrado de cuenta (requiere contraseña).

## Pendiente para producción

| Área | Pendiente |
|---|---|
| Pagos | Integrar proveedor real (Recurrente/Stripe/etc.); hoy los planes de pago responden 503. Precios en GTQ son provisionales |
| Correo/push | `sendEmail` no envía (responde `delivered:false`): la recuperación de contraseña no llega por correo y las invitaciones devuelven `inviteUrl` para compartir a mano; push no implementado |
| Almacenamiento | Configurar bucket S3 privado (`S3_*`) |
| Escalado | Redis para WebSocket multi-instancia y jobs (hoy en proceso) |
| Sesión web | Refresh token en cookie `HttpOnly` en lugar de `localStorage` |
| Legal | Términos, privacidad y consentimiento de rastreo revisados por abogado (Guatemala) ; correo de soporte real |
| Observabilidad | Agregación de logs, métricas, alertas, Sentry |
| Mapas | Mapas interiores reales levantados en sitio; hoy solo hay un edificio de prueba |
| App nativa | Sensores, AR, BLE, segundo plano (ver `NATIVE_AND_HARDWARE.md`) |
| Pruebas | Carga, pentest, E2E en CI con navegador, prueba del Dockerfile |
