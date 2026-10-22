import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Geofence } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser, CurrentUser, PageQuery, paginate } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { NotificationsService } from '../notifications/notifications.service';

class CreateGeofenceDto {
  @ApiProperty() @IsString() @Length(1, 80) name: string;
  @ApiProperty() @IsLatitude() centerLat: number;
  @ApiProperty() @IsLongitude() centerLng: number;
  @ApiProperty() @IsNumber() @Min(10) @Max(100_000) radiusMeters: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateGeofenceDto extends PartialType(CreateGeofenceDto) {}

const present = (g: Geofence) => {
  const { geog, ...rest } = g as Geofence & { geog?: unknown };
  void geog;
  return { ...rest, type: 'circle' as const };
};

@Injectable()
export class GeofencesService {
  constructor(private prisma: PrismaService, private access: AccessService, private audit: AuditService, private notifications: NotificationsService) {}

  async list(userId: string, orgId: string, q: PageQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where = { organizationId: orgId };
    const p = await paginate(q, this.prisma.geofence.count({ where }), (skip, take) => this.prisma.geofence.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }));
    return { ...p, items: p.items.map(present) };
  }

  async create(userId: string, orgId: string, d: CreateGeofenceDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    const g = await this.prisma.geofence.create({ data: { ...d, organizationId: orgId } });
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'geofence.create', resourceType: 'geofence', resourceId: g.id });
    return present(g);
  }

  private async own(orgId: string, id: string) {
    const g = await this.prisma.geofence.findFirst({ where: { id, organizationId: orgId } });
    if (!g) throw new NotFoundException('Geofence not found');
    return g;
  }

  async update(userId: string, orgId: string, id: string, d: UpdateGeofenceDto) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    await this.own(orgId, id);
    return present(await this.prisma.geofence.update({ where: { id }, data: d }));
  }

  async remove(userId: string, orgId: string, id: string) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN']);
    await this.own(orgId, id);
    await this.prisma.geofence.delete({ where: { id } });
    await this.audit.log({ actorUserId: userId, organizationId: orgId, action: 'geofence.delete', resourceType: 'geofence', resourceId: id });
  }

  async events(userId: string, orgId: string, q: PageQuery) {
    await this.access.assertOrgRole(userId, orgId, ['ORG_ADMIN', 'ORG_MEMBER']);
    const where = { geofence: { organizationId: orgId } };
    return paginate(q, this.prisma.geofenceEvent.count({ where }), (skip, take) =>
      this.prisma.geofenceEvent.findMany({ where, skip, take, orderBy: { occurredAt: 'desc' }, include: { geofence: { select: { name: true } }, vehicle: { select: { alias: true, plate: true } } } }),
    );
  }

  /**
   * Evaluates enter/exit transitions for an org vehicle using PostGIS ST_DWithin.
   * State = type of the last event per (geofence, vehicle); only transitions are recorded.
   */
  async evaluate(vehicleId: string, organizationId: string, lat: number, lng: number, at: Date) {
    const fences = await this.prisma.$queryRaw<{ id: string; name: string; inside: boolean }[]>`
      SELECT id, name, ST_DWithin(geog, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, radius_meters) AS inside
      FROM geofences WHERE organization_id = ${organizationId}::uuid AND active = true`;
    const transitions: { geofenceId: string; type: 'enter' | 'exit' }[] = [];
    for (const f of fences) {
      const last = await this.prisma.geofenceEvent.findFirst({ where: { geofenceId: f.id, vehicleId }, orderBy: { occurredAt: 'desc' } });
      const wasInside = last?.type === 'enter';
      if (f.inside === wasInside) continue;
      const type = f.inside ? 'enter' : 'exit';
      // A vehicle first seen outside a fence is not an "exit".
      if (type === 'exit' && !last) continue;
      await this.prisma.geofenceEvent.create({ data: { geofenceId: f.id, vehicleId, type, latitude: lat, longitude: lng, occurredAt: at } });
      transitions.push({ geofenceId: f.id, type });
      const admins = await this.prisma.organizationMember.findMany({ where: { organizationId, role: { in: ['ORG_ADMIN', 'ORG_MEMBER'] } } });
      await Promise.all(admins.map((a) => this.notifications.notify(a.userId, `geofence.${type}`, type === 'enter' ? `Entrada a ${f.name}` : `Salida de ${f.name}`, `Vehículo ${vehicleId}`, { geofenceId: f.id, vehicleId, organizationId })));
    }
    return transitions;
  }
}

@ApiTags('geofences')
@ApiBearerAuth()
@Controller('organizations/:orgId/geofences')
export class GeofencesController {
  constructor(private svc: GeofencesService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Param('orgId', ParseUUIDPipe) o: string, @Query() q: PageQuery) { return this.svc.list(u.id, o, q); }
  @Get('events') events(@CurrentUser() u: AuthUser, @Param('orgId', ParseUUIDPipe) o: string, @Query() q: PageQuery) { return this.svc.events(u.id, o, q); }
  @Post() create(@CurrentUser() u: AuthUser, @Param('orgId', ParseUUIDPipe) o: string, @Body() d: CreateGeofenceDto) { return this.svc.create(u.id, o, d); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('orgId', ParseUUIDPipe) o: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateGeofenceDto) { return this.svc.update(u.id, o, id, d); }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param('orgId', ParseUUIDPipe) o: string, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(u.id, o, id); }
}

@Module({ controllers: [GeofencesController], providers: [GeofencesService], exports: [GeofencesService] })
export class GeofencesModule {}
