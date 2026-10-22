import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Prisma, VehicleLastLocation } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AccessService } from '../../common/access.service';
import { AuthGuard } from '../../common/auth.guard';
import { freshness, haversineMeters } from '../../common/geo';
import { AuthUser, CurrentUser, Public } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { DevicesModule, DevicesService } from '../devices/devices.module';
import { GeofencesModule, GeofencesService } from '../geofences/geofences.module';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrackingGateway } from './tracking.gateway';

const MAX_FUTURE_SKEW_MS = 2 * 60_000;
const MAX_PAST_MS = 7 * 86_400_000;
const MOVED_WHILE_PARKED_METERS = 150;

export class IngestDto {
  @ApiProperty() @IsUUID() deviceId: string;
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiProperty() @IsLatitude() latitude: number;
  @ApiProperty() @IsLongitude() longitude: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100_000) accuracyMeters?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(150) speedMetersPerSecond?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(360) headingDegrees?: number;
  @ApiProperty() @Type(() => Date) @IsDate() capturedAt: Date;
  @ApiPropertyOptional({ enum: ['gps', 'network', 'fused'] }) @IsOptional() @IsIn(['gps', 'network', 'fused']) source?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) batteryPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) signal?: number;
}

class HistoryQuery {
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
  @ApiPropertyOptional({ default: 500 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5000) limit = 500;
}

export const presentLast = (l: VehicleLastLocation) => ({ ...l, freshness: freshness(l.capturedAt) });

@Injectable()
export class TrackingService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private devices: DevicesService,
    private geofences: GeofencesService,
    private notifications: NotificationsService,
    private subs: SubscriptionsService,
    private gateway: TrackingGateway,
  ) {}

  /** Device-authenticated ingest. The body's deviceId/vehicleId must match the credential's binding. */
  async ingest(authHeader: string | undefined, d: IngestDto) {
    const device = await this.devices.authenticate(authHeader);
    if (d.deviceId !== device.id) throw new ForbiddenException('deviceId does not match credentials');
    if (!device.vehicleId || d.vehicleId !== device.vehicleId) throw new ForbiddenException('Device is not bound to this vehicle');
    const now = Date.now();
    if (d.capturedAt.getTime() > now + MAX_FUTURE_SKEW_MS) throw new BadRequestException('capturedAt is in the future');
    if (d.capturedAt.getTime() < now - MAX_PAST_MS) throw new BadRequestException('capturedAt is too old');

    const fields = {
      latitude: d.latitude,
      longitude: d.longitude,
      accuracyMeters: d.accuracyMeters,
      speedMetersPerSecond: d.speedMetersPerSecond,
      headingDegrees: d.headingDegrees,
      source: d.source ?? 'gps',
      capturedAt: d.capturedAt,
    };
    try {
      await this.prisma.locationEvent.create({ data: { ...fields, vehicleId: device.vehicleId, deviceId: device.id } });
    } catch (e) {
      // Idempotency: same device + capturedAt is a retry of an already-stored point.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { accepted: true, duplicate: true };
      throw e;
    }
    const receivedAt = new Date();
    await this.prisma.trackingDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: receivedAt, status: 'active', batteryPercent: d.batteryPercent ?? undefined, signal: d.signal ?? undefined },
    });
    // Only move "last location" forward in time; late/out-of-order points go to history only.
    const prev = await this.prisma.vehicleLastLocation.findUnique({ where: { vehicleId: device.vehicleId } });
    let isLatest = false;
    if (!prev || prev.capturedAt < d.capturedAt) {
      isLatest = true;
      const last = await this.prisma.vehicleLastLocation.upsert({
        where: { vehicleId: device.vehicleId },
        create: { ...fields, vehicleId: device.vehicleId, deviceId: device.id, receivedAt },
        update: { ...fields, deviceId: device.id, receivedAt },
      });
      this.gateway.emitLocation(device.vehicleId, presentLast(last));
      await this.afterLatest(device.vehicleId, d);
    }
    return { accepted: true, duplicate: false, latest: isLatest };
  }

  private async afterLatest(vehicleId: string, d: IngestDto) {
    const v = await this.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    if (v.organizationId) await this.geofences.evaluate(vehicleId, v.organizationId, d.latitude, d.longitude, d.capturedAt);
    // Movement alert: vehicle reported away from its active parking spot (once per parking session).
    const parked = await this.prisma.parkingSession.findFirst({ where: { vehicleId, status: 'active', latitude: { not: null } } });
    if (!parked || parked.latitude === null || parked.longitude === null) return;
    const dist = haversineMeters(parked.latitude, parked.longitude, d.latitude, d.longitude);
    const tolerance = MOVED_WHILE_PARKED_METERS + (parked.accuracyMeters ?? 0) + (d.accuracyMeters ?? 0);
    if (dist <= tolerance) return;
    const already = await this.prisma.notification.count({ where: { type: 'vehicle.moved', data: { path: ['parkingSessionId'], equals: parked.id } } });
    if (already) return;
    const recipients = new Set<string>([v.ownerId]);
    const members = await this.prisma.vehicleMember.findMany({ where: { vehicleId, permissions: { has: 'alerts' } } });
    members.forEach((m) => recipients.add(m.userId));
    await Promise.all([...recipients].map((uid) => this.notifications.notify(uid, 'vehicle.moved', 'Movimiento detectado', `${v.alias} se reporta a ${Math.round(dist)} m del estacionamiento guardado.`, { vehicleId, parkingSessionId: parked.id, distanceMeters: Math.round(dist) })));
  }

  async last(userId: string, vehicleId: string) {
    await this.access.assertVehicle(userId, vehicleId, 'view_location');
    const l = await this.prisma.vehicleLastLocation.findUnique({ where: { vehicleId } });
    if (!l) throw new NotFoundException('No location reported for this vehicle');
    return presentLast(l);
  }

  async lastAll(userId: string, organizationId?: string) {
    if (organizationId) await this.access.assertOrgRole(userId, organizationId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const ids = await this.access.accessibleVehicleIds(userId, 'view_location');
    const rows = await this.prisma.vehicleLastLocation.findMany({ where: { vehicleId: { in: ids }, ...(organizationId ? { vehicle: { organizationId } } : {}) }, include: { vehicle: { select: { alias: true, plate: true } } } });
    return rows.map(presentLast);
  }

  /** History is clamped to the plan's retention window of the vehicle's billing owner. */
  async history(userId: string, vehicleId: string, q: HistoryQuery) {
    await this.access.assertVehicle(userId, vehicleId, 'view_location');
    const v = await this.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    const { historyDays } = await this.subs.limitsFor(v.organizationId ? { organizationId: v.organizationId } : { userId: v.ownerId });
    const minFrom = new Date(Date.now() - historyDays * 86_400_000);
    const from = q.from && q.from > minFrom ? q.from : minFrom;
    const items = await this.prisma.locationEvent.findMany({
      where: { vehicleId, capturedAt: { gte: from, ...(q.to ? { lte: q.to } : {}) } },
      orderBy: { capturedAt: 'desc' },
      take: q.limit,
      select: { id: true, latitude: true, longitude: true, accuracyMeters: true, speedMetersPerSecond: true, headingDegrees: true, source: true, capturedAt: true, receivedAt: true, deviceId: true },
    });
    return { vehicleId, from, to: q.to ?? null, historyDays, items };
  }
}

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private svc: TrackingService) {}

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiHeader({ name: 'Authorization', description: 'Device vdt_<prefix>_<secret>' })
  @Post('ingest')
  @HttpCode(202)
  ingest(@Headers('authorization') auth: string | undefined, @Body() d: IngestDto) { return this.svc.ingest(auth, d); }

  @Get('vehicles') all(@CurrentUser() u: AuthUser, @Query('organizationId') org?: string) {
    if (org && !/^[0-9a-f-]{36}$/i.test(org)) throw new BadRequestException('organizationId must be a UUID');
    return this.svc.lastAll(u.id, org);
  }
  @Get('vehicles/:vehicleId/last') last(@CurrentUser() u: AuthUser, @Param('vehicleId', ParseUUIDPipe) v: string) { return this.svc.last(u.id, v); }
  @Get('vehicles/:vehicleId/history') history(@CurrentUser() u: AuthUser, @Param('vehicleId', ParseUUIDPipe) v: string, @Query() q: HistoryQuery) { return this.svc.history(u.id, v, q); }
}

@Module({ imports: [DevicesModule, GeofencesModule], controllers: [TrackingController], providers: [TrackingService, TrackingGateway, AuthGuard], exports: [TrackingService] })
export class TrackingModule {}
