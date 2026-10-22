import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType, PickType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Prisma, TrackingDevice } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser, CurrentUser, PageQuery, paginate, randomToken, sha256 } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export const OFFLINE_AFTER_MS = 10 * 60_000;

class CreateDeviceDto {
  @ApiProperty() @IsString() @Length(1, 80) name: string;
  @ApiProperty({ example: 'gps_tracker' }) @IsString() @Length(1, 40) type: string;
  @ApiProperty() @IsString() @Length(1, 80) serial: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
}
class UpdateDeviceDto extends PartialType(PickType(CreateDeviceDto, ['name', 'vehicleId'] as const)) {}
class DeviceQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
  @ApiPropertyOptional({ enum: ['pending', 'active', 'revoked'] }) @IsOptional() @IsIn(['pending', 'active', 'revoked']) status?: 'pending' | 'active' | 'revoked';
}

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService, private access: AccessService, private subs: SubscriptionsService, private audit: AuditService) {}

  present(d: TrackingDevice) {
    const connection = !d.lastSeenAt ? 'never' : Date.now() - d.lastSeenAt.getTime() > OFFLINE_AFTER_MS ? 'offline' : 'online';
    return { ...d, connection };
  }

  private async load(userId: string, id: string) {
    const d = await this.prisma.trackingDevice.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Device not found');
    if (d.ownerId !== userId) {
      if (!d.organizationId) throw new NotFoundException('Device not found');
      await this.access.assertOrgRole(userId, d.organizationId, ['ORG_ADMIN']);
    }
    return d;
  }

  async list(userId: string, q: DeviceQuery) {
    if (q.organizationId) await this.access.assertOrgRole(userId, q.organizationId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where: Prisma.TrackingDeviceWhereInput = {
      ...(q.organizationId ? { organizationId: q.organizationId } : { ownerId: userId, organizationId: null }),
      ...(q.vehicleId ? { vehicleId: q.vehicleId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { serial: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const page = await paginate(q, this.prisma.trackingDevice.count({ where }), (skip, take) =>
      this.prisma.trackingDevice.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    );
    return { ...page, items: page.items.map((d) => this.present(d)) };
  }

  async get(userId: string, id: string) {
    return this.present(await this.load(userId, id));
  }

  private async assertVehicleBinding(userId: string, vehicleId: string | undefined, organizationId: string | null | undefined) {
    if (!vehicleId) return;
    await this.access.assertVehicle(userId, vehicleId, 'manage');
    const v = await this.prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    if ((v.organizationId ?? null) !== (organizationId ?? null)) throw new ForbiddenException('Device and vehicle must belong to the same account/organization');
  }

  private newCredential() {
    const prefix = randomToken(9);
    const secret = randomToken(32);
    return { token: `vdt_${prefix}_${secret}`, prefix, hash: sha256(secret) };
  }

  /** The device token is returned exactly once; only its hash is stored. */
  async create(userId: string, d: CreateDeviceDto) {
    if (d.organizationId) {
      await this.access.assertOrgRole(userId, d.organizationId, ['ORG_ADMIN']);
      await this.subs.assertWithinLimit({ organizationId: d.organizationId }, 'devices', await this.prisma.trackingDevice.count({ where: { organizationId: d.organizationId, status: { not: 'revoked' } } }));
    } else {
      await this.subs.assertWithinLimit({ userId }, 'devices', await this.prisma.trackingDevice.count({ where: { ownerId: userId, organizationId: null, status: { not: 'revoked' } } }));
    }
    await this.assertVehicleBinding(userId, d.vehicleId, d.organizationId);
    const cred = this.newCredential();
    const device = await this.prisma.trackingDevice.create({
      data: { ...d, ownerId: userId, credentials: { create: { tokenPrefix: cred.prefix, tokenHash: cred.hash } } },
    });
    await this.audit.log({ actorUserId: userId, organizationId: d.organizationId, action: 'device.create', resourceType: 'device', resourceId: device.id });
    return { ...this.present(device), deviceToken: cred.token };
  }

  async update(userId: string, id: string, d: UpdateDeviceDto) {
    const dev = await this.load(userId, id);
    if (dev.status === 'revoked') throw new ForbiddenException('Device is revoked');
    await this.assertVehicleBinding(userId, d.vehicleId, dev.organizationId);
    await this.audit.log({ actorUserId: userId, organizationId: dev.organizationId, action: 'device.update', resourceType: 'device', resourceId: id, metadata: { vehicleId: d.vehicleId ?? null } });
    return this.present(await this.prisma.trackingDevice.update({ where: { id }, data: d }));
  }

  async rotate(userId: string, id: string) {
    const dev = await this.load(userId, id);
    if (dev.status === 'revoked') throw new ForbiddenException('Device is revoked');
    const cred = this.newCredential();
    await this.prisma.$transaction([
      this.prisma.deviceCredential.updateMany({ where: { deviceId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.deviceCredential.create({ data: { deviceId: id, tokenPrefix: cred.prefix, tokenHash: cred.hash } }),
    ]);
    await this.audit.log({ actorUserId: userId, organizationId: dev.organizationId, action: 'device.rotate_token', resourceType: 'device', resourceId: id });
    return { ...this.present(dev), deviceToken: cred.token };
  }

  async revoke(userId: string, id: string) {
    const dev = await this.load(userId, id);
    await this.prisma.$transaction([
      this.prisma.deviceCredential.updateMany({ where: { deviceId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.trackingDevice.update({ where: { id }, data: { status: 'revoked' } }),
    ]);
    await this.audit.log({ actorUserId: userId, organizationId: dev.organizationId, action: 'device.revoke', resourceType: 'device', resourceId: id });
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    const dev = await this.load(userId, id);
    await this.prisma.trackingDevice.delete({ where: { id } });
    await this.audit.log({ actorUserId: userId, organizationId: dev.organizationId, action: 'device.delete', resourceType: 'device', resourceId: id });
  }

  /** Authenticates a device token (`vdt_<prefix>_<secret>`). Rejects revoked devices/credentials. */
  async authenticate(header?: string): Promise<TrackingDevice> {
    const raw = header?.startsWith('Device ') ? header.slice(7) : undefined;
    const m = raw?.match(/^vdt_([A-Za-z0-9_-]{12})_([A-Za-z0-9_-]{43})$/);
    if (!m) throw new UnauthorizedException('Missing or malformed device token');
    const cred = await this.prisma.deviceCredential.findUnique({ where: { tokenPrefix: m[1] }, include: { device: true } });
    const ok = cred && !cred.revokedAt && cred.tokenHash.length === 64 && cred.tokenHash === sha256(m[2]);
    if (!ok || cred.device.status === 'revoked') throw new UnauthorizedException('Invalid device credentials');
    return cred.device;
  }
}

const Id = () => Param('id', ParseUUIDPipe);

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private svc: DevicesService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: DeviceQuery) { return this.svc.list(u.id, q); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateDeviceDto) { return this.svc.create(u.id, d); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.get(u.id, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: UpdateDeviceDto) { return this.svc.update(u.id, id, d); }
  @Post(':id/rotate-token') @HttpCode(200) rotate(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.rotate(u.id, id); }
  @Post(':id/revoke') @HttpCode(200) revoke(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.revoke(u.id, id); }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.remove(u.id, id); }
}

@Module({ controllers: [DevicesController], providers: [DevicesService], exports: [DevicesService] })
export class DevicesModule {}
