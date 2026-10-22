import { Body, Controller, Get, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Prisma, SupportStatus } from '@prisma/client';
import { AuthUser, CurrentUser, PageQuery, paginate, PlatformAdminOnly } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';

class CreateTicketDto {
  @ApiProperty() @IsString() @Length(3, 120) subject: string;
  @ApiProperty() @IsString() @Length(10, 2000) message: string;
}
class TicketQuery extends PageQuery { @ApiPropertyOptional({ enum: SupportStatus }) @IsOptional() @IsEnum(SupportStatus) status?: SupportStatus }
class TicketStatusDto { @ApiProperty({ enum: SupportStatus }) @IsEnum(SupportStatus) status: SupportStatus }

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  create(userId: string, d: CreateTicketDto) {
    return this.prisma.supportTicket.create({ data: { ...d, userId } });
  }

  async list(q: TicketQuery) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ subject: { contains: q.q, mode: 'insensitive' } }, { user: { email: { contains: q.q, mode: 'insensitive' } } }] } : {}),
    };
    const page = await paginate(q, this.prisma.supportTicket.count({ where }), (skip, take) =>
      this.prisma.supportTicket.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true } } } }),
    );
    return { ...page, items: page.items.map(({ user, ...t }) => ({ ...t, userEmail: user.email })) };
  }

  async setStatus(actor: AuthUser, id: string, status: SupportStatus) {
    const t = await this.prisma.supportTicket.update({ where: { id }, data: { status } });
    await this.audit.log({ actorUserId: actor.id, action: 'support.status', resourceType: 'support_ticket', resourceId: id, metadata: { status } });
    return t;
  }
}

@ApiTags('support')
@ApiBearerAuth()
@Controller()
export class SupportController {
  constructor(private svc: SupportService) {}
  @Post('support/tickets') create(@CurrentUser() u: AuthUser, @Body() d: CreateTicketDto) { return this.svc.create(u.id, d); }
  @PlatformAdminOnly() @Get('admin/support') list(@Query() q: TicketQuery) { return this.svc.list(q); }
  @PlatformAdminOnly() @Patch('admin/support/:id') status(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: TicketStatusDto) { return this.svc.setStatus(u, id, d.status); }
}

@Module({ controllers: [SupportController], providers: [SupportService] })
export class SupportModule {}
