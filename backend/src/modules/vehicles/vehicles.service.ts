import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Vehicle, VehicleLastLocation } from '@prisma/client';
import { AccessService, ALL_PERMISSIONS, VehiclePermission } from '../../common/access.service';

const DEFAULT_MEMBER_PERMISSIONS: VehiclePermission[] = ['view_parking', 'view_location', 'record_parking', 'alerts'];
import { freshness } from '../../common/geo';
import { PageQuery, paginate } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { FilesService } from '../files/files.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AddMemberDto, CreateVehicleDto, UpdateVehicleDto } from './vehicles.dto';

type Row = Vehicle & { lastLocation: VehicleLastLocation | null; _count: { devices: number } };

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private subs: SubscriptionsService,
    private files: FilesService,
    private audit: AuditService,
  ) {}

  private include = { lastLocation: true, _count: { select: { devices: { where: { status: 'active' as const } } } } };

  async present(v: Row) {
    const { photoKey, photoUrl, deletedAt, lastLocation, _count, ...rest } = v;
    void deletedAt;
    const trackingStatus = !_count.devices ? 'none' : !lastLocation ? 'offline' : freshness(lastLocation.capturedAt) === 'stale' ? 'stale' : 'live';
    return { ...rest, photoUrl: photoKey ? await this.files.signedUrl(photoKey) : photoUrl, trackingStatus };
  }

  async list(userId: string, q: PageQuery, organizationId?: string) {
    if (organizationId) await this.access.assertOrgRole(userId, organizationId);
    const ids = await this.access.accessibleVehicleIds(userId, 'view_parking');
    const where: Prisma.VehicleWhereInput = {
      id: { in: ids },
      ...(organizationId ? { organizationId } : {}),
      ...(q.q ? { OR: ['alias', 'make', 'model', 'plate'].map((f) => ({ [f]: { contains: q.q, mode: 'insensitive' } })) } : {}),
    };
    const page = await paginate(q, this.prisma.vehicle.count({ where }), (skip, take) =>
      this.prisma.vehicle.findMany({ where, skip, take, include: this.include, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }),
    );
    return { ...page, items: await Promise.all(page.items.map((v) => this.present(v))) };
  }

  async get(userId: string, id: string) {
    await this.access.assertVehicle(userId, id, 'view_parking');
    const v = await this.prisma.vehicle.findUniqueOrThrow({ where: { id }, include: this.include });
    return { ...(await this.present(v)), permissions: [...(await this.access.vehiclePermissions(userId, id))] };
  }

  async create(userId: string, d: CreateVehicleDto, organizationId?: string) {
    if (organizationId) {
      await this.access.assertOrgRole(userId, organizationId, ['ORG_ADMIN']);
      await this.subs.assertWithinLimit({ organizationId }, 'vehicles', await this.prisma.vehicle.count({ where: { organizationId, deletedAt: null } }));
    } else {
      await this.subs.assertWithinLimit({ userId }, 'vehicles', await this.prisma.vehicle.count({ where: { ownerId: userId, organizationId: null, deletedAt: null } }));
    }
    const first = !organizationId && !(await this.prisma.vehicle.count({ where: { ownerId: userId, deletedAt: null } }));
    const v = await this.prisma.vehicle.create({ data: { ...d, ownerId: userId, organizationId, isPrimary: first }, include: this.include });
    await this.audit.log({ actorUserId: userId, organizationId, action: 'vehicle.create', resourceType: 'vehicle', resourceId: v.id });
    return this.present(v);
  }

  async update(userId: string, id: string, d: UpdateVehicleDto) {
    await this.access.assertVehicle(userId, id, 'manage');
    const current = await this.prisma.vehicle.findUniqueOrThrow({ where: { id } });
    // An uploaded photo wins; the client echoing back its signed URL must not overwrite it.
    if (current.photoKey) delete d.photoUrl;
    return this.present(await this.prisma.vehicle.update({ where: { id }, data: d, include: this.include }));
  }

  async remove(userId: string, id: string) {
    await this.access.assertVehicle(userId, id, 'manage');
    const v = await this.prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date(), isPrimary: false } });
    await this.prisma.trackingDevice.updateMany({ where: { vehicleId: id }, data: { vehicleId: null } });
    await this.audit.log({ actorUserId: userId, organizationId: v.organizationId, action: 'vehicle.delete', resourceType: 'vehicle', resourceId: id });
  }

  async setPrimary(userId: string, id: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
    if (!v) throw new NotFoundException('Vehicle not found');
    if (v.ownerId !== userId) throw new ForbiddenException('Only the owner can set the primary vehicle');
    await this.prisma.$transaction([
      this.prisma.vehicle.updateMany({ where: { ownerId: userId }, data: { isPrimary: false } }),
      this.prisma.vehicle.update({ where: { id }, data: { isPrimary: true } }),
    ]);
    return this.get(userId, id);
  }

  async uploadPhoto(userId: string, id: string, file?: Express.Multer.File) {
    await this.access.assertVehicle(userId, id, 'manage');
    const { key } = await this.files.uploadImage(`vehicles/${id}`, file);
    return this.present(await this.prisma.vehicle.update({ where: { id }, data: { photoKey: key }, include: this.include }));
  }

  async members(userId: string, id: string) {
    await this.access.assertVehicle(userId, id, 'manage');
    const v = await this.prisma.vehicle.findUniqueOrThrow({ where: { id }, include: { owner: { select: { id: true, email: true, fullName: true } } } });
    const ms = await this.prisma.vehicleMember.findMany({ where: { vehicleId: id }, include: { user: { select: { id: true, email: true, fullName: true } } } });
    const items = [
      { id: v.owner.id, userId: v.owner.id, email: v.owner.email, fullName: v.owner.fullName, role: 'owner', permissions: ALL_PERMISSIONS as string[] },
      ...ms.map((m) => ({ id: m.userId, userId: m.userId, email: m.user.email, fullName: m.user.fullName, role: 'member', permissions: m.permissions })),
    ];
    return { items, total: items.length, page: 1, pageSize: items.length };
  }

  async addMember(userId: string, id: string, d: AddMemberDto) {
    await this.access.assertVehicle(userId, id, 'manage');
    const target = await this.prisma.user.findFirst({ where: { email: d.email, deletedAt: null } });
    if (!target) throw new NotFoundException('No user with that email; use /shares to invite by email');
    if (target.id === (await this.prisma.vehicle.findUniqueOrThrow({ where: { id } })).ownerId) throw new BadRequestException('The owner is already a member');
    const owner = await this.prisma.vehicle.findUniqueOrThrow({ where: { id } });
    await this.subs.assertWithinLimit(owner.organizationId ? { organizationId: owner.organizationId } : { userId: owner.ownerId }, 'members', await this.prisma.vehicleMember.count({ where: { vehicleId: id } }) + 1);
    await this.prisma.vehicleMember.upsert({
      where: { vehicleId_userId: { vehicleId: id, userId: target.id } },
      create: { vehicleId: id, userId: target.id, permissions: d.permissions ?? DEFAULT_MEMBER_PERMISSIONS },
      update: { permissions: d.permissions ?? DEFAULT_MEMBER_PERMISSIONS },
    });
    await this.audit.log({ actorUserId: userId, action: 'vehicle.member_add', resourceType: 'vehicle', resourceId: id, metadata: { memberId: target.id, permissions: d.permissions } });
    return this.members(userId, id);
  }

  async removeMember(userId: string, id: string, memberId: string) {
    await this.access.assertVehicle(userId, id, 'manage');
    await this.prisma.vehicleMember.deleteMany({ where: { vehicleId: id, userId: memberId } });
    await this.audit.log({ actorUserId: userId, action: 'vehicle.member_remove', resourceType: 'vehicle', resourceId: id, metadata: { memberId } });
  }
}
