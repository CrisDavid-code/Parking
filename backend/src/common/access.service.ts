import { ForbiddenException, Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** record_parking = may create/update/end parking sessions (owners, members, assigned drivers). */
export type VehiclePermission = 'view_parking' | 'view_location' | 'record_parking' | 'alerts' | 'manage';
export const ALL_PERMISSIONS: VehiclePermission[] = ['view_parking', 'view_location', 'record_parking', 'alerts', 'manage'];

/**
 * Single place that answers "may user X do Y on resource Z". Every service routes through here
 * so ownership/sharing/org rules can't drift between modules.
 */
@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  /** Returns the permissions the user holds on a vehicle (empty = no access). */
  async vehiclePermissions(userId: string, vehicleId: string): Promise<Set<VehiclePermission>> {
    const v = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
      select: {
        ownerId: true,
        organizationId: true,
        members: { where: { userId }, select: { permissions: true } },
        shares: {
          where: { granteeUserId: userId, status: 'active', revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { permissions: true },
        },
      },
    });
    if (!v) return new Set();
    if (v.ownerId === userId) return new Set(ALL_PERMISSIONS);
    const perms = new Set<VehiclePermission>();
    for (const m of v.members) m.permissions.forEach((p) => perms.add(p as VehiclePermission));
    for (const s of v.shares) s.permissions.forEach((p) => perms.add(p as VehiclePermission));
    if (v.organizationId) {
      const om = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: v.organizationId, userId } } });
      if (om?.role === 'ORG_ADMIN') ALL_PERMISSIONS.forEach((p) => perms.add(p));
      else if (om?.role === 'ORG_MEMBER') ['view_parking', 'view_location', 'record_parking', 'alerts'].forEach((p) => perms.add(p as VehiclePermission));
      else if (om?.role === 'DRIVER') {
        const assigned = await this.prisma.vehicleAssignment.count({
          where: { vehicleId, driver: { userId }, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
        });
        if (assigned) ['view_parking', 'view_location', 'record_parking'].forEach((p) => perms.add(p as VehiclePermission));
      }
    }
    return perms;
  }

  /** Throws 404 (not 403) when the user has no access at all, so resource existence isn't leaked. */
  async assertVehicle(userId: string, vehicleId: string, perm: VehiclePermission): Promise<void> {
    const perms = await this.vehiclePermissions(userId, vehicleId);
    if (perms.size === 0) throw new NotFoundException('Vehicle not found');
    if (!perms.has(perm)) throw new ForbiddenException(`Missing permission: ${perm}`);
  }

  /** IDs of vehicles the user can see with the given permission (owned, member, shared, org). */
  async accessibleVehicleIds(userId: string, perm: VehiclePermission): Promise<string[]> {
    const now = new Date();
    const candidates = await this.prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          { shares: { some: { granteeUserId: userId, status: 'active', revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } },
          { organization: { members: { some: { userId } } } },
        ],
      },
      select: { id: true },
    });
    const out: string[] = [];
    // ponytail: per-vehicle permission check is N queries; fine for personal/fleet sizes, batch it if fleets reach thousands.
    for (const c of candidates) if ((await this.vehiclePermissions(userId, c.id)).has(perm)) out.push(c.id);
    return out;
  }

  async assertOrgRole(userId: string, organizationId: string, roles: OrgRole[] = ['ORG_ADMIN', 'ORG_MEMBER', 'DRIVER']): Promise<OrgRole> {
    const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!m) throw new NotFoundException('Organization not found');
    if (!roles.includes(m.role)) throw new ForbiddenException('Insufficient organization role');
    return m.role;
  }
}

@Global()
@Module({ providers: [AccessService], exports: [AccessService] })
export class AccessModule {}
