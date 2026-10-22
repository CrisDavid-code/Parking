// Solo se carga cuando VITE_ENABLE_DEMO_MODE=true. Todos los datos son ficticios.
import { ApiError } from "./client";
import type {
  AuthResponse, Building, Device, IndoorMap, NavigationSession, NavRoute, Notification, Paginated,
  ParkingSession, Plan, Share, Subscription, User, Vehicle,
} from "@/types/api";

const now = () => new Date().toISOString();
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const user: User = {
  id: "u-demo", email: "demo@ejemplo.com", fullName: "Usuario Demo",
  roles: ["USER", "ORG_ADMIN", "PLATFORM_ADMIN"], accountType: "business", organizationId: "org-demo",
};
const vehicles: Vehicle[] = [
  { id: "v1", alias: "Sedán gris", make: "Toyota", model: "Corolla", year: 2021, color: "Gris", plate: "P-123ABC",
    isPrimary: true, trackingStatus: "live", ownerId: user.id, createdAt: ago(9e9), updatedAt: ago(1e6) },
  { id: "v2", alias: "Camioneta", make: "Mazda", model: "CX-5", year: 2019, color: "Azul", plate: "P-987XYZ",
    isPrimary: false, trackingStatus: "stale", ownerId: user.id, createdAt: ago(8e9), updatedAt: ago(5e6) },
];
const parking: ParkingSession[] = [
  { id: "p1", vehicleId: "v1", status: "active", latitude: 14.5995, longitude: -90.5157, accuracyMeters: 12,
    address: "Centro comercial (ficticio)", buildingId: "b1", levelId: "lB2", levelLabel: "B2", zone: "Azul", row: "C",
    spot: "148", entrance: "Norte", referencePoint: "Ascensor A", referenceType: "elevator", ticketNumber: "T-0042",
    notes: "Cerca de la columna C-12", source: "manual", media: [], startedAt: ago(36e5), createdAt: ago(36e5) },
  { id: "p2", vehicleId: "v1", status: "ended", latitude: 14.61, longitude: -90.52, accuracyMeters: 25,
    address: "Oficina (ficticio)", levelLabel: "PB", row: "A", spot: "12", source: "gps", media: [],
    startedAt: ago(9e7), endedAt: ago(8.9e7), createdAt: ago(9e7) },
];
const devices: Device[] = [
  { id: "d1", name: "Rastreador OBD", type: "obd", serial: "SN-0001", vehicleId: "v1", status: "active",
    lastSeenAt: ago(3e4), batteryPercent: 88, signal: 4 },
];
const shares: Share[] = [
  { id: "s1", vehicleId: "v1", granteeEmail: "familia@ejemplo.com", permissions: ["view_parking"], status: "active" },
];
const notifications: Notification[] = [
  { id: "n1", title: "Vehículo estacionado", body: "Se guardó el estacionamiento en B2 fila C.", type: "parking", createdAt: ago(36e5) },
  { id: "n2", title: "Dispositivo conectado", body: "Rastreador OBD en línea.", type: "device", createdAt: ago(7e6), readAt: ago(6e6) },
];
const plans: Plan[] = [
  { code: "free", name: "Gratis", priceMonthly: 0, currency: "GTQ", limits: { vehicles: 1, devices: 0, historyDays: 7, members: 1 } },
  { code: "plus", name: "Plus", priceMonthly: 39, currency: "GTQ", limits: { vehicles: 3, devices: 1, historyDays: 30, members: 3 } },
  { code: "tracking", name: "Rastreo", priceMonthly: 79, currency: "GTQ", limits: { vehicles: 5, devices: 5, historyDays: 90, members: 5 } },
  { code: "business", name: "Empresa", priceMonthly: 299, currency: "GTQ", limits: { vehicles: 50, devices: 50, historyDays: 365, members: 25 } },
];
const subscription: Subscription = { planCode: "plus", status: "active", currentPeriodEnd: ago(-2e9), paymentsConfigured: false };
const buildings: Building[] = [{ id: "b1", name: "Centro comercial (ficticio)", address: "Zona 10", latitude: 14.5995, longitude: -90.5157 }];

const lv = [
  { id: "l3", code: "3", name: "Nivel 3", ordinal: 3 }, { id: "l2", code: "2", name: "Nivel 2", ordinal: 2 },
  { id: "l1", code: "1", name: "Nivel 1", ordinal: 1 }, { id: "lPB", code: "PB", name: "Planta baja", ordinal: 0 },
  { id: "lB1", code: "B1", name: "Sótano 1", ordinal: -1 }, { id: "lB2", code: "B2", name: "Sótano 2", ordinal: -2 },
];
const indoor: IndoorMap = {
  building: buildings[0]!, levels: lv, version: 1,
  nodes: [
    ...lv.flatMap((l) => [
      { id: `${l.id}-elev`, levelId: l.id, x: 20, y: 50, type: "elevator" as const, label: "Ascensor A" },
      { id: `${l.id}-stairs`, levelId: l.id, x: 80, y: 15, type: "stairs" as const, label: "Escaleras" },
      { id: `${l.id}-hall`, levelId: l.id, x: 45, y: 50, type: "corridor" as const, label: "Pasillo central" },
    ]),
    { id: "lB2-rowC", levelId: "lB2", x: 65, y: 70, type: "landmark", label: "Fila C" },
    { id: "lB2-148", levelId: "lB2", x: 82, y: 80, type: "parking_spot", label: "Plaza 148" },
    { id: "l3-ent", levelId: "l3", x: 10, y: 85, type: "entrance", label: "Entrada tiendas" },
  ],
  edges: [
    { id: "e1", fromNodeId: "l3-ent", toNodeId: "l3-elev", distanceMeters: 30, type: "walk", accessible: true, status: "open" },
    { id: "e2", fromNodeId: "l3-elev", toNodeId: "lB2-elev", distanceMeters: 15, type: "elevator", accessible: true, status: "open" },
    { id: "e3", fromNodeId: "lB2-elev", toNodeId: "lB2-hall", distanceMeters: 25, type: "walk", accessible: true, status: "open" },
    { id: "e4", fromNodeId: "lB2-hall", toNodeId: "lB2-rowC", distanceMeters: 30, type: "walk", accessible: true, status: "open" },
    { id: "e5", fromNodeId: "lB2-rowC", toNodeId: "lB2-148", distanceMeters: 18, type: "walk", accessible: true, status: "open" },
  ],
};
const route: NavRoute = {
  totalDistanceMeters: 118,
  steps: [
    { order: 1, instruction: "Camina hacia el Ascensor A en el nivel 3", levelId: "l3", levelCode: "3", nodeId: "l3-elev", distanceMeters: 30, type: "walk" },
    { order: 2, instruction: "Toma el ascensor hasta el nivel B2", levelId: "lB2", levelCode: "B2", nodeId: "lB2-elev", distanceMeters: 15, type: "elevator" },
    { order: 3, instruction: "Sigue el pasillo central", levelId: "lB2", levelCode: "B2", nodeId: "lB2-hall", distanceMeters: 25, type: "walk" },
    { order: 4, instruction: "Gira a la derecha hacia la fila C", levelId: "lB2", levelCode: "B2", nodeId: "lB2-rowC", distanceMeters: 30, type: "walk" },
    { order: 5, instruction: "Tu vehículo está en la plaza 148", levelId: "lB2", levelCode: "B2", nodeId: "lB2-148", distanceMeters: 18, type: "arrive" },
  ],
  legs: [{ levelId: "l3", nodeIds: ["l3-ent", "l3-elev"] }, { levelId: "lB2", nodeIds: ["lB2-elev", "lB2-hall", "lB2-rowC", "lB2-148"] }],
};
const navSessions: NavigationSession[] = [];

function page<T>(items: T[], q?: Record<string, unknown>): Paginated<T> {
  const p = Number(q?.["page"] ?? 1), ps = Number(q?.["pageSize"] ?? 20);
  return { items: items.slice((p - 1) * ps, p * ps), total: items.length, page: p, pageSize: ps };
}
const auth = (): AuthResponse => ({ accessToken: "demo-access", refreshToken: "demo-refresh", user });

export async function demoRequest<T>(method: string, path: string, query?: Record<string, unknown>, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 250));
  const b = (body ?? {}) as Record<string, unknown>;
  const m = (re: RegExp) => path.match(re);
  const r = (x: unknown) => x as T;
  const k = `${method} ${path}`;
  if (k.startsWith("POST /auth/")) return r(path.includes("logout") || path.includes("password") ? {} : auth());
  if (k === "GET /users/me") return r(user);
  if (k === "PATCH /users/me") return r({ ...user, ...b });
  if (k === "GET /vehicles") return r(page(vehicles, query));
  let x;
  if ((x = m(/^\/vehicles\/([^/]+)$/)) && method === "GET") {
    const v = vehicles.find((v) => v.id === x![1]);
    if (!v) throw new ApiError(404, "Vehículo no encontrado");
    return r(v);
  }
  if (m(/^\/vehicles\/[^/]+\/members$/)) return r(page([{ id: "m1", userId: user.id, email: user.email, fullName: user.fullName, role: "owner" }]));
  if (k === "GET /parking-sessions/active") return r(parking.find((p) => p.status === "active" && (!query?.["vehicleId"] || p.vehicleId === query["vehicleId"])) ?? null);
  if (k === "GET /parking-sessions") return r(page(parking.filter((p) => !query?.["status"] || p.status === query["status"]), query));
  if ((x = m(/^\/parking-sessions\/([^/]+)$/)) && method === "GET") {
    const p = parking.find((p) => p.id === x![1]);
    if (!p) throw new ApiError(404, "Sesión no encontrada");
    return r(p);
  }
  if (k === "POST /parking-sessions") return r({ ...parking[0], ...b, id: "p-new", status: "active", media: [], startedAt: now(), createdAt: now() });
  if ((x = m(/^\/tracking\/vehicles\/([^/]+)\/last$/))) {
    if (x[1] !== "v1") throw new ApiError(404, "Sin ubicación");
    return r({ vehicleId: "v1", latitude: 14.5995, longitude: -90.5157, accuracyMeters: 8, speedMetersPerSecond: 0, headingDegrees: 90,
      capturedAt: ago(2e4), receivedAt: ago(1.5e4), freshness: "live", source: "device" });
  }
  if (m(/^\/tracking\/vehicles\/[^/]+\/history$/))
    return r(Array.from({ length: 8 }, (_, i) => ({ vehicleId: "v1", latitude: 14.59 + i * 0.002, longitude: -90.53 + i * 0.002,
      accuracyMeters: 10, speedMetersPerSecond: 8, capturedAt: ago((8 - i) * 6e5), receivedAt: ago((8 - i) * 6e5), freshness: "stale", source: "device" })));
  if (k === "GET /devices") return r(page(devices, query));
  if (k === "POST /devices") return r({ ...b, id: "d-new", status: "pending", deviceToken: "demo-token-solo-ilustrativo" });
  if (k === "GET /shares") return r(page(shares, query));
  if ((x = m(/^\/shares\/invitations\/([^/]+)$/)))
    return r({ token: x[1], vehicle: vehicles[0], ownerName: "Usuario Demo", permissions: ["view_parking"], status: "pending" });
  if (k === "GET /notifications") return r(page(notifications, query));
  if (k === "GET /subscriptions/plans") return r(plans);
  if (k === "GET /subscriptions/me") return r(subscription);
  if (k.startsWith("POST /subscriptions")) throw new ApiError(503, "Pagos no configurados todavía");
  if (k === "GET /organizations") return r([{ id: "org-demo", name: "Empresa Demo S.A.", planCode: "business", createdAt: ago(9e9) }]);
  if ((x = m(/^\/organizations\/[^/]+\/(\w+)/))) {
    const sub = x[1];
    if (sub === "reports") return r({ totals: { vehicles: 12, activeVehicles: 9, drivers: 8, devices: 10, alerts: 3 },
      series: Array.from({ length: 7 }, (_, i) => ({ date: ago((6 - i) * 864e5).slice(0, 10), distanceKm: 120 + i * 17, parkingSessions: 20 + i * 2, alerts: i % 3 })) });
    const map: Record<string, unknown[]> = {
      members: [{ id: "om1", userId: user.id, email: user.email, fullName: user.fullName, role: "ORG_ADMIN" }],
      drivers: [{ id: "dr1", fullName: "Conductor Uno", email: "c1@ejemplo.com", phone: "5555-0001", licenseNumber: "L-1", status: "active" }],
      assignments: [{ id: "a1", vehicleId: "v1", driverId: "dr1", vehicleAlias: "Sedán gris", driverName: "Conductor Uno", startsAt: ago(864e5), status: "active" }],
      geofences: [{ id: "g1", name: "Bodega central", type: "circle", centerLat: 14.6, centerLng: -90.51, radiusMeters: 400, active: true }],
      alerts: [{ id: "al1", type: "geofence_exit", message: "Sedán gris salió de Bodega central", vehicleId: "v1", severity: "warning", createdAt: ago(5e6) }],
      vehicles,
    };
    return r(page(map[sub ?? ""] ?? [], query));
  }
  if (k === "GET /buildings") return r(page(buildings, query));
  if (m(/^\/buildings\/[^/]+\/levels$/)) return r(lv);
  if (m(/^\/indoor-maps\/b1$/)) return r(indoor);
  if (m(/^\/indoor-maps\//)) throw new ApiError(404, "Mapa interior no disponible");
  if (k === "POST /navigation/route") return r(route);
  if (k === "POST /navigation/sessions") {
    const s: NavigationSession = { id: `ns-${navSessions.length + 1}`, parkingSessionId: String(b["parkingSessionId"]), mode: (b["mode"] as NavigationSession["mode"]) ?? "basic",
      status: "active", currentLevelId: null, positionConfirmed: false, createdAt: now() };
    navSessions.push(s);
    return r(s);
  }
  if ((x = m(/^\/navigation\/sessions\/([^/]+)/))) {
    const s = navSessions.find((s) => s.id === x![1]) ?? { id: x[1], parkingSessionId: "p1", mode: "basic", status: "active", positionConfirmed: false, createdAt: now() };
    if (path.endsWith("confirm-landmark")) return r({ ...s, confirmedNodeId: b["nodeId"], positionConfirmed: true });
    return r(s);
  }
  if (k === "GET /admin/health") return r({ services: [{ name: "API", status: "up", latencyMs: 42 }, { name: "WebSocket", status: "degraded", latencyMs: 180 }], checkedAt: now() });
  if (k === "GET /admin/usage") return r({ activeUsers: 1234, vehicles: 2100, parkingSessions30d: 18000, devicesActive: 320,
    series: Array.from({ length: 7 }, (_, i) => ({ date: ago((6 - i) * 864e5).slice(0, 10), users: 900 + i * 40, sessions: 500 + i * 30 })) });
  if (k === "GET /admin/plans") return r(page(plans, query));
  if (k === "GET /admin/users") return r(page([user], query));
  if (k === "GET /admin/organizations") return r(page([{ id: "org-demo", name: "Empresa Demo S.A.", planCode: "business", createdAt: ago(9e9) }], query));
  if (k === "GET /admin/audit") return r(page([{ id: "au1", actorEmail: user.email, action: "vehicle.create", target: "v1", createdAt: ago(1e7) }], query));
  if (k === "GET /admin/support") return r(page([{ id: "t1", subject: "Duda de cobro", message: "…", status: "open", userEmail: user.email, createdAt: ago(1e7) }], query));
  if (method === "GET") return r(page([], query));
  return r({ ...b, id: "demo-id" });
}
