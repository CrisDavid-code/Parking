import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { OrgRole, PlatformRole, Prisma } from '@prisma/client';
import { AuthUser, CurrentUser, PageQuery, paginate, PlatformAdminOnly } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { RetentionService } from './retention.service';
import { FilesService } from '../files/files.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

class SearchQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) role?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['personal', 'business']) accountType?: 'personal' | 'business';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) planCode?: string;
}
class AuditQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) resourceType?: string;
}
/** Only PLATFORM_ADMIN is a platform-level role; organization roles are managed per organization. */
class UpdateUserDto {
  @ApiPropertyOptional({ enum: PlatformRole }) @IsOptional() @IsEnum(PlatformRole) role?: PlatformRole;
  @ApiPropertyOptional({ isArray: true, description: 'UI convenience: PLATFORM_ADMIN presence sets role' }) @IsOptional() @IsArray() @IsString({ each: true }) roles?: string[];
}
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
  constructor(private prisma: PrismaService, private audit: AuditService, private retention: RetentionService, private files: FilesService, private subs: SubscriptionsService) {}

  async users(q: SearchQuery) {
    const where: Prisma.UserWhereInput = {
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { fullName: { contains: q.q, mode: 'insensitive' } }] } : {}),
      ...(q.accountType ? { accountType: q.accountType } : {}),
      ...(q.role === 'PLATFORM_ADMIN' ? { role: 'PLATFORM_ADMIN' } : ['ORG_ADMIN', 'ORG_MEMBER', 'DRIVER'].includes(q.role ?? '') ? { orgMembers: { some: { role: q.role as OrgRole } } } : {}),
    };
    const page = await paginate(q, this.prisma.user.count({ where }), (skip, take) =>
      this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, fullName: true, role: true, accountType: true, lockedUntil: true, deletedAt: true, createdAt: true, orgMembers: { select: { role: true } }, subscriptions: { select: { planCode: true, status: true } } } }),
    );
    return { ...page, items: page.items.map(({ orgMembers, ...u }) => ({ ...u, roles: [...new Set(['USER', ...(u.role === 'PLATFORM_ADMIN' ? ['PLATFORM_ADMIN'] : []), ...orgMembers.map((m) => m.role)])] })) };
  }

  async updateUser(actor: AuthUser, id: string, d: UpdateUserDto) {
    const role = d.role ?? (d.roles ? (d.roles.includes('PLATFORM_ADMIN') ? 'PLATFORM_ADMIN' : 'USER') : undefined);
    if (!role) throw new BadRequestException('role or roles is required');
    if (id === actor.id && role !== 'PLATFORM_ADMIN') throw new BadRequestException('Cannot remove your own admin role');
    const u = await this.prisma.user.update({ where: { id }, data: { role }, select: { id: true, email: true, role: true } });
    await this.audit.log({ actorUserId: actor.id, action: 'admin.user_update', resourceType: 'user', resourceId: id, metadata: { role } });
    return u;
  }

  async unlockUser(actor: AuthUser, id: string) {
    await this.prisma.user.update({ where: { id }, data: { lockedUntil: null, failedLoginCount: 0 } });
    await this.audit.log({ actorUserId: actor.id, action: 'admin.user_unlock', resourceType: 'user', resourceId: id });
  }

  async organizations(q: SearchQuery) {
    const where: Prisma.OrganizationWhereInput = {
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(q.planCode ? { subscription: { planCode: q.planCode } } : {}),
    };
    const page = await paginate(q, this.prisma.organization.count({ where }), (skip, take) =>
      this.prisma.organization.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { subscription: { select: { planCode: true, status: true } }, _count: { select: { members: true, vehicles: true, devices: true } } } }),
    );
    return { ...page, items: page.items.map((o) => ({ ...o, planCode: o.subscription?.planCode ?? 'free' })) };
  }

  async plans() {
    const items = (await this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } })).map((p) => ({ ...p, id: p.code, priceMonthly: Number(p.priceMonthly) }));
    return { items, total: items.length, page: 1, pageSize: items.length };
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

  /** Platform KPIs plus a daily series of active users (distinct actors in audit log) and parking sessions. */
  async usage(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [activeUsers, vehicles, parkingSessions30d, devicesActive, users, sessions] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.vehicle.count({ where: { deletedAt: null } }),
      this.prisma.parkingSession.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      this.prisma.trackingDevice.count({ where: { status: 'active' } }),
      this.prisma.$queryRaw<{ day: string; n: bigint }[]>`
        SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(DISTINCT actor_user_id) AS n FROM audit_events
        WHERE created_at >= ${since} AND actor_user_id IS NOT NULL GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; n: bigint }[]>`
        SELECT to_char(created_at, 'YYYY-MM-DD') AS day, count(*) AS n FROM parking_sessions WHERE created_at >= ${since} GROUP BY 1`,
    ]);
    const u = new Map(users.map((r) => [r.day, Number(r.n)]));
    const p = new Map(sessions.map((r) => [r.day, Number(r.n)]));
    const series = Array.from({ length: days }, (_, i) => {
      const date = new Date(since.getTime() + (i + 1) * 86_400_000).toISOString().slice(0, 10);
      return { date, users: u.get(date) ?? 0, sessions: p.get(date) ?? 0 };
    });
    return { days, activeUsers, vehicles, parkingSessions30d, devicesActive, series };
  }

  async auditLog(q: AuditQuery) {
    const page = await this.audit.list(q, {
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.resourceType ? { resourceType: q.resourceType } : {}),
      ...(q.q ? { action: { contains: q.q } } : {}),
    });
    const ids = [...new Set(page.items.map((a) => a.actorUserId).filter((x): x is string => !!x))];
    const users = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
    return { ...page, items: page.items.map((a) => ({ ...a, actorEmail: a.actorUserId ? users.get(a.actorUserId) ?? a.actorUserId : 'sistema', target: `${a.resourceType}${a.resourceId ? ':' + a.resourceId : ''}` })) };
  }

  async health() {
    const t = Date.now();
    let db: 'up' | 'down' = 'up';
    try { await this.prisma.$queryRaw`SELECT 1`; } catch { db = 'down'; }
    const latencyMs = Date.now() - t;
    return {
      checkedAt: new Date(),
      services: [
        { name: 'API', status: 'up', latencyMs: 0 },
        { name: 'PostgreSQL/PostGIS', status: db, latencyMs },
        { name: 'Almacenamiento (S3)', status: this.files.configured ? 'up' : 'degraded', latencyMs: null },
        { name: 'Pagos', status: this.subs.paymentsConfigured() ? 'up' : 'degraded', latencyMs: null },
        { name: 'Correo / Push', status: 'degraded', latencyMs: null },
      ],
    };
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
  @Get('health') health() { return this.svc.health(); }
  @Post('retention/run') @HttpCode(200) retention(@CurrentUser() u: AuthUser) { return this.svc.runRetention(u); }
}

@Module({ controllers: [AdminController], providers: [AdminService, RetentionService], exports: [RetentionService] })
export class AdminModule {}
