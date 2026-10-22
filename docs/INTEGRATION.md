# Integración frontend ↔ backend

## Contrato

- Base REST: `${VITE_API_BASE_URL}/api/v1`. Contrato vigente: `docs/openapi.json` / Swagger `/api/docs`.
- Tipos del frontend: `frontend/src/types/api.ts` (alineados con las respuestas del backend).
- Listas paginadas: `{ items, total, page, pageSize }`, query `page`, `pageSize` (≤200), `q`.
- Errores: `{ statusCode, message, error? }`. Códigos relevantes:

| Código | Significado |
|---|---|
| 400 | Validación (campos desconocidos se descartan, no fallan) |
| 401 | Token ausente/expirado → el cliente refresca una vez (single-flight) |
| 402 | Límite del plan alcanzado |
| 404 | No existe **o** no tienes acceso (no se revela existencia) |
| 409 | Conflicto (versión de mapa, posición desconocida, plaza activa duplicada) |
| 503 | `payments_not_configured`, `storage_not_configured` |

## Autenticación

- `POST /auth/login|register` → `{ accessToken (15 min), refreshToken, user }`.
- El access token vive solo en memoria; el refresh token en `localStorage` (riesgo XSS aceptado para MVP; migrar a cookie `HttpOnly` + `SameSite` en producción).
- Refresh rotatorio: reutilizar un refresh token ya rotado fuera de la ventana de gracia de 30 s revoca toda la sesión.
- Roles/propiedad se verifican siempre en el backend; los roles que devuelve `/users/me` son solo para la UI.

## Tiempo real

WebSocket nativo: `ws(s)://<api>/tracking?vehicleId=<id>&token=<accessToken>`. Mensajes `{ event: "location", data: LastLocation }`. Cierre `4401` = no autorizado. Un solo proceso: con varias réplicas hace falta un bus (Redis pub/sub).

Dispositivos: `POST /api/v1/tracking/ingest` con `Authorization: Bearer vdt_…` (token mostrado una sola vez al crear el dispositivo). Idempotente por `(deviceId, capturedAt)`.

## Ubicaciones

`freshness`: `live` (<60 s), `recent` (<15 min), `stale`. La UI distingue ubicación guardada (estacionamiento), última conocida y en vivo; nunca inventa coordenadas.

## Navegación interior

- `POST /navigation/sessions` → sesión; `GET /navigation/sessions/:id/route` calcula la ruta solo por aristas existentes y abiertas (conectores verticales explícitos, `accessibleOnly`, zonas restringidas, sentido único).
- Sin posición confirmada responde 409 `position_unknown`; el usuario elige nivel/punto de referencia (`confirm-landmark`).
- Modo C (sensores/AR): el backend acepta estimaciones (`/sensors`), pero el navegador **no** las produce; la UI lo indica (ver `NATIVE_AND_HARDWARE.md`).

## Modo demo

`VITE_ENABLE_DEMO_MODE=true` usa datos locales en `frontend/src/lib/api/demo.ts`, visible con una etiqueta "Demo". Apagado por defecto; nunca usarlo en producción.

## Diferencias respecto al proyecto Lovable

El código de `frontend/` incluye correcciones locales (refresh single-flight, contrato de invitaciones, borrado de cuenta con contraseña, plano isométrico, imágenes SVG) que **no** se han enviado de vuelta al proyecto Lovable. Si se sigue editando en Lovable, sincronizar vía GitHub primero.
