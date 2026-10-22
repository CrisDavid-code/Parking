import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { PlatformRole, Prisma } from '@prisma/client';
import { AuthUser, CurrentUser, PageQuery, paginate, PlatformAdminOnly } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { RetentionService } from './retention.service';

class SearchQuery extends PageQuery { @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string }
class AuditQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) resourceType?: string;
}
class UpdateUserDto { @ApiPropertyOptional({ enum: PlatformRole }) @IsOptional() @IsEnum(PlatformRole) role?: PlatformRole }
class UpdatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 60) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) priceMonthly?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() limits?: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
class UsageQuery { @ApiPropertyOptional({ default: 30 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 30 }

const LIMIT_KEYS = ['vehicles', 'devices', 'historyDays', 'members'];

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private audit: AuditService, private retention: RetentionService) {}

  users(q: SearchQuery) {
    const where: Prisma.UserWhereInput = q.search ? { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { fullName: { contains: q.search, mode: 'insensitive' } }] } : {};
    return paginate(q, this.prisma.user.count({ where }), (skip, take) =>
      this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, fullName: true, role: true, accountType: true, lockedUntil: true, deletedAt: true, createdAt: true, subscriptions: { select: { planCode: true, status: true } }, _count: { select: { vehicles: true } } } }),
    );
  }

  async updateUser(actor: AuthUser, id: string, d: UpdateUserDto) {
    if (id === actor.id && d.role && d.role !== 'PLATFORM_ADMIN') throw new BadRequestException('Cannot remove your own admin role');
    const u = await this.prisma.user.update({ where: { id }, data: d, select: { id: true, email: true, role: true } });
    await this.audit.log({ actorUserId: actor.id, action: 'admin.user_update', resourceType: 'user', resourceId: id, metadata: { ...d } });
    return u;
  }

  async unlockUser(actor: AuthUser, id: string) {
    await this.prisma.user.update({ where: { id }, data: { lockedUntil: null, failedLoginCount: 0 } });
    await this.audit.log({ actorUserId: actor.id, action: 'admin.user_unlock', resourceType: 'user', resourceId: id });
  }

  organizations(q: SearchQuery) {
    const where: Prisma.OrganizationWhereInput = q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {};
    return paginate(q, this.prisma.organization.count({ where }), (skip, take) =>
      this.prisma.organization.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { subscription: { select: { planCode: true, status: true } }, _count: { select: { members: true, vehicles: true, devices: true } } } }),
    );
  }

  plans() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } }).then((ps) => ps.map((p) => ({ ...p, priceMonthly: Number(p.priceMonthly) })));
  }

  async updatePlan(actor: AuthUser, code: string, d: UpdatePlanDto) {
    if (d.limits) {
      const bad = Object.entries(d.limits).filter(([k, v]) => !LIMIT_KEYS.includes(k) || !Number.isInteger(v) || v < 0);
      if (bad.length || LIMIT_KEYS.some((k) => !(k in d.limits!))) throw new BadRequestException(`limits must contain integer ${LIMIT_KEYS.join(', ')}`);
    }
    const p = await this.prisma.plan.update({ where: { code }, data: d });
    await this.audit.log({ actorUserId: actor.id, action: 'admin.plan_update', resourceType: 'plan', resourceId: code, metadata: d as Prisma.InputJsonValue });
    return { ...p, priceMonthly: Number(p.priceMonthly) };
  }

  async usage(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [users, organizations, vehicles, activeDevices, locationEvents, parkingSessions, navigationSessions, subsByPlan] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.organization.count(),
      this.prisma.vehicle.count({ where: { deletedAt: null } }),
      this.prisma.trackingDevice.count({ where: { status: 'active' } }),
      this.prisma.locationEvent.count({ where: { receivedAt: { gte: since } } }),
      this.prisma.parkingSession.count({ where: { createdAt: { gte: since } } }),
      this.prisma.pedestrianNavigationSession.count({ where: { startedAt: { gte: since } } }),
      this.prisma.subscription.groupBy({ by: ['planCode'], _count: true, where: { status: { not: 'canceled' } } }),
    ]);
    return { days, users, organizations, vehicles, activeDevices, locationEvents, parkingSessions, navigationSessions, subscriptionsByPlan: subsByPlan.map((s) => ({ planCode: s.planCode, count: s._count })) };
  }

  auditLog(q: AuditQuery) {
    return this.audit.list(q, { ...(q.action ? { action: { startsWith: q.action } } : {}), ...(q.resourceType ? { resourceType: q.resourceType } : {}) });
  }

  async runRetention(actor: AuthUser) {
    const r = await this.retention.run();
    await this.audit.log({ actorUserId: actor.id, action: 'admin.retention_run', resourceType: 'system', metadata: r });
    return r;
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@PlatformAdminOnly()
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}
  @Get('users') users(@Query() q: SearchQuery) { return this.svc.users(q); }
  @Patch('users/:id') updateUser(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateUserDto) { return this.svc.updateUser(u, id, d); }
  @Post('users/:id/unlock') @HttpCode(204) unlock(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.unlockUser(u, id); }
  @Get('organizations') organizations(@Query() q: SearchQuery) { return this.svc.organizations(q); }
  @Get('plans') plans() { return this.svc.plans(); }
  @Patch('plans/:code') updatePlan(@CurrentUser() u: AuthUser, @Param('code') code: string, @Body() d: UpdatePlanDto) { return this.svc.updatePlan(u, code, d); }
  @Get('usage') usage(@Query() q: UsageQuery) { return this.svc.usage(q.days); }
  @Get('audit') audit(@Query() q: AuditQuery) { return this.svc.auditLog(q); }
  @Post('retention/run') @HttpCode(200) retention(@CurrentUser() u: AuthUser) { return this.svc.runRetention(u); }
}

@Module({ controllers: [AdminController], providers: [AdminService, RetentionService], exports: [RetentionService] })
export class AdminModule {}
