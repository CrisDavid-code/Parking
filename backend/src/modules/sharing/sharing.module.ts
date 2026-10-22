import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsDate, IsEmail, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AccessService, ALL_PERMISSIONS } from '../../common/access.service';
import { AuthUser, CurrentUser, Public, randomToken, sha256 } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { NotificationsService } from '../notifications/notifications.service';

const INVITE_TTL_MS = 7 * 86_400_000;

class CreateShareDto {
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
  @ApiProperty({ enum: ALL_PERMISSIONS, isArray: true }) @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsIn(ALL_PERMISSIONS, { each: true }) permissions: string[];
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() expiresAt?: Date;
}

@Injectable()
export class SharingService {
  constructor(private prisma: PrismaService, private access: AccessService, private audit: AuditService, private notifications: NotificationsService, private cfg: ConfigService) {}

  private status<T extends { status: string; expiresAt: Date | null }>(s: T) {
    return s.status === 'active' && s.expiresAt && s.expiresAt < new Date() ? { ...s, status: 'expired' } : s;
  }

  async list(userId: string) {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.locationShare.findMany({ where: { ownerId: userId }, include: { vehicle: { select: { alias: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.locationShare.findMany({ where: { granteeUserId: userId }, include: { vehicle: { select: { alias: true } } }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { items: [...outgoing.map((s) => ({ ...this.status(s), direction: 'outgoing' })), ...incoming.map((s) => ({ ...this.status(s), direction: 'incoming' }))] };
  }

  async create(userId: string, d: CreateShareDto) {
    await this.access.assertVehicle(userId, d.vehicleId, 'manage');
    if (d.expiresAt && d.expiresAt <= new Date()) throw new BadRequestException('expiresAt must be in the future');
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (me.email === d.email) throw new BadRequestException('Cannot share with yourself');
    const token = randomToken();
    const share = await this.prisma.locationShare.create({
      data: {
        vehicleId: d.vehicleId,
        ownerId: userId,
        granteeEmail: d.email,
        permissions: d.permissions,
        expiresAt: d.expiresAt,
        invitations: { create: { tokenHash: sha256(token), type: 'vehicle_share', email: d.email, invitedById: userId, expiresAt: new Date(Date.now() + INVITE_TTL_MS) } },
      },
    });
    const inviteUrl = `${this.cfg.get('appUrl')}/invite/${token}`;
    const delivery = await this.notifications.sendEmail(d.email, 'Te compartieron un vehículo', `Acepta la invitación: ${inviteUrl}`);
    await this.audit.log({ actorUserId: userId, action: 'share.create', resourceType: 'location_share', resourceId: share.id, metadata: { vehicleId: d.vehicleId, permissions: d.permissions } });
    // The link is returned to the owner so it can be delivered manually while email isn't configured.
    return { share, inviteUrl, emailDelivered: delivery.delivered };
  }

  async revoke(userId: string, id: string) {
    const s = await this.prisma.locationShare.findUnique({ where: { id } });
    if (!s || (s.ownerId !== userId && s.granteeUserId !== userId)) throw new NotFoundException('Share not found');
    await this.prisma.locationShare.update({ where: { id }, data: { status: 'revoked', revokedAt: new Date() } });
    await this.audit.log({ actorUserId: userId, action: 'share.revoke', resourceType: 'location_share', resourceId: id });
  }

  private async invitation(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { share: { include: { vehicle: { select: { alias: true, make: true, model: true } } } }, organization: { select: { id: true, name: true } } },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    return inv;
  }

  async preview(token: string) {
    const inv = await this.invitation(token);
    const inviter = await this.prisma.user.findUnique({ where: { id: inv.invitedById }, select: { fullName: true } });
    return {
      type: inv.type,
      email: inv.email,
      invitedBy: inviter?.fullName ?? null,
      expiresAt: inv.expiresAt,
      expired: inv.expiresAt < new Date(),
      accepted: Boolean(inv.acceptedAt),
      vehicle: inv.share?.vehicle ?? null,
      permissions: inv.share?.permissions ?? null,
      organization: inv.organization ?? null,
      orgRole: inv.orgRole,
    };
  }

  /** Invitations are bound to the invited email: a forwarded link can't be accepted by someone else. */
  async accept(user: AuthUser, token: string) {
    const inv = await this.invitation(token);
    if (inv.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (inv.expiresAt < new Date()) throw new BadRequestException('Invitation expired');
    if (inv.email !== user.email) throw new ForbiddenException('This invitation was sent to a different email');
    if (inv.type === 'vehicle_share' && inv.share) {
      if (inv.share.status === 'revoked') throw new BadRequestException('Share was revoked');
      await this.prisma.$transaction([
        this.prisma.locationShare.update({ where: { id: inv.share.id }, data: { status: 'active', granteeUserId: user.id } }),
        this.prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
      ]);
      await this.notifications.notify(inv.invitedById, 'share.accepted', 'Invitación aceptada', `${user.email} aceptó el acceso a ${inv.share.vehicle.alias}`, { shareId: inv.share.id });
    } else if (inv.type === 'org_member' && inv.organizationId && inv.orgRole) {
      await this.prisma.$transaction([
        this.prisma.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: inv.organizationId, userId: user.id } },
          create: { organizationId: inv.organizationId, userId: user.id, role: inv.orgRole },
          update: { role: inv.orgRole },
        }),
        this.prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
      ]);
    } else throw new BadRequestException('Invalid invitation');
    await this.audit.log({ actorUserId: user.id, organizationId: inv.organizationId, action: `invitation.accept.${inv.type}`, resourceType: 'invitation', resourceId: inv.id });
    return { accepted: true, type: inv.type };
  }
}

@ApiTags('sharing')
@ApiBearerAuth()
@Controller('shares')
export class SharingController {
  constructor(private svc: SharingService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateShareDto) { return this.svc.create(u.id, d); }
  @Delete(':id') @HttpCode(204) revoke(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.revoke(u.id, id); }
  @Public() @Get('invitations/:token') preview(@Param('token') t: string) { return this.svc.preview(t); }
  @Post('invitations/:token/accept') @HttpCode(200) accept(@CurrentUser() u: AuthUser, @Param('token') t: string) { return this.svc.accept(u, t); }
}

/** Generic alias used by the /invite/:token page for both share and organization invitations. */
@ApiTags('sharing')
@ApiBearerAuth()
@Controller('invitations')
export class InvitationsController {
  constructor(private svc: SharingService) {}
  @Public() @Get(':token') preview(@Param('token') t: string) { return this.svc.preview(t); }
  @Post(':token/accept') @HttpCode(200) accept(@CurrentUser() u: AuthUser, @Param('token') t: string) { return this.svc.accept(u, t); }
}

@Module({ controllers: [SharingController, InvitationsController], providers: [SharingService] })
export class SharingModule {}
