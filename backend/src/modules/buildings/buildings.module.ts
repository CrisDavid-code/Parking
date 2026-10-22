import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { Building, Prisma } from '@prisma/client';
import { AuthUser, CurrentUser, PageQuery, paginate } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';

class CreateBuildingDto {
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublic?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
}
class UpdateBuildingDto extends PartialType(CreateBuildingDto) {}
class LevelDto {
  @ApiProperty({ example: 'B2' }) @IsString() @Length(1, 20) code: string;
  @ApiProperty({ example: 'Sótano 2' }) @IsString() @Length(1, 60) name: string;
  @ApiProperty({ description: 'Vertical order; negative for basements', example: -2 }) @IsInt() @Min(-20) @Max(200) ordinal: number;
}
class UpdateLevelDto extends PartialType(LevelDto) {}
class BuildingQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) search?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
}

const strip = (b: Building) => {
  const { geog, ...rest } = b as Building & { geog?: unknown };
  void geog;
  return rest;
};

@Injectable()
export class BuildingsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Public buildings are visible to everyone; org buildings only to their members; admins see all. */
  visibleWhere(user: AuthUser): Prisma.BuildingWhereInput {
    if (user.role === 'PLATFORM_ADMIN') return {};
    return { OR: [{ isPublic: true }, { organization: { members: { some: { userId: user.id } } } }] };
  }

  async assertVisible(user: AuthUser, buildingId: string) {
    const b = await this.prisma.building.findFirst({ where: { id: buildingId, ...this.visibleWhere(user) } });
    if (!b) throw new NotFoundException('Building not found');
    return b;
  }

  /** Map editors: platform admins, or admins of the owning organization. */
  async assertEditor(user: AuthUser, buildingId: string) {
    const b = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!b) throw new NotFoundException('Building not found');
    if (user.role === 'PLATFORM_ADMIN') return b;
    if (b.organizationId) {
      const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: b.organizationId, userId: user.id } } });
      if (m?.role === 'ORG_ADMIN') return b;
    }
    throw new ForbiddenException('Not allowed to edit this building');
  }

  async list(user: AuthUser, q: BuildingQuery) {
    const where: Prisma.BuildingWhereInput = { AND: [this.visibleWhere(user), q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}] };
    const p = await paginate(q, this.prisma.building.count({ where }), (skip, take) =>
      this.prisma.building.findMany({ where, skip, take, orderBy: { name: 'asc' }, include: { levels: { orderBy: { ordinal: 'desc' } } } }),
    );
    return { ...p, items: p.items.map(strip) };
  }

  async get(user: AuthUser, id: string) {
    await this.assertVisible(user, id);
    return strip(await this.prisma.building.findUniqueOrThrow({ where: { id }, include: { levels: { orderBy: { ordinal: 'desc' } }, entryPoints: true } }));
  }

  async create(user: AuthUser, d: CreateBuildingDto) {
    if (d.organizationId) {
      const m = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: d.organizationId, userId: user.id } } });
      if (m?.role !== 'ORG_ADMIN' && user.role !== 'PLATFORM_ADMIN') throw new ForbiddenException('Organization admin required');
    } else if (user.role !== 'PLATFORM_ADMIN') throw new ForbiddenException('Only platform admins can create public buildings');
    if ((d.latitude === undefined) !== (d.longitude === undefined)) throw new BadRequestException('latitude and longitude must be provided together');
    const b = await this.prisma.building.create({ data: { ...d, isPublic: d.isPublic ?? !d.organizationId } });
    await this.audit.log({ actorUserId: user.id, organizationId: d.organizationId, action: 'building.create', resourceType: 'building', resourceId: b.id });
    return strip(b);
  }

  async update(user: AuthUser, id: string, d: UpdateBuildingDto) {
    await this.assertEditor(user, id);
    if (d.organizationId !== undefined && user.role !== 'PLATFORM_ADMIN') throw new ForbiddenException('Only platform admins can move buildings between organizations');
    return strip(await this.prisma.building.update({ where: { id }, data: d }));
  }

  async remove(user: AuthUser, id: string) {
    await this.assertEditor(user, id);
    if (await this.prisma.parkingSession.count({ where: { buildingId: id, status: 'active' } })) throw new BadRequestException('Building has active parking sessions');
    await this.prisma.$transaction([
      this.prisma.parkingSession.updateMany({ where: { buildingId: id }, data: { buildingId: null, levelId: null, parkingPlaceId: null } }),
      this.prisma.building.delete({ where: { id } }),
    ]);
    await this.audit.log({ actorUserId: user.id, action: 'building.delete', resourceType: 'building', resourceId: id });
  }

  async levels(user: AuthUser, id: string) {
    await this.assertVisible(user, id);
    return this.prisma.buildingLevel.findMany({ where: { buildingId: id }, orderBy: { ordinal: 'desc' } });
  }

  async addLevel(user: AuthUser, id: string, d: LevelDto) {
    await this.assertEditor(user, id);
    return this.prisma.buildingLevel.create({ data: { ...d, buildingId: id } });
  }

  async updateLevel(user: AuthUser, id: string, levelId: string, d: Partial<LevelDto>) {
    await this.assertEditor(user, id);
    const r = await this.prisma.buildingLevel.updateMany({ where: { id: levelId, buildingId: id }, data: d });
    if (!r.count) throw new NotFoundException('Level not found');
    return this.prisma.buildingLevel.findUniqueOrThrow({ where: { id: levelId } });
  }

  async removeLevel(user: AuthUser, id: string, levelId: string) {
    await this.assertEditor(user, id);
    if (await this.prisma.navigationNode.count({ where: { levelId, mapVersion: { status: 'published' } } })) throw new BadRequestException('Level is used by the published map');
    const r = await this.prisma.buildingLevel.deleteMany({ where: { id: levelId, buildingId: id } });
    if (!r.count) throw new NotFoundException('Level not found');
  }
}

@ApiTags('buildings')
@ApiBearerAuth()
@Controller('buildings')
export class BuildingsController {
  constructor(private svc: BuildingsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: BuildingQuery) { return this.svc.list(u, q); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateBuildingDto) { return this.svc.create(u, d); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.get(u, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateBuildingDto) { return this.svc.update(u, id, d); }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(u, id); }
  @Get(':id/levels') levels(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.svc.levels(u, id); }
  @Post(':id/levels') addLevel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: LevelDto) { return this.svc.addLevel(u, id, d); }
  @Patch(':id/levels/:levelId') updateLevel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('levelId', ParseUUIDPipe) l: string, @Body() d: UpdateLevelDto) { return this.svc.updateLevel(u, id, l, d); }
  @Delete(':id/levels/:levelId') @HttpCode(204) removeLevel(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('levelId', ParseUUIDPipe) l: string) { return this.svc.removeLevel(u, id, l); }
}

@Module({ controllers: [BuildingsController], providers: [BuildingsService], exports: [BuildingsService] })
export class BuildingsModule {}
