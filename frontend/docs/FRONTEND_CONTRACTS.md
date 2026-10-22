# Contratos del frontend

SPA sobre TanStack Start/Router (URLs idénticas a la especificación). Sin backend propio: todo pasa por `src/lib/api/client.ts` contra `VITE_API_BASE_URL + /api/v1`.

## Variables de entorno
| Variable | Uso |
|---|---|
| `VITE_API_BASE_URL` | Base de la API NestJS (se añade `/api/v1`) |
| `VITE_MAP_PROVIDER` | `leaflet` (OpenStreetMap) o `none` (vista de lista) |
| `VITE_MAP_API_KEY` | Clave pública opcional para futuros proveedores |
| `VITE_ENABLE_DEMO_MODE` | `true` usa `src/lib/api/demo.ts` y muestra el banner "Modo demostración — datos ficticios" |
| `VITE_WS_URL` | WebSocket `/tracking` (evento `location`), fallback a polling 15 s |

## Autenticación
Access token en memoria, refresh token en `localStorage` (`app.refreshToken`). Ante 401 se llama `POST /auth/refresh` una vez; si falla se limpia la sesión y se muestra "Sesión expirada".

## Rutas
- Públicas: `/`, `/features`, `/pricing`, `/security`, `/help`, `/login`, `/register`, `/forgot-password`, `/reset-password?token=`, `/invite/:token`
- Usuario (`/app`, cualquier rol autenticado): `/app`, `/map`, `/parking`, `/parking/new`, `/parking/:id`, `/vehicles`, `/vehicles/new`, `/vehicles/:id`, `/tracking`, `/devices`, `/history`, `/sharing`, `/notifications`, `/subscription`, `/billing`, `/settings`, `/privacy`, `/support`, `/navigation`, `/navigation/:sessionId`, `/onboarding`
- Empresa (`/business`, `ORG_ADMIN`/`ORG_MEMBER`/`PLATFORM_ADMIN`): index, fleet, vehicles, drivers, assignments, devices, geofences, alerts, reports, members, settings
- Admin (`/admin`, `PLATFORM_ADMIN`): index (uso + salud), users, organizations, plans, usage, audit, support, indoor-maps, buildings

## Módulos (`src/modules/*`)
auth, dashboard, vehicles, parking, maps, indoor-navigation, sensors, tracking, devices, sharing, subscriptions, fleet, reports, notifications, admin, settings. Cada uno expone hooks de TanStack Query en `api.ts`.

## Endpoints consumidos
- Auth: `POST /auth/{register,login,refresh,logout,forgot-password,reset-password}`, `GET/PATCH/DELETE /users/me`, `GET /users/me/export`*
- Vehículos: `GET/POST /vehicles`, `GET/PATCH/DELETE /vehicles/:id`, `GET/POST /vehicles/:id/members`, `DELETE /vehicles/:id/members/:memberId`, `POST /vehicles/:id/primary`
- Estacionamiento: `GET/POST /parking-sessions`, `GET/PATCH/DELETE /parking-sessions/:id`, `POST /parking-sessions/:id/end`, `GET /parking-sessions/active?vehicleId=`, `POST /parking-sessions/:id/media` (multipart `files`)
- Rastreo: `GET /tracking/vehicles/:id/last`, `GET /tracking/vehicles/:id/history?from=&to=`, WS `/tracking`
- Dispositivos: `GET/POST /devices`, `PATCH/DELETE /devices/:id`, `POST /devices/:id/revoke` (el `deviceToken` se muestra una sola vez)
- Compartir: `GET/POST /shares`, `DELETE /shares/:id`, `GET /shares/invitations/:token`, `POST /shares/invitations/:token/accept`
- Notificaciones: `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`
- Suscripciones: `GET /subscriptions/plans`, `GET /subscriptions/me` (incluye `paymentsConfigured`*), `POST /subscriptions/change`, `POST /subscriptions/cancel`
- Organizaciones: `GET/POST /organizations`, `PATCH /organizations/:id`, `/organizations/:orgId/{members,drivers,assignments,geofences,alerts,vehicles}` (+ `PATCH/DELETE /:id`), `POST /alerts/:id/ack`*, `GET /reports/summary?from=&to=`
- Edificios y mapas: `GET/POST /buildings`, `PATCH/DELETE /buildings/:id`, `GET/POST /buildings/:id/levels`, `GET /indoor-maps/:buildingId`, `PUT /indoor-maps/:buildingId`*
- Navegación: `POST /navigation/route`, `POST /navigation/sessions`, `GET /navigation/sessions/:id`, `POST /navigation/sessions/:id/{position,confirm-landmark,end}`
- Soporte: `POST /support/tickets`*
- Admin: `GET /admin/{users,organizations,plans,usage,audit,support,health}`, `PATCH /admin/users/:id`*, `PATCH /admin/plans/:code`*, `PATCH /admin/support/:id`*

`*` = endpoint asumido por el frontend, no incluido explícitamente en la especificación original; confirmar con backend.

## Sensores
`SensorProvider` (`src/modules/sensors/provider.ts`); en web se usa `UnsupportedSensorProvider` → "Requiere la app móvil nativa". No se simulan sensores ni cámara AR.

## Estados
`<StateView kind=…/>`: loading, empty, not-found, error, offline, forbidden, expired, stale, unknown-position, map-unavailable, level-unconfirmed, ar-unavailable, plan-limit, payments-not-configured. Los errores HTTP se mapean con `kindFromError` (0→offline/error, 401→expired, 402→plan-limit, 403→forbidden, 404→not-found).
