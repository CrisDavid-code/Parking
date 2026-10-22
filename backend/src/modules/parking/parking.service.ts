import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ParkingMedia, ParkingSession, Prisma } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { paginate } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { FilesService } from '../files/files.module';
import { ActiveQuery, CreateParkingDto, ParkingQuery, UpdateParkingDto } from './parking.dto';

const CLOCK_SKEW_MS = 2 * 60_000;

@Injectable()
export class ParkingService {
  constructor(private prisma: PrismaService, private access: AccessService, private files: FilesService, private audit: AuditService) {}

  private async present(p: ParkingSession & { media: ParkingMedia[] }) {
    const { media, ...rest } = p;
    return { ...rest, media: await Promise.all(media.map(async (m) => ({ id: m.id, kind: m.kind, url: await this.files.signedUrl(m.storageKey), createdAt: m.createdAt }))) };
  }

  /** Validates coordinates come in pairs and building/level/place references are consistent. */
  private async normalise(d: UpdateParkingDto): Promise<Prisma.ParkingSessionUncheckedUpdateInput> {
    if ((d.latitude === undefined) !== (d.longitude === undefined)) throw new BadRequestException('latitude and longitude must be provided together');
    if (d.startedAt && d.startedAt.getTime() > Date.now() + CLOCK_SKEW_MS) throw new BadRequestException('startedAt cannot be in the future');
    const out: Prisma.ParkingSessionUncheckedUpdateInput = { ...d };
    if (d.levelId) {
      const level = await this.prisma.buildingLevel.findUnique({ where: { id: d.levelId } });
      if (!level) throw new BadRequestException('Unknown levelId');
      if (d.buildingId && level.buildingId !== d.buildingId) throw new BadRequestException('levelId does not belong to buildingId');
      out.buildingId = level.buildingId;
      out.levelLabel = d.levelLabel ?? level.code;
      if (d.spot) {
        const place = await this.prisma.parkingPlace.findUnique({ where: { levelId_code: { levelId: level.id, code: d.spot } } });
        out.parkingPlaceId = place?.id ?? null;
      }
    } else if (d.buildingId && !(await this.prisma.building.findUnique({ where: { id: d.buildingId } }))) {
      throw new BadRequestException('Unknown buildingId');
    }
    return out;
  }

  async create(userId: string, d: CreateParkingDto) {
    await this.access.assertVehicle(userId, d.vehicleId, 'record_parking');
    const data = (await this.normalise(d)) as Prisma.ParkingSessionUncheckedCreateInput;
    if (!d.source) data.source = d.latitude !== undefined ? 'gps' : 'manual';
    // A vehicle can only be parked in one place: close any active session first.
    const [, created] = await this.prisma.$transaction([
      this.prisma.parkingSession.updateMany({ where: { vehicleId: d.vehicleId, status: 'active' }, data: { status: 'ended', endedAt: new Date() } }),
      this.prisma.parkingSession.create({ data: { ...data, vehicleId: d.vehicleId, createdById: userId }, include: { media: true } }),
    ]);
    return this.present(created);
  }

  private async load(userId: string, id: string, perm: 'view_parking' | 'record_parking' | 'manage') {
    const p = await this.prisma.parkingSession.findUnique({ where: { id }, include: { media: true } });
    if (!p) throw new NotFoundException('Parking session not found');
    await this.access.assertVehicle(userId, p.vehicleId, perm);
    return p;
  }

  async get(userId: string, id: string) {
    return this.present(await this.load(userId, id, 'view_parking'));
  }

  async list(userId: string, q: ParkingQuery) {
    let vehicleIds: string[];
    if (q.vehicleId) {
      await this.access.assertVehicle(userId, q.vehicleId, 'view_parking');
      vehicleIds = [q.vehicleId];
    } else vehicleIds = await this.access.accessibleVehicleIds(userId, 'view_parking');
    const where: Prisma.ParkingSessionWhereInput = { vehicleId: { in: vehicleIds }, ...(q.status ? { status: q.status } : {}) };
    const page = await paginate(q, this.prisma.parkingSession.count({ where }), (skip, take) =>
      this.prisma.parkingSession.findMany({ where, skip, take, orderBy: { startedAt: 'desc' }, include: { media: true } }),
    );
    return { ...page, items: await Promise.all(page.items.map((p) => this.present(p))) };
  }

  async active(userId: string, q: ActiveQuery) {
    const page = await this.list(userId, { ...q, status: 'active', page: 1, pageSize: 100 });
    return page.items;
  }

  async update(userId: string, id: string, d: UpdateParkingDto) {
    await this.load(userId, id, 'record_parking');
    return this.present(await this.prisma.parkingSession.update({ where: { id }, data: await this.normalise(d), include: { media: true } }));
  }

  async end(userId: string, id: string) {
    const p = await this.load(userId, id, 'record_parking');
    if (p.status === 'ended') throw new BadRequestException('Parking session already ended');
    return this.present(await this.prisma.parkingSession.update({ where: { id }, data: { status: 'ended', endedAt: new Date() }, include: { media: true } }));
  }

  async remove(userId: string, id: string) {
    const p = await this.load(userId, id, 'manage');
    await this.prisma.parkingSession.delete({ where: { id } });
    await this.audit.log({ actorUserId: userId, action: 'parking.delete', resourceType: 'parking_session', resourceId: id, metadata: { vehicleId: p.vehicleId } });
  }

  async addMedia(userId: string, id: string, file?: Express.Multer.File, kind = 'photo') {
    const p = await this.load(userId, id, 'record_parking');
    const up = await this.files.uploadImage(`parking/${p.vehicleId}/${id}`, file);
    await this.prisma.parkingMedia.create({ data: { parkingSessionId: id, storageKey: up.key, mimeType: up.mime, sizeBytes: up.size, kind } });
    return this.get(userId, id);
  }

  async removeMedia(userId: string, id: string, mediaId: string) {
    await this.load(userId, id, 'record_parking');
    await this.prisma.parkingMedia.deleteMany({ where: { id: mediaId, parkingSessionId: id } });
  }
}
