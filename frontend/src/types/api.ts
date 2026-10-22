// Contratos de la API REST externa (/api/v1). Mantener sincronizado con docs/FRONTEND_CONTRACTS.md
export type Role = "USER" | "ORG_ADMIN" | "ORG_MEMBER" | "DRIVER" | "PLATFORM_ADMIN";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  accountType: "personal" | "business";
  organizationId?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type TrackingStatus = "none" | "live" | "stale" | "offline";
export interface Vehicle {
  id: string;
  alias: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plate?: string | null;
  photoUrl?: string | null;
  isPrimary: boolean;
  trackingStatus: TrackingStatus;
  ownerId: string;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface VehicleMember {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  role: string;
}

export type ReferenceType = "elevator" | "stairs" | "ramp" | "other";
export interface Media {
  id: string;
  url: string;
  kind: string;
}
export interface ParkingSession {
  id: string;
  vehicleId: string;
  status: "active" | "ended";
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  address?: string | null;
  buildingId?: string | null;
  levelId?: string | null;
  levelLabel?: string | null;
  zone?: string | null;
  row?: string | null;
  spot?: string | null;
  entrance?: string | null;
  referencePoint?: string | null;
  referenceType?: ReferenceType | null;
  ticketNumber?: string | null;
  notes?: string | null;
  source: "gps" | "manual" | "device";
  media: Media[];
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
}

export type Freshness = "live" | "recent" | "stale";
export interface LastLocation {
  vehicleId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMetersPerSecond?: number | null;
  headingDegrees?: number | null;
  capturedAt: string;
  receivedAt: string;
  freshness: Freshness;
  source: string;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  serial: string;
  vehicleId?: string | null;
  status: "pending" | "active" | "revoked";
  lastSeenAt?: string | null;
  batteryPercent?: number | null;
  signal?: number | null;
}
export interface DeviceCreated extends Device {
  deviceToken: string;
}

export type SharePermission = "view_parking" | "view_location" | "alerts" | "manage";
export interface Share {
  id: string;
  vehicleId: string;
  granteeEmail: string;
  permissions: SharePermission[];
  expiresAt?: string | null;
  status: string;
}
export interface ShareInvitation {
  token: string;
  vehicle: Pick<Vehicle, "id" | "alias" | "make" | "model">;
  ownerName: string;
  permissions: SharePermission[];
  expiresAt?: string | null;
  status: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
}

export type PlanCode = "free" | "plus" | "tracking" | "business";
export interface Plan {
  code: PlanCode;
  name: string;
  priceMonthly: number;
  currency: string;
  limits: { vehicles: number; devices: number; historyDays: number; members: number };
}
export interface Subscription {
  planCode: PlanCode;
  status: "active" | "canceled" | "past_due" | "trialing";
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  paymentsConfigured: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  planCode?: PlanCode;
  createdAt: string;
}
export interface OrgMember {
  id: string;
  userId: string;
  email: string;
  fullName?: string;
  role: Role;
}
export interface Driver {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  licenseNumber?: string | null;
  status: "active" | "inactive";
}
export interface Assignment {
  id: string;
  vehicleId: string;
  driverId: string;
  vehicleAlias?: string;
  driverName?: string;
  startsAt: string;
  endsAt?: string | null;
  status: "scheduled" | "active" | "ended";
}
export interface Geofence {
  id: string;
  name: string;
  type: "circle";
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  active: boolean;
}
export interface OrgAlert {
  id: string;
  type: string;
  message: string;
  vehicleId?: string | null;
  severity: "info" | "warning" | "critical";
  createdAt: string;
  acknowledged?: boolean;
}
export interface ReportSummary {
  totals: { vehicles: number; activeVehicles: number; drivers: number; devices: number; alerts: number };
  series: { date: string; distanceKm: number; parkingSessions: number; alerts: number }[];
}

export interface Building {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
export interface Level {
  id: string;
  code: string;
  name: string;
  ordinal: number;
}
export type NodeType =
  | "corridor"
  | "elevator"
  | "stairs"
  | "ramp"
  | "entrance"
  | "exit"
  | "parking_spot"
  | "landmark";
export interface IndoorNode {
  id: string;
  levelId: string;
  x: number;
  y: number;
  type: NodeType;
  label: string;
}
export interface IndoorEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  type: string;
  accessible: boolean;
  status: "open" | "closed";
}
export interface IndoorMap {
  building: Building;
  levels: Level[];
  nodes: IndoorNode[];
  edges: IndoorEdge[];
  version: number;
}
export interface RouteStep {
  order: number;
  instruction: string;
  levelId: string;
  levelCode: string;
  nodeId: string;
  distanceMeters: number;
  type: string;
}
export interface NavRoute {
  totalDistanceMeters: number;
  steps: RouteStep[];
  legs: { levelId: string; nodeIds: string[] }[];
}
export type NavMode = "basic" | "indoor" | "sensor";
export interface NavigationSession {
  id: string;
  parkingSessionId: string;
  mode: NavMode;
  status: "active" | "ended";
  currentLevelId?: string | null;
  confirmedNodeId?: string | null;
  positionConfirmed: boolean;
  createdAt: string;
}
export interface SensorEstimate {
  steps: number;
  estimatedDistanceMeters: number;
  headingDegrees: number;
  turnEstimate: string;
  floorEstimate: number | null;
  confidence: number;
  capturedAt: string;
  source: string;
}

export interface AdminUsage {
  activeUsers: number;
  vehicles: number;
  parkingSessions30d: number;
  devicesActive: number;
  series: { date: string; users: number; sessions: number }[];
}
export interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  createdAt: string;
  ip?: string | null;
}
export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "pending" | "closed";
  userEmail?: string;
  createdAt: string;
}
export interface ServiceHealth {
  services: { name: string; status: "up" | "degraded" | "down"; latencyMs?: number | null }[];
  checkedAt: string;
}

/** Variante de entrada: todas las claves opcionales aceptan `undefined` (exactOptionalPropertyTypes). */
export type Loose<T> = { [K in keyof T]?: T[K] | undefined };
