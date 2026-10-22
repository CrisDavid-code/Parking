import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true, orgMembers: { include: { organization: { select: { id: true, name: true, slug: true } } } } },
    });
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      accountType: u.accountType,
      profile: u.profile,
      organizations: u.orgMembers.map((m) => ({ ...m.organization, role: m.role })),
      createdAt: u.createdAt,
    };
  }

  async update(userId: string, d: { fullName?: string; locale?: string; timezone?: string; currency?: string; phone?: string; locationPrefs?: Prisma.InputJsonValue; onboardingDone?: boolean }) {
    const { fullName, ...profile } = d;
    await this.prisma.user.update({
      where: { id: userId },
      data: { fullName, profile: { upsert: { create: profile, update: profile } } },
    });
    return this.me(userId);
  }

  /** GDPR-style export of everything we hold about the user. */
  async export(userId: string) {
    const [user, vehicles, parking, shares, notifications, devices, navigation] = await Promise.all([
      this.me(userId),
      this.prisma.vehicle.findMany({ where: { ownerId: userId } }),
      this.prisma.parkingSession.findMany({ where: { vehicle: { ownerId: userId } }, include: { media: { select: { id: true, kind: true, createdAt: true } } } }),
      this.prisma.locationShare.findMany({ where: { OR: [{ ownerId: userId }, { granteeUserId: userId }] } }),
      this.prisma.notification.findMany({ where: { userId } }),
      this.prisma.trackingDevice.findMany({ where: { ownerId: userId }, select: { id: true, name: true, type: true, serial: true, status: true, vehicleId: true, createdAt: true } }),
      this.prisma.pedestrianNavigationSession.findMany({ where: { userId }, include: { estimates: true } }),
    ]);
    const locationEvents = await this.prisma.locationEvent.findMany({ where: { vehicle: { ownerId: userId } }, orderBy: { capturedAt: 'asc' } });
    await this.audit.log({ actorUserId: userId, action: 'user.export', resourceType: 'user', resourceId: userId });
    return { exportedAt: new Date(), user, vehicles, parking, locationEvents, shares, notifications, devices, navigation };
  }

  /** Deletes personal data: location history & parking are removed, account is anonymised (audit trail kept). */
  async delete(userId: string, password: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(u.passwordHash, password))) throw new UnauthorizedException('Invalid password');
    await this.prisma.$transaction([
      this.prisma.vehicle.updateMany({ where: { ownerId: userId, organizationId: null }, data: { deletedAt: new Date(), plate: null, photoKey: null } }),
      this.prisma.locationEvent.deleteMany({ where: { vehicle: { ownerId: userId, organizationId: null } } }),
      this.prisma.vehicleLastLocation.deleteMany({ where: { vehicle: { ownerId: userId, organizationId: null } } }),
      this.prisma.parkingSession.deleteMany({ where: { vehicle: { ownerId: userId, organizationId: null } } }),
      this.prisma.locationShare.updateMany({ where: { OR: [{ ownerId: userId }, { granteeUserId: userId }] }, data: { status: 'revoked', revokedAt: new Date() } }),
      this.prisma.trackingDevice.updateMany({ where: { ownerId: userId }, data: { status: 'revoked' } }),
      this.prisma.deviceCredential.updateMany({ where: { device: { ownerId: userId } }, data: { revokedAt: new Date() } }),
      this.prisma.authSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.pedestrianNavigationSession.deleteMany({ where: { userId } }),
      this.prisma.organizationMember.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), email: `deleted+${userId}@invalid.local`, fullName: 'Usuario eliminado', passwordHash: '!' } }),
    ]);
    await this.audit.log({ actorUserId: userId, action: 'user.delete', resourceType: 'user', resourceId: userId });
  }
}
