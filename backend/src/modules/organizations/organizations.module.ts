import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { OrgRole } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser, CurrentUser, PageQuery, paginate, randomToken, sha256 } from '../../common/http';
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
  @ApiProperty({ example: 'transportes-gt' }) @Matches(/^[a-z0-9-]{3,60}$/) slug: string;
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
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) licenseNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional({ description: 'Link to a platform user who is a DRIVER member' }) @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateDriverDto extends PartialType(DriverDto) {}
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
    const ms = await this.prisma.organizationMember.findMany({ where: { userId }, include: { organization: true } });
    return ms.map((m) => ({ ...m.organization, role: m.role }));
  }

  async create(userId: string, d: CreateOrgDto) {
    if (await this.prisma.organization.findUnique({ where: { slug: d.slug } })) throw new BadRequestException('Slug already in use');
    const org = await this.prisma.organization.create({
      data: { ...d, members: { create: { userId, role: 'ORG_ADMIN' } }, subscription: { create: { planCode: 'free', status: 'active' } } },
    });
    await this.audit.log({ actorUserId: userId, organizationId: org.id, action: 'organization.create', resourceType: 'organization', resourceId: org.id });
    return { ...org, role: 'ORG_ADMIN' };
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

  async members(userId: string, orgId: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const [members, pending] = await Promise.all([
      this.prisma.organizationMember.findMany({ where: { organizationId: orgId }, include: { user: { select: { id: true, email: true, fullName: true } } } }),
      this.prisma.invitation.findMany({ where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, orgRole: true, expiresAt: true } }),
    ]);
    return { items: members.map((m) => ({ userId: m.userId, email: m.user.email, fullName: m.user.fullName, role: m.role, createdAt: m.createdAt })), pendingInvitations: pending };
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
  async drivers(userId: string, orgId: string, q: PageQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where = { organizationId: orgId };
    return paginate(q, this.prisma.driver.count({ where }), (skip, take) => this.prisma.driver.findMany({ where, skip, take, orderBy: { fullName: 'asc' } }));
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
  async assignments(userId: string, orgId: string, q: PageQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where = { organizationId: orgId };
    return paginate(q, this.prisma.vehicleAssignment.count({ where }), (skip, take) =>
      this.prisma.vehicleAssignment.findMany({ where, skip, take, orderBy: { startsAt: 'desc' }, include: { vehicle: { select: { alias: true, plate: true } }, driver: { select: { fullName: true } } } }),
    );
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

  async endAssignment(userId: string, orgId: string, id: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    const r = await this.prisma.vehicleAssignment.updateMany({ where: { id, organizationId: orgId }, data: { endsAt: new Date() } });
    if (!r.count) throw new NotFoundException('Assignment not found');
  }

  // ---- alerts & reports ----
  async alerts(userId: string, orgId: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [geofence, devices] = await Promise.all([
      this.prisma.geofenceEvent.findMany({ where: { geofence: { organizationId: orgId }, occurredAt: { gte: since } }, orderBy: { occurredAt: 'desc' }, take: 100, include: { geofence: { select: { name: true } }, vehicle: { select: { alias: true } } } }),
      this.prisma.trackingDevice.findMany({ where: { organizationId: orgId, status: 'active' } }),
    ]);
    const offline = devices.filter((d) => !d.lastSeenAt || Date.now() - d.lastSeenAt.getTime() > OFFLINE_AFTER_MS);
    return {
      items: [
        ...geofence.map((e) => ({ id: e.id, kind: `geofence.${e.type}`, severity: 'info', vehicleId: e.vehicleId, title: `${e.vehicle.alias}: ${e.type === 'enter' ? 'entrada a' : 'salida de'} ${e.geofence.name}`, occurredAt: e.occurredAt })),
        ...offline.map((d) => ({ id: d.id, kind: 'device.offline', severity: 'warning', vehicleId: d.vehicleId, title: `Dispositivo ${d.name} sin conexión`, occurredAt: d.lastSeenAt })),
      ],
    };
  }

  async summary(userId: string, orgId: string, days = 30) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const since = new Date(Date.now() - days * 86_400_000);
    const [vehicles, drivers, activeDevices, activeAssignments, parkedNow, geofenceEvents, perDay] = await Promise.all([
      this.prisma.vehicle.count({ where: { organizationId: orgId, deletedAt: null } }),
      this.prisma.driver.count({ where: { organizationId: orgId, active: true } }),
      this.prisma.trackingDevice.count({ where: { organizationId: orgId, status: 'active' } }),
      this.prisma.vehicleAssignment.count({ where: { organizationId: orgId, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } }),
      this.prisma.parkingSession.count({ where: { status: 'active', vehicle: { organizationId: orgId } } }),
      this.prisma.geofenceEvent.count({ where: { geofence: { organizationId: orgId }, occurredAt: { gte: since } } }),
      this.prisma.$queryRaw<{ day: Date; points: bigint }[]>`
        SELECT date_trunc('day', e.captured_at) AS day, count(*) AS points
        FROM location_events e JOIN vehicles v ON v.id = e.vehicle_id
        WHERE v.organization_id = ${orgId}::uuid AND e.captured_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
    ]);
    return { days, vehicles, drivers, activeDevices, activeAssignments, parkedNow, geofenceEvents, locationPointsPerDay: perDay.map((r) => ({ day: r.day, points: Number(r.points) })) };
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

  @Get(':orgId/members') members(@CurrentUser() u: AuthUser, @Org() o: string) { return this.svc.members(u.id, o); }
  @Post(':orgId/members') invite(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: InviteMemberDto) { return this.svc.invite(u.id, o, d); }
  @Patch(':orgId/members/:userId') updateMember(@CurrentUser() u: AuthUser, @Org() o: string, @Id('userId') m: string, @Body() d: UpdateMemberDto) { return this.svc.updateMember(u.id, o, m, d); }
  @Delete(':orgId/members/:userId') @HttpCode(204) removeMember(@CurrentUser() u: AuthUser, @Org() o: string, @Id('userId') m: string) { return this.svc.removeMember(u.id, o, m); }

  @Get(':orgId/vehicles') listVehicles(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: PageQuery) { return this.vehicles.list(u.id, q, o); }
  @Post(':orgId/vehicles') createVehicle(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: CreateVehicleDto) { return this.vehicles.create(u.id, d, o); }

  @Get(':orgId/drivers') drivers(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: PageQuery) { return this.svc.drivers(u.id, o, q); }
  @Post(':orgId/drivers') createDriver(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: DriverDto) { return this.svc.createDriver(u.id, o, d); }
  @Patch(':orgId/drivers/:id') updateDriver(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string, @Body() d: UpdateDriverDto) { return this.svc.updateDriver(u.id, o, id, d); }
  @Delete(':orgId/drivers/:id') @HttpCode(204) removeDriver(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string) { return this.svc.removeDriver(u.id, o, id); }

  @Get(':orgId/assignments') assignments(@CurrentUser() u: AuthUser, @Org() o: string, @Query() q: PageQuery) { return this.svc.assignments(u.id, o, q); }
  @Post(':orgId/assignments') assign(@CurrentUser() u: AuthUser, @Org() o: string, @Body() d: AssignmentDto) { return this.svc.assign(u.id, o, d); }
  @Post(':orgId/assignments/:id/end') @HttpCode(204) endAssignment(@CurrentUser() u: AuthUser, @Org() o: string, @Id() id: string) { return this.svc.endAssignment(u.id, o, id); }

  @Get(':orgId/alerts') alerts(@CurrentUser() u: AuthUser, @Org() o: string) { return this.svc.alerts(u.id, o); }
  @Get(':orgId/reports/summary') summary(@CurrentUser() u: AuthUser, @Org() o: string, @Query('days') days?: string) {
    const n = days ? Number(days) : 30;
    if (!Number.isInteger(n) || n < 1 || n > 365) throw new BadRequestException('days must be 1-365');
    return this.svc.summary(u.id, o, n);
  }
}

@Module({ imports: [VehiclesModule], controllers: [OrganizationsController], providers: [OrganizationsService] })
export class OrganizationsModule {}
