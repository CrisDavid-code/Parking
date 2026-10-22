import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsDateString, IsEmail, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { OrgRole, Prisma } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser, CurrentUser, Page, PageQuery, paginate, randomToken, sha256 } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { NotificationsService } from '../notifications/notifications.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreateVehicleDto } from '../vehicles/vehicles.dto';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { VehiclesService } from '../vehicles/vehicles.service';
import { OFFLINE_AFTER_MS } from '../devices/devices.module';

class CreateOrgDto {
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiPropertyOptional({ example: 'transportes-gt', description: 'Derived from name when omitted' }) @IsOptional() @Matches(/^[a-z0-9-]{3,60}$/) slug?: string;
}
class UpdateOrgDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() settings?: Record<string, unknown>;
}
class InviteMemberDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
  @ApiProperty({ enum: OrgRole }) @IsEnum(OrgRole) role: OrgRole;
}
class UpdateMemberDto { @ApiProperty({ enum: OrgRole }) @IsEnum(OrgRole) role: OrgRole }
class DriverDto {
  @ApiProperty() @IsString() @Length(2, 120) fullName: string;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => (value === '' ? undefined : value)) @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional({ description: 'Link to a platform user who is a DRIVER member' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateDriverDto extends PartialType(DriverDto) {}
class StatusQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) severity?: string;
}
class RangeQuery {
  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ example: '2026-01-31' }) @IsOptional() @IsDateString() to?: string;
}
class AssignmentDto {
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiProperty() @IsUUID() driverId: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private subs: SubscriptionsService,
    private cfg: ConfigService,
  ) {}

  async mine(userId: string) {
    const ms = await this.prisma.organizationMember.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { organization: { include: { subscription: true } } } });
    return ms.map(({ organization: { subscription, ...o }, role }) => ({ ...o, role, planCode: subscription?.planCode ?? 'free' }));
  }

  async create(userId: string, d: CreateOrgDto) {
    const base = d.slug ?? (d.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'org');
    const slug = d.slug ?? `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
    if (await this.prisma.organization.findUnique({ where: { slug } })) throw new BadRequestException('Slug already in use');
    const org = await this.prisma.organization.create({
      data: { name: d.name, slug, members: { create: { userId, role: 'ORG_ADMIN' } }, subscription: { create: { planCode: 'free', status: 'active' } } },
    });
    await this.audit.log({ actorUserId: userId, organizationId: org.id, action: 'organization.create', resourceType: 'organization', resourceId: org.id });
    return { ...org, role: 'ORG_ADMIN', planCode: 'free' };
  }

  async get(userId: string, orgId: string) {
    const role = await this.access.assertOrgRole(userId, orgId);
    return { ...(await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } })), role };
  }

  async update(userId: string, orgId: string, d: UpdateOrgDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'organization.update', resourceType: 'organization', resourceId: orgId });
    return this.prisma.organization.update({ where: { id: orgId }, data: d as never });
  }

  async members(userId: string, orgId: string, q: PageQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId: orgId,
      ...(q.q ? { user: { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { fullName: { contains: q.q, mode: 'insensitive' } }] } } : {}),
    };
    const [page, pending] = await Promise.all([
      paginate(q, this.prisma.organizationMember.count({ where }), (skip, take) =>
        this.prisma.organizationMember.findMany({ where, skip, take, orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, email: true, fullName: true } } } }),
      ),
      this.prisma.invitation.findMany({ where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, orgRole: true, expiresAt: true } }),
    ]);
    return { ...page, items: page.items.map((m) => ({ id: m.userId, userId: m.userId, email: m.user.email, fullName: m.user.fullName, role: m.role, createdAt: m.createdAt })), pendingInvitations: pending };
  }

  async invite(userId: string, orgId: string, d: InviteMemberDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    await this.subs.assertWithinLimit({ organizationId: orgId }, 'members', await this.prisma.organizationMember.count({ where: { organizationId: orgId } }));
    const token = randomToken();
    const inv = await this.prisma.invitation.create({ data: { tokenHash: sha256(token), type: 'org_member', email: d.email, organizationId: orgId, orgRole: d.role, invitedById: userId, expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    const inviteUrl = `${this.cfg.get('appUrl')}/invite/${token}`;
    const delivery = await this.notifications.sendEmail(d.email, 'Invitación a organización', `Acepta: ${inviteUrl}`);
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'organization.invite', resourceType: 'invitation', resourceId: inv.id, metadata: { email: d.email, role: d.role } });
    return { invitationId: inv.id, inviteUrl, emailDelivered: delivery.delivered };
  }

  private async assertNotLastAdmin(orgId: string, memberId: string) {
    const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: memberId } } });
    if (!m) throw new NotFoundException('Member not found');
    if (m.role === 'ORG_ADMIN' && (await this.prisma.organizationMember.count({ where: { organizationId: orgId, role: 'ORG_ADMIN' } })) === 1) {
      throw new BadRequestException('Organization must keep at least one admin');
    }
  }

  async updateMember(userId: string, orgId: string, memberId: string, d: UpdateMemberDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    if (d.role !== 'ORG_ADMIN') await this.assertNotLastAdmin(orgId, memberId);
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'organization.member_role', resourceType: 'organization_member', resourceId: memberId, metadata: { role: d.role } });
    return this.prisma.organizationMember.update({ where: { organizationId_userId: { organizationId: orgId, userId: memberId } }, data: { role: d.role } });
  }

  async removeMember(userId: string, orgId: string, memberId: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    await this.assertNotLastAdmin(orgId, memberId);
    await this.prisma.organizationMember.delete({ where: { organizationId_userId: { organizationId: orgId, userId: memberId } } });
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'organization.member_remove', resourceType: 'organization_member', resourceId: memberId });
  }

  // ---- drivers ----
  async drivers(userId: string, orgId: string, q: StatusQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where: Prisma.DriverWhereInput = {
      organizationId: orgId,
      ...(q.status === 'active' ? { active: true } : q.status === 'inactive' ? { active: false } : {}),
      ...(q.q ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { licenseNumber: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const page = await paginate(q, this.prisma.driver.count({ where }), (skip, take) => this.prisma.driver.findMany({ where, skip, take, orderBy: { fullName: 'asc' } }));
    return { ...page, items: page.items.map((d) => ({ ...d, status: d.active ? 'active' : 'inactive' })) };
  }

  private async assertDriverUser(orgId: string, driverUserId?: string) {
    if (!driverUserId) return;
    const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: driverUserId } } });
    if (!m) throw new BadRequestException('userId must be a member of the organization');
  }

  async createDriver(userId: string, orgId: string, d: DriverDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    await this.assertDriverUser(orgId, d.userId);
    return this.prisma.driver.create({ data: { ...d, organizationId: orgId } });
  }

  async updateDriver(userId: string, orgId: string, id: string, d: UpdateDriverDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    if (!(await this.prisma.driver.findFirst({ where: { id, organizationId: orgId } }))) throw new NotFoundException('Driver not found');
    await this.assertDriverUser(orgId, d.userId);
    return this.prisma.driver.update({ where: { id }, data: d });
  }

  async removeDriver(userId: string, orgId: string, id: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    const r = await this.prisma.driver.deleteMany({ where: { id, organizationId: orgId } });
    if (!r.count) throw new NotFoundException('Driver not found');
  }

  // ---- assignments ----
  async assignments(userId: string, orgId: string, q: StatusQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const now = new Date();
    const byStatus: Record<string, Prisma.VehicleAssignmentWhereInput> = {
      scheduled: { startsAt: { gt: now } },
      active: { startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ended: { endsAt: { lte: now } },
    };
    const where: Prisma.VehicleAssignmentWhereInput = { organizationId: orgId, ...(q.status ? byStatus[q.status] ?? {} : {}) };
    const page = await paginate(q, this.prisma.vehicleAssignment.count({ where }), (skip, take) =>
      this.prisma.vehicleAssignment.findMany({ where, skip, take, orderBy: { startsAt: 'desc' }, include: { vehicle: { select: { alias: true, plate: true } }, driver: { select: { fullName: true } } } }),
    );
    return {
      ...page,
      items: page.items.map(({ vehicle, driver, ...a }) => ({
        ...a,
        vehicleAlias: vehicle.alias,
        driverName: driver.fullName,
        status: a.startsAt > now ? 'scheduled' : a.endsAt && a.endsAt <= now ? 'ended' : 'active',
      })),
    };
  }

  /** A vehicle has at most one open assignment: creating a new one closes the previous. */
  async assign(userId: string, orgId: string, d: AssignmentDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    const [v, dr] = await Promise.all([
      this.prisma.vehicle.findFirst({ where: { id: d.vehicleId, organizationId: orgId, deletedAt: null } }),
      this.prisma.driver.findFirst({ where: { id: d.driverId, organizationId: orgId, active: true } }),
    ]);
    if (!v || !dr) throw new BadRequestException('Vehicle and driver must belong to this organization');
    const startsAt = d.startsAt ?? new Date();
    if (d.endsAt && d.endsAt <= startsAt) throw new BadRequestException('endsAt must be after startsAt');
    const [, a] = await this.prisma.$transaction([
      this.prisma.vehicleAssignment.updateMany({ where: { vehicleId: d.vehicleId, OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }] }, data: { endsAt: startsAt } }),
      this.prisma.vehicleAssignment.create({ data: { organizationId: orgId, vehicleId: d.vehicleId, driverId: d.driverId, startsAt, endsAt: d.endsAt } }),
    ]);
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'assignment.create', resourceType: 'vehicle_assignment', resourceId: a.id });
    return a;
  }

  async removeAssignment(userId: string, orgId: string, id: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    const r = await this.prisma.vehicleAssignment.deleteMany({ where: { id, organizationId: orgId } });
    if (!r.count) throw new NotFoundException('Assignment not found');
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'assignment.delete', resourceType: 'vehicle_assignment', resourceId: id });
  }

  async endAssignment(userId: string, orgId: string, id: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    const r = await this.prisma.vehicleAssignment.updateMany({ where: { id, organizationId: orgId }, data: { endsAt: new Date() } });
    if (!r.count) throw new NotFoundException('Assignment not found');
  }

  // ---- alerts & reports ----
  /**
   * Fleet alerts are derived from data, not stored separately: geofence transitions (last 30 days)
   * and active devices without recent signal. Acknowledgements are persisted per alert id.
   */
  async alerts(userId: string, orgId: string, q: StatusQuery): Promise<Page<{ id: string; type: string; message: string; vehicleId: string | null; severity: string; createdAt: Date | null; acknowledged: boolean }>> {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [geofence, devices, acks] = await Promise.all([
      this.prisma.geofenceEvent.findMany({ where: { geofence: { organizationId: orgId }, occurredAt: { gte: since } }, orderBy: { occurredAt: 'desc' }, take: 500, include: { geofence: { select: { name: true } }, vehicle: { select: { alias: true } } } }),
      this.prisma.trackingDevice.findMany({ where: { organizationId: orgId, status: 'active' } }),
      this.prisma.alertAcknowledgement.findMany({ where: { organizationId: orgId }, select: { alertId: true } }),
    ]);
    const acked = new Set(acks.map((a) => a.alertId));
    const offline = devices.filter((d) => !d.lastSeenAt || Date.now() - d.lastSeenAt.getTime() > OFFLINE_AFTER_MS);
    let items = [
      ...offline.map((d) => ({ id: `device-offline:${d.id}:${d.lastSeenAt?.getTime() ?? 0}`, type: 'device_offline', severity: 'warning', vehicleId: d.vehicleId, message: `Dispositivo ${d.name} sin conexión`, createdAt: d.lastSeenAt ?? d.createdAt })),
      ...geofence.map((e) => ({ id: e.id, type: `geofence_${e.type}`, severity: 'info', vehicleId: e.vehicleId, message: `${e.vehicle.alias}: ${e.type === 'enter' ? 'entrada a' : 'salida de'} ${e.geofence.name}`, createdAt: e.occurredAt })),
    ].map((a) => ({ ...a, acknowledged: acked.has(a.id) }));
    if (q.severity) items = items.filter((a) => a.severity === q.severity);
    if (q.q) items = items.filter((a) => a.message.toLowerCase().includes(q.q!.toLowerCase()));
    return { items: items.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: items.length, page: q.page, pageSize: q.pageSize };
  }

  async ackAlert(userId: string, orgId: string, alertId: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    await this.prisma.alertAcknowledgement.upsert({ where: { organizationId_alertId: { organizationId: orgId, alertId } }, create: { organizationId: orgId, alertId, userId }, update: {} });
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'alert.ack', resourceType: 'alert', resourceId: alertId });
  }

  /** Daily fleet report. Distance = sum of PostGIS distances between consecutive points per vehicle (UTC days). */
  async summary(userId: string, orgId: string, r: RangeQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const to = r.to ? new Date(`${r.to.slice(0, 10)}T00:00:00Z`) : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const from = r.from ? new Date(`${r.from.slice(0, 10)}T00:00:00Z`) : new Date(to.getTime() - 29 * 86_400_000);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 366) throw new BadRequestException('Range must be 1-366 days and from <= to');
    const end = new Date(to.getTime() + 86_400_000);
    const [vehicles, drivers, devices, activeVehicles, distance, parking, alerts] = await Promise.all([
      this.prisma.vehicle.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.driver.count({ where: { organizationId: orgId, active: true } }),
      this.prisma.trackingDevice.count({ where: { organizationId: orgId, status: 'active' } }),
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(DISTINCT e.vehicle_id) AS n FROM location_events e JOIN vehicles v ON v.id = e.vehicle_id
        WHERE v.organization_id = ${orgId}::uuid AND e.captured_at >= ${from} AND e.captured_at < ${end}`,
      this.prisma.$queryRaw<{ day: string; km: number }[]>`
        WITH pts AS (
          SELECT e.captured_at, e.geog, LAG(e.geog) OVER (PARTITION BY e.vehicle_id ORDER BY e.captured_at) AS prev
          FROM location_events e JOIN vehicles v ON v.id = e.vehicle_id
          WHERE v.organization_id = ${orgId}::uuid AND e.captured_at >= ${from} AND e.captured_at < ${end})
        SELECT to_char(captured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
               COALESCE(SUM(ST_Distance(geog, prev)) FILTER (WHERE prev IS NOT NULL), 0)::float / 1000 AS km
        FROM pts GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; n: bigint }[]>`
        SELECT to_char(p.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*) AS n
        FROM parking_sessions p JOIN vehicles v ON v.id = p.vehicle_id
        WHERE v.organization_id = ${orgId}::uuid AND p.started_at >= ${from} AND p.started_at < ${end} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; n: bigint }[]>`
        SELECT to_char(g.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, count(*) AS n
        FROM geofence_events g JOIN geofences f ON f.id = g.geofence_id
        WHERE f.organization_id = ${orgId}::uuid AND g.occurred_at >= ${from} AND g.occurred_at < ${end} GROUP BY 1`,
    ]);
    const byDay = <T,>(rows: (T & { day: string })[]) => new Map(rows.map((x) => [x.day, x]));
    const km = byDay(distance), pk = byDay(parking), al = byDay(alerts);
    const series = Array.from({ length: days }, (_, i) => {
      const date = new Date(from.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      return { date, distanceKm: Math.round((km.get(date)?.km ?? 0) * 10) / 10, parkingSessions: Number(pk.get(date)?.n ?? 0), alerts: Number(al.get(date)?.n ?? 0) };
    });
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totals: { vehicles, activeVehicles: Number(activeVehicles[0]?.n ?? 0), drivers, devices, alerts: series.reduce((a, s) => a + s.alerts, 0) },
      series,
    };
  }
}

const Org = () => Param('orgId', ParseUUIDPipe);
const Id = (n = 'id') => Param(n, ParseUUIDPipe);

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private svc: OrganizationsService, private vehicles: VehiclesService) {}
  @Get() mine(@CurrentUser() u: AuthUser) { return this.svc.mine(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateOrgDto) { return this.svc.create(u.id, d); }
  @Get(':orgId') get(@CurrentUser() u: AuthUser, @Org() o: string) { return this.svc.get(u.id, o); }
  @Patch(':orgId') update(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: UpdateOrgDto) { return this.svc.update(u.id, o, d); }

  @Get(':orgId/members') members(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: PageQuery) { return this.svc.members(u.id, o, q); }
  @Post(':orgId/members') invite(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: InviteMemberDto) { return this.svc.invite(u.id, o, d); }
  @Patch(':orgId/members/:userId') updateMember(@CurrentUser() u: AuthUser, @Org() o: string, @Id('userId') m: string, @Body() d: UpdateMemberDto) { return this.svc.updateMember(u.id, o, m, d); }
  @Delete(':orgId/members/:userId') @HttpCode(204) removeMember(@CurrentUser() u: AuthUser, @Org() o: string, @Id('userId') m: string) { return this.svc.removeMember(u.id, o, m); }

  @Get(':orgId/vehicles') listVehicles(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: PageQuery) { return this.vehicles.list(u.id, q, o); }
  @Post(':orgId/vehicles') createVehicle(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: CreateVehicleDto) { return this.vehicles.create(u.id, d, o); }

  @Get(':orgId/drivers') drivers(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: StatusQuery) { return this.svc.drivers(u.id, o, q); }
  @Post(':orgId/drivers') createDriver(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: DriverDto) { return this.svc.createDriver(u.id, o, d); }
  @Patch(':orgId/drivers/:id') updateDriver(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string, @Body() d: UpdateDriverDto) { return this.svc.updateDriver(u.id, o, id, d); }
  @Delete(':orgId/drivers/:id') @HttpCode(204) removeDriver(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string) { return this.svc.removeDriver(u.id, o, id); }

  @Get(':orgId/assignments') assignments(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: StatusQuery) { return this.svc.assignments(u.id, o, q); }
  @Post(':orgId/assignments') assign(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: AssignmentDto) { return this.svc.assign(u.id, o, d); }
  @Post(':orgId/assignments/:id/end') @HttpCode(204) endAssignment(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string) { return this.svc.endAssignment(u.id, o, id); }
  @Delete(':orgId/assignments/:id') @HttpCode(204) removeAssignment(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string) { return this.svc.removeAssignment(u.id, o, id); }

  @Get(':orgId/alerts') alerts(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: StatusQuery) { return this.svc.alerts(u.id, o, q); }
  @Post(':orgId/alerts/:alertId/ack') @HttpCode(204) ack(@CurrentUser() u: AuthUser, @Org() o: string, @Param('alertId') a: string) {
    if (a.length > 120) throw new BadRequestException('Invalid alert id');
    return this.svc.ackAlert(u.id, o, a);
  }
  @Get(':orgId/reports/summary') summary(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: RangeQuery) { return this.svc.summary(u.id, o, q); }
}

@Module({ imports: [VehiclesModule], controllers: [OrganizationsController], providers: [OrganizationsService] })
export class OrganizationsModule {}
