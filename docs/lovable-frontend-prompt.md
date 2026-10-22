# Veyro — Frontend completo (entrega integral única)

Actúa como equipo senior de producto, UX/UI y arquitectura frontend. Construye la APLICACIÓN COMPLETA (no prototipo, no landing aislada) en UNA sola entrega: todas las rutas, componentes, formularios, tablas, estados y flujos descritos.

## Restricciones críticas
- **NO uses Lovable Cloud / Supabase ni ningún backend de Lovable.** El backend real es una API REST NestJS externa en `VITE_API_BASE_URL` + `/api/v1`. Todo acceso a datos pasa por un cliente HTTP centralizado (`src/lib/api/client.ts`) con servicios por módulo.
- SPA con **React + TypeScript estricto + Vite + Tailwind + shadcn/ui + React Router + TanStack Query + React Hook Form + Zod + Recharts**. Si el scaffold usa otro router (p.ej. TanStack Router), úsalo pero mantén exactamente las URLs indicadas.
- Nunca muestres coordenadas ficticias como reales. Modo demo controlado por `VITE_ENABLE_DEMO_MODE` (false por defecto); cuando está activo, mostrar banner "Modo demostración — datos ficticios" en todas las pantallas. Con demo desactivado y sin API, mostrar estados de error/vacío reales, no datos inventados.
- No anunciar integraciones inexistentes. No simular pagos exitosos, cámara AR ni sensores.
- Español inicial con i18n preparado (diccionario `es` / `en`). Moneda (GTQ por defecto), zona horaria (America/Guatemala) y formato de fecha configurables.

## Marca centralizada
`src/config/brand.ts`: `name: "Veyro"`, `tagline`, `logo` (componente SVG), colores. Ningún otro archivo debe hardcodear el nombre. Paleta: azul noche #101828, azul #2563EB, turquesa #14B8A6, fondo #F8FAFC. Estética premium, tecnológica, confiable; sombras discretas, microinteracciones. Móvil: navegación inferior en /app. Escritorio: sidebar.

## Variables de entorno (`.env.example`)
VITE_API_BASE_URL=http://localhost:3000
VITE_MAP_PROVIDER=leaflet        # leaflet|none ; abstraer proveedor
VITE_MAP_API_KEY=                # solo clave pública restringida, opcional
VITE_ENABLE_DEMO_MODE=false
VITE_WS_URL=ws://localhost:3000

## Rutas
Públicas: `/`, `/features`, `/pricing`, `/security`, `/help`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/invite/:token`.
Usuario: `/app`, `/app/map`, `/app/parking`, `/app/parking/new`, `/app/parking/:id`, `/app/vehicles`, `/app/vehicles/new`, `/app/vehicles/:id`, `/app/tracking`, `/app/devices`, `/app/history`, `/app/sharing`, `/app/notifications`, `/app/subscription`, `/app/billing`, `/app/settings`, `/app/privacy`, `/app/support`, `/app/navigation`, `/app/navigation/:sessionId`, `/app/onboarding`.
Empresa: `/business`, `/business/fleet`, `/business/vehicles`, `/business/drivers`, `/business/assignments`, `/business/devices`, `/business/geofences`, `/business/alerts`, `/business/reports`, `/business/members`, `/business/settings`.
Admin: `/admin`, `/admin/users`, `/admin/organizations`, `/admin/plans`, `/admin/usage`, `/admin/audit`, `/admin/support`, `/admin/indoor-maps`, `/admin/buildings`.
Guards visuales por rol (`USER`, `ORG_ADMIN`, `ORG_MEMBER`, `DRIVER`, `PLATFORM_ADMIN`) con pantalla de acceso denegado. Página 404.

## Autenticación (contrato)
- `POST /api/v1/auth/register` {email,password,fullName,accountType:'personal'|'business'} → `{accessToken, refreshToken, user}`
- `POST /api/v1/auth/login` {email,password} → igual
- `POST /api/v1/auth/refresh` {refreshToken} → igual
- `POST /api/v1/auth/logout` {refreshToken}
- `POST /api/v1/auth/forgot-password` {email}; `POST /api/v1/auth/reset-password` {token,password}
- `GET /api/v1/users/me` → User
Access token en memoria + refresh token en localStorage; interceptor que renueva ante 401 y redirige a /login si falla (estado "sesión expirada").

## Contratos API (`/api/v1`) — tipos en `src/types/api.ts`
Paginación: `?page=&pageSize=` → `{ items: T[], total, page, pageSize }`. Errores: `{ statusCode, message, error }`.
- `/vehicles` CRUD; `/vehicles/:id/members` (GET/POST/DELETE); `/vehicles/:id/primary` (POST).
  Vehicle `{id,alias,make,model,year,color,plate?,photoUrl?,isPrimary,trackingStatus:'none'|'live'|'stale'|'offline',ownerId,organizationId?,createdAt,updatedAt}`
- `/parking-sessions` CRUD + `POST /parking-sessions/:id/end`; `GET /parking-sessions/active?vehicleId=`; `POST /parking-sessions/:id/media` (multipart).
  ParkingSession `{id,vehicleId,status:'active'|'ended',latitude?,longitude?,accuracyMeters?,address?,buildingId?,levelId?,levelLabel?,zone?,row?,spot?,entrance?,referencePoint?,referenceType?:'elevator'|'stairs'|'ramp'|'other',ticketNumber?,notes?,source:'gps'|'manual'|'device',media:[{id,url,kind}],startedAt,endedAt?,createdAt}`
- `/tracking/vehicles/:vehicleId/last` → LastLocation `{vehicleId,latitude,longitude,accuracyMeters,speedMetersPerSecond?,headingDegrees?,capturedAt,receivedAt,freshness:'live'|'recent'|'stale',source}`; `/tracking/vehicles/:vehicleId/history?from=&to=`; WebSocket namespace `/tracking` evento `location` (fallback polling 15 s).
- `/devices` CRUD; `POST /devices/:id/revoke`; Device `{id,name,type,serial,vehicleId?,status:'pending'|'active'|'revoked',lastSeenAt?,batteryPercent?,signal?}`. Al crear devuelve **una sola vez** `deviceToken` (mostrarlo con aviso de que no se volverá a ver).
- `/shares` GET/POST/DELETE; `POST /shares/invitations/:token/accept`; `GET /shares/invitations/:token`. Share `{id,vehicleId,granteeEmail,permissions:('view_parking'|'view_location'|'alerts'|'manage')[],expiresAt?,status}`.
- `/notifications` GET, `POST /notifications/:id/read`, `POST /notifications/read-all`.
- `/subscriptions/plans`, `/subscriptions/me`, `POST /subscriptions/change` {planCode}, `POST /subscriptions/cancel`. Plan `{code:'free'|'plus'|'tracking'|'business',name,priceMonthly,currency,limits:{vehicles,devices,historyDays,members}}`. Si el proveedor de pago no está configurado, mostrar "Pagos no configurados todavía".
- `/organizations` (GET mine, POST, PATCH), `/organizations/:orgId/members`, `/organizations/:orgId/drivers`, `/organizations/:orgId/assignments`, `/organizations/:orgId/geofences`, `/organizations/:orgId/alerts`, `/organizations/:orgId/vehicles`, `/organizations/:orgId/reports/summary`.
  Geofence `{id,name,type:'circle',centerLat,centerLng,radiusMeters,active}`.
- `/buildings` CRUD, `/buildings/:id/levels`, `/indoor-maps/:buildingId` → `{building, levels:[{id,code,name,ordinal}], nodes:[{id,levelId,x,y,type:'corridor'|'elevator'|'stairs'|'ramp'|'entrance'|'exit'|'parking_spot'|'landmark',label}], edges:[{id,fromNodeId,toNodeId,distanceMeters,type,accessible,status:'open'|'closed'}], version}`.
- `/navigation/route` POST `{buildingId, fromNodeId, toNodeId, accessibleOnly?}` → `{totalDistanceMeters, steps:[{order,instruction,levelId,levelCode,nodeId,distanceMeters,type}], legs:[{levelId, nodeIds[]}]}` (404 si no hay mapa, 422 si no hay ruta).
- `/navigation/sessions` POST `{parkingSessionId, mode:'basic'|'indoor'|'sensor'}`, GET `/navigation/sessions/:id`, POST `/navigation/sessions/:id/position` (estimación), POST `/navigation/sessions/:id/confirm-landmark` {nodeId}, POST `/navigation/sessions/:id/end`.
- `/sensors` tipo SensorEstimate `{steps,estimatedDistanceMeters,headingDegrees,turnEstimate,floorEstimate,confidence,capturedAt,source}` — interfaz `SensorProvider` con implementación `UnsupportedSensorProvider` (navegador web) que reporta "no disponible"; preparada para capa nativa.
- `/admin/users`, `/admin/organizations`, `/admin/plans`, `/admin/usage`, `/admin/audit`, `/admin/health`.

## Módulos (carpetas `src/modules/*`)
auth, dashboard, vehicles, parking, maps, indoor-navigation, sensors, tracking, devices, sharing, subscriptions, fleet, reports, notifications, admin, settings. Cada uno con `api.ts` (servicios TanStack Query), componentes y páginas.

## Pantallas clave
- **Landing**: beneficio principal (guardar estacionamiento, encontrar vehículo, navegar por niveles, gestionar vehículos). Features, pricing desde API/config, seguridad, ayuda.
- **Onboarding** (`/app/onboarding`): cuenta → personal/empresa → primer vehículo → preferencias de ubicación → explicación de permisos (solicitar geolocalización solo al usarla) → primer estacionamiento → dispositivo (opcional) → intro navegación. Pasos opcionales omitibles.
- **Dashboard**: vehículo seleccionado, estado, último estacionamiento (nivel/fila/plaza, fecha, precisión), botones "Encontrar mi vehículo" y "Guardar estacionamiento", última ubicación con frescura, alertas, historial reciente, dispositivos, estado del plan. Estados vacío/error.
- **Vehículos**: lista, crear/editar/eliminar (RHF+Zod), foto, principal, miembros, dispositivos, historial, tracking.
- **Estacionamiento nuevo**: botón "Usar mi ubicación" (Geolocation API, muestra precisión ±m), alternativa manual completa: edificio, nivel (PB, B1, B2, B3, otro), zona, fila, plaza, entrada, referencia (ascensor/escalera/rampa), boleto, notas, fotos. Detalle, edición, finalizar, historial.
- **Mapa**: Leaflet + OpenStreetMap detrás de una interfaz `MapProvider`; fallback "Mapa no disponible" con datos en lista. Marcadores con etiqueta de frescura (en vivo / reciente / desactualizada / guardada). Abrir en Google Maps/Waze (navegación externa). Distancia solo si hay ubicación del usuario y del vehículo reales.
- **Navegación** (`/app/navigation/:sessionId`): selector de modo A/B/C.
  - A Básica: foto, nivel/fila/plaza, selector manual de nivel actual, instrucciones textuales, referencias, aviso "posición interior exacta no disponible".
  - B Interior: plano por niveles en SVG desde `/indoor-maps`, nivel actual vs destino, ruta resaltada desde `/navigation/route`, pasos, recalcular, selector de punto conocido de origen.
  - C Sensores/AR: panel con pasos, distancia estimada, rumbo, confianza; si `SensorProvider` no disponible → mensaje "Requiere la app móvil nativa" y vuelta a modo A/B. Vista AR solo como placeholder etiquetado "AR disponible próximamente en app nativa (ARKit/ARCore)"; no simular cámara.
  - **Vista isométrica 3D** (CSS 3D transforms o SVG) con pisos apilados, nivel actual y del vehículo resaltados, conexiones verticales, ruta. Si no hay geometría real, etiqueta "Visualización ilustrativa".
  - Recuperación: "Posición no confirmada" → preguntar nivel, elegir punto conocido, recalcular, volver a foto.
  - Ejemplo ilustrativo (solo demo): vehículo B2 fila C plaza 148; usuario nivel 3; ascensor → B2 → fila C → plaza 148.
- **Tracking**: ubicación en vivo/última conocida con badge de frescura (live <60 s, recent <15 min, stale), precisión, velocidad, historial (tabla + polyline), alertas.
- **Dispositivos, Compartir, Notificaciones, Suscripción, Facturación, Ajustes, Privacidad (exportar/eliminar datos), Soporte.**
- **Empresa**: dashboard con KPIs y gráficos Recharts, mapa de flota, tablas paginadas con filtros (vehículos, conductores, asignaciones, dispositivos), geocercas (círculos en mapa), alertas, reportes, miembros/roles, ajustes.
- **Admin**: usuarios, organizaciones, planes, uso, auditoría, soporte, edificios, mapas interiores (editor simple de nodos/aristas por nivel en tabla + vista previa SVG), estado de servicios.

## Estados obligatorios en cada módulo
Cargando (skeletons), sin resultados, error, sin conexión (navigator.onLine), permiso denegado (403), sesión expirada, éxito/fallo (toasts), datos desactualizados, posición desconocida, mapa no disponible, nivel sin confirmar, AR no disponible, suscripción insuficiente (402/plan limit). Componentes reutilizables `<StateView kind=... />`. Sin botones decorativos ni rutas vacías.

## Calidad
Accesibilidad básica (labels, foco visible, contraste, aria). `npm run build` y `tsc` sin errores. Añade `docs/FRONTEND_CONTRACTS.md` resumiendo rutas, módulos, env y endpoints consumidos.
