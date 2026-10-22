import { Controller, Get, Global, Injectable, Module, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser, CurrentUser, PageQuery, paginate } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  log(e: AuditEntry) {
    return this.prisma.auditEvent.create({ data: { ...e, metadata: e.metadata ?? {} } });
  }
  list(q: PageQuery, where: Prisma.AuditEventWhereInput = {}) {
    return paginate(q, this.prisma.auditEvent.count({ where }), (skip, take) =>
      this.prisma.auditEvent.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    );
  }
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('organizations/:orgId/audit')
export class OrgAuditController {
  constructor(private audit: AuditService, private access: AccessService) {}
  @Get()
  async list(@CurrentUser() u: AuthUser, @Param('orgId') orgId: string, @Query() q: PageQuery) {
    await this.access.assertOrgRole(u.id, orgId, ['ORG_ADMIN']);
    return this.audit.list(q, { organizationId: orgId });
  }
}

@Global()
@Module({ providers: [AuditService], controllers: [OrgAuditController], exports: [AuditService] })
export class AuditModule {}
