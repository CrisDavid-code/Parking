import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { EdgeType, NodeType } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';
import { BuildingsModule, BuildingsService } from '../buildings/buildings.module';
import { GEdge, GNode } from '../navigation/graph';

class ZoneIn {
  @ApiProperty() @IsString() @Length(1, 60) key: string;
  @ApiProperty() @IsString() @Length(1, 20) levelCode: string;
  @ApiProperty() @IsString() @Length(1, 80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() restricted?: boolean;
  @ApiPropertyOptional({ description: '[[x,y],...] polygon in level meters' }) @IsOptional() @IsArray() polygon?: number[][];
}
class NodeIn {
  @ApiProperty() @IsString() @Length(1, 60) key: string;
  @ApiProperty() @IsString() @Length(1, 20) levelCode: string;
  @ApiProperty() @IsNumber() @Min(-10_000) @Max(10_000) x: number;
  @ApiProperty() @IsNumber() @Min(-10_000) @Max(10_000) y: number;
  @ApiProperty({ enum: NodeType }) @IsEnum(NodeType) type: NodeType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() zoneKey?: string;
}
class EdgeIn {
  @ApiProperty() @IsString() from: string;
  @ApiProperty() @IsString() to: string;
  @ApiPropertyOptional({ description: 'Defaults to euclidean distance for walk edges' }) @IsOptional() @IsNumber() @Min(0) @Max(10_000) distanceMeters?: number;
  @ApiPropertyOptional({ enum: EdgeType }) @IsOptional() @IsEnum(EdgeType) type?: EdgeType;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() accessible?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() bidirectional?: boolean;
  @ApiPropertyOptional({ enum: ['open', 'closed'] }) @IsOptional() @IsIn(['open', 'closed']) status?: string;
}
class PlaceIn {
  @ApiProperty() @IsString() levelCode: string;
  @ApiProperty() @IsString() @Length(1, 40) code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) row?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) zone?: string;
  @ApiProperty() @IsString() nodeKey: string;
}
class LandmarkIn {
  @ApiProperty() @IsString() levelCode: string;
  @ApiProperty() @IsString() @Length(1, 80) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiProperty() @IsString() nodeKey: string;
}
class EntryIn {
  @ApiProperty() @IsString() levelCode: string;
  @ApiProperty() @IsString() @Length(1, 80) name: string;
  @ApiProperty() @IsString() nodeKey: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() longitude?: number;
}
export class MapVersionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @ApiPropertyOptional({ type: [ZoneIn] }) @IsOptional() @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => ZoneIn) zones: ZoneIn[] = [];
  @ApiProperty({ type: [NodeIn] }) @IsArray() @ArrayMaxSize(20000) @ValidateNested({ each: true }) @Type(() => NodeIn) nodes: NodeIn[];
  @ApiProperty({ type: [EdgeIn] }) @IsArray() @ArrayMaxSize(50000) @ValidateNested({ each: true }) @Type(() => EdgeIn) edges: EdgeIn[];
  @ApiPropertyOptional({ type: [PlaceIn] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlaceIn) places: PlaceIn[] = [];
  @ApiPropertyOptional({ type: [LandmarkIn] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LandmarkIn) landmarks: LandmarkIn[] = [];
  @ApiPropertyOptional({ type: [EntryIn] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EntryIn) entryPoints: EntryIn[] = [];
}
class EditorNode {
  @ApiProperty() @IsString() @Length(1, 60) id: string;
  @ApiProperty() @IsString() levelId: string;
  @ApiProperty() @IsNumber() @Min(-10_000) @Max(10_000) x: number;
  @ApiProperty() @IsNumber() @Min(-10_000) @Max(10_000) y: number;
  @ApiProperty({ enum: NodeType }) @IsEnum(NodeType) type: NodeType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) label?: string;
}
class EditorEdge {
  @ApiProperty() @IsString() fromNodeId: string;
  @ApiProperty() @IsString() toNodeId: string;
  @ApiProperty() @IsNumber() @Min(0) @Max(10_000) distanceMeters: number;
  @ApiProperty({ enum: EdgeType }) @IsEnum(EdgeType) type: EdgeType;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() accessible?: boolean;
  @ApiPropertyOptional({ enum: ['open', 'closed'] }) @IsOptional() @IsIn(['open', 'closed']) status?: string;
}
/** Whole-map payload from the admin editor (node ids are existing UUIDs or temporary ids). */
export class EditorMapDto {
  @ApiProperty({ type: [EditorNode] }) @IsArray() @ArrayMaxSize(20000) @ValidateNested({ each: true }) @Type(() => EditorNode) nodes: EditorNode[];
  @ApiProperty({ type: [EditorEdge] }) @IsArray() @ArrayMaxSize(50000) @ValidateNested({ each: true }) @Type(() => EditorEdge) edges: EditorEdge[];
  @ApiProperty({ description: 'Version the editor started from (0 if none); stale saves get 409' }) @IsInt() @Min(0) version: number;
}
class EdgeStatusDto { @ApiProperty({ enum: ['open', 'closed'] }) @IsIn(['open', 'closed']) status: 'open' | 'closed' }

const VERTICAL_NODE: Record<string, NodeType> = { elevator: 'elevator', stairs: 'stairs', ramp: 'ramp' };

/** Static validation of a map draft. Returns human-readable errors (empty = valid). */
export function validateMap(d: MapVersionDto, levelCodes: Set<string>): string[] {
  const errors: string[] = [];
  const nodes = new Map<string, NodeIn>();
  const zoneKeys = new Set(d.zones.map((z) => z.key));
  for (const z of d.zones) if (!levelCodes.has(z.levelCode)) errors.push(`zone ${z.key}: unknown level ${z.levelCode}`);
  for (const n of d.nodes) {
    if (nodes.has(n.key)) errors.push(`duplicate node key ${n.key}`);
    nodes.set(n.key, n);
    if (!levelCodes.has(n.levelCode)) errors.push(`node ${n.key}: unknown level ${n.levelCode}`);
    if (n.zoneKey && !zoneKeys.has(n.zoneKey)) errors.push(`node ${n.key}: unknown zone ${n.zoneKey}`);
  }
  d.edges.forEach((e, i) => {
    const a = nodes.get(e.from);
    const b = nodes.get(e.to);
    if (!a || !b) return errors.push(`edge #${i}: unknown node ${!a ? e.from : e.to}`);
    if (e.from === e.to) return errors.push(`edge #${i}: self-loop`);
    const type = e.type ?? 'walk';
    if (a.levelCode !== b.levelCode) {
      // Cross-level movement must be an explicit vertical connector between matching connector nodes.
      if (type === 'walk') errors.push(`edge #${i}: ${e.from}->${e.to} crosses levels but is a walk edge`);
      else if (a.type !== VERTICAL_NODE[type] || b.type !== VERTICAL_NODE[type]) errors.push(`edge #${i}: ${type} edge must connect ${type} nodes`);
      if (e.distanceMeters === undefined) errors.push(`edge #${i}: vertical edges need an explicit distanceMeters (cost)`);
    } else if (type !== 'walk' && type !== 'ramp') errors.push(`edge #${i}: ${type} edge must connect different levels`);
  });
  for (const p of [...d.places, ...d.landmarks, ...d.entryPoints]) {
    const n = nodes.get(p.nodeKey);
    if (!n) errors.push(`${'code' in p ? 'place ' + p.code : p.name}: unknown node ${p.nodeKey}`);
    else if (n.levelCode !== p.levelCode) errors.push(`${'code' in p ? 'place ' + p.code : p.name}: node ${p.nodeKey} is on level ${n.levelCode}, not ${p.levelCode}`);
  }
  return errors;
}

export interface LoadedGraph { mapVersionId: string; version: number; nodes: Map<string, GNode>; edges: GEdge[] }

@Injectable()
export class IndoorMapsService {
  constructor(private prisma: PrismaService, private buildings: BuildingsService, private audit: AuditService) {}

  private async version(buildingId: string, version?: number) {
    const v = version
      ? await this.prisma.indoorMapVersion.findUnique({ where: { buildingId_version: { buildingId, version } } })
      : await this.prisma.indoorMapVersion.findFirst({ where: { buildingId, status: 'published' } });
    if (!v) throw new NotFoundException(version ? 'Map version not found' : 'No published indoor map for this building');
    return v;
  }

  /** Graph used by the router. Returns null when the building has no published map. */
  async loadGraph(buildingId: string): Promise<LoadedGraph | null> {
    const v = await this.prisma.indoorMapVersion.findFirst({ where: { buildingId, status: 'published' } });
    if (!v) return null;
    const [nodes, edges] = await Promise.all([
      this.prisma.navigationNode.findMany({ where: { mapVersionId: v.id }, include: { level: true, zone: true } }),
      this.prisma.navigationEdge.findMany({ where: { mapVersionId: v.id } }),
    ]);
    return {
      mapVersionId: v.id,
      version: v.version,
      nodes: new Map(nodes.map((n) => [n.id, { id: n.id, levelId: n.levelId, levelCode: n.level.code, levelOrdinal: n.level.ordinal, x: n.x, y: n.y, type: n.type, label: n.label, restricted: n.zone?.restricted ?? false }])),
      edges: edges.map((e) => ({ id: e.id, from: e.fromNodeId, to: e.toNodeId, distanceMeters: e.distanceMeters, type: e.type, accessible: e.accessible, bidirectional: e.bidirectional, status: e.status })),
    };
  }

  async get(user: AuthUser, buildingId: string, version?: number) {
    const building = await this.buildings.assertVisible(user, buildingId);
    if (version) await this.buildings.assertEditor(user, buildingId);
    const v = await this.version(buildingId, version);
    const [levels, nodes, edges, zones, places, landmarks, entryPoints] = await Promise.all([
      this.prisma.buildingLevel.findMany({ where: { buildingId }, orderBy: { ordinal: 'desc' } }),
      this.prisma.navigationNode.findMany({ where: { mapVersionId: v.id }, select: { id: true, key: true, levelId: true, zoneId: true, x: true, y: true, type: true, label: true } }),
      this.prisma.navigationEdge.findMany({ where: { mapVersionId: v.id }, select: { id: true, fromNodeId: true, toNodeId: true, distanceMeters: true, type: true, accessible: true, bidirectional: true, status: true } }),
      this.prisma.indoorZone.findMany({ where: { mapVersionId: v.id } }),
      this.prisma.parkingPlace.findMany({ where: { node: { mapVersionId: v.id } } }),
      this.prisma.indoorLandmark.findMany({ where: { node: { mapVersionId: v.id } } }),
      this.prisma.parkingEntryPoint.findMany({ where: { node: { mapVersionId: v.id } } }),
    ]);
    return {
      building: { id: building.id, name: building.name, address: building.address },
      version: v.version,
      status: v.status,
      publishedAt: v.publishedAt,
      levels: levels.map((l) => ({ id: l.id, code: l.code, name: l.name, ordinal: l.ordinal })),
      zones, nodes, edges, places, landmarks, entryPoints,
    };
  }

  async versions(user: AuthUser, buildingId: string) {
    await this.buildings.assertEditor(user, buildingId);
    return this.prisma.indoorMapVersion.findMany({ where: { buildingId }, orderBy: { version: 'desc' }, include: { _count: { select: { nodes: true, edges: true } } } });
  }

  async createVersion(user: AuthUser, buildingId: string, d: MapVersionDto) {
    await this.buildings.assertEditor(user, buildingId);
    const levels = await this.prisma.buildingLevel.findMany({ where: { buildingId } });
    const errors = validateMap(d, new Set(levels.map((l) => l.code)));
    if (errors.length) throw new BadRequestException({ message: `Invalid indoor map: ${errors.slice(0, 3).join('; ')}`, errors: errors.slice(0, 100) });
    const levelId = new Map(levels.map((l) => [l.code, l.id]));
    const last = await this.prisma.indoorMapVersion.findFirst({ where: { buildingId }, orderBy: { version: 'desc' } });
    const result = await this.prisma.$transaction(async (tx) => {
      const v = await tx.indoorMapVersion.create({ data: { buildingId, version: (last?.version ?? 0) + 1, notes: d.notes, createdById: user.id } });
      const zoneId = new Map<string, string>();
      for (const z of d.zones) {
        const row = await tx.indoorZone.create({ data: { mapVersionId: v.id, levelId: levelId.get(z.levelCode)!, name: z.name, kind: z.kind ?? 'general', restricted: z.restricted ?? false, polygon: z.polygon } });
        zoneId.set(z.key, row.id);
      }
      await tx.navigationNode.createMany({ data: d.nodes.map((n) => ({ mapVersionId: v.id, levelId: levelId.get(n.levelCode)!, zoneId: n.zoneKey ? zoneId.get(n.zoneKey) : null, key: n.key, x: n.x, y: n.y, type: n.type, label: n.label })) });
      const nodeRows = await tx.navigationNode.findMany({ where: { mapVersionId: v.id }, select: { id: true, key: true, x: true, y: true } });
      const byKey = new Map(nodeRows.map((n) => [n.key, n]));
      await tx.navigationEdge.createMany({
        data: d.edges.map((e) => {
          const a = byKey.get(e.from)!;
          const b = byKey.get(e.to)!;
          return { mapVersionId: v.id, fromNodeId: a.id, toNodeId: b.id, distanceMeters: e.distanceMeters ?? Math.hypot(a.x - b.x, a.y - b.y), type: e.type ?? 'walk', accessible: e.accessible ?? e.type !== 'stairs', bidirectional: e.bidirectional ?? true, status: e.status ?? 'open' };
        }),
      });
      for (const p of d.places) {
        const data = { nodeId: byKey.get(p.nodeKey)!.id, row: p.row, zone: p.zone };
        await tx.parkingPlace.upsert({ where: { levelId_code: { levelId: levelId.get(p.levelCode)!, code: p.code } }, create: { ...data, levelId: levelId.get(p.levelCode)!, code: p.code }, update: data });
      }
      await tx.indoorLandmark.createMany({ data: d.landmarks.map((l) => ({ levelId: levelId.get(l.levelCode)!, nodeId: byKey.get(l.nodeKey)!.id, name: l.name, description: l.description })) });
      await tx.parkingEntryPoint.createMany({ data: d.entryPoints.map((e) => ({ buildingId, levelId: levelId.get(e.levelCode)!, nodeId: byKey.get(e.nodeKey)!.id, name: e.name, latitude: e.latitude, longitude: e.longitude })) });
      return v;
    }, { timeout: 60_000 });
    await this.audit.log({ actorUserId: user.id, action: 'indoor_map.create_version', resourceType: 'building', resourceId: buildingId, metadata: { version: result.version } });
    return result;
  }

  /**
   * Publishing archives the previous version. Parking places persist across versions (level+code);
   * routing resolves a place to the published node with the same stable node `key`.
   */
  async publish(user: AuthUser, buildingId: string, version: number) {
    await this.buildings.assertEditor(user, buildingId);
    const v = await this.version(buildingId, version);
    await this.prisma.$transaction([
      this.prisma.indoorMapVersion.updateMany({ where: { buildingId, status: 'published' }, data: { status: 'archived' } }),
      this.prisma.indoorMapVersion.update({ where: { id: v.id }, data: { status: 'published', publishedAt: new Date() } }),
      this.prisma.building.update({ where: { id: buildingId }, data: { publishedVersion: version } }),
    ]);
    await this.audit.log({ actorUserId: user.id, action: 'indoor_map.publish', resourceType: 'building', resourceId: buildingId, metadata: { version } });
    return { buildingId, version, status: 'published' };
  }

  /**
   * Editor save: converts the whole map to a new version and publishes it.
   * Existing nodes keep their stable `key` (parking places resolve through it); new nodes use their temp id as key.
   */
  async replace(user: AuthUser, buildingId: string, d: EditorMapDto) {
    await this.buildings.assertEditor(user, buildingId);
    const current = await this.prisma.indoorMapVersion.findFirst({ where: { buildingId, status: 'published' } });
    if ((current?.version ?? 0) !== d.version) throw new ConflictException('The map was changed by someone else; reload and try again');
    const [levels, existing] = await Promise.all([
      this.prisma.buildingLevel.findMany({ where: { buildingId } }),
      current ? this.prisma.navigationNode.findMany({ where: { mapVersionId: current.id }, select: { id: true, key: true } }) : [],
    ]);
    const levelCode = new Map(levels.map((l) => [l.id, l.code]));
    const keyOf = new Map(existing.map((n) => [n.id, n.key]));
    const key = (id: string) => keyOf.get(id) ?? id;
    const bad = d.nodes.find((n) => !levelCode.has(n.levelId));
    if (bad) throw new BadRequestException(`Node ${bad.label ?? bad.id} references an unknown level`);
    const draft: MapVersionDto = {
      notes: 'Editor',
      zones: [], places: [], landmarks: [], entryPoints: [],
      nodes: d.nodes.map((n) => ({ key: key(n.id), levelCode: levelCode.get(n.levelId)!, x: n.x, y: n.y, type: n.type, label: n.label })),
      edges: d.edges.map((e) => ({ from: key(e.fromNodeId), to: key(e.toNodeId), distanceMeters: e.distanceMeters, type: e.type, accessible: e.accessible, status: e.status })),
    };
    // Parking spots become places addressable by their label's number (e.g. "Plaza 148" -> code 148).
    for (const n of d.nodes.filter((x) => x.type === 'parking_spot')) {
      const code = n.label?.match(/[A-Za-z0-9-]+$/)?.[0];
      if (code) draft.places.push({ levelCode: levelCode.get(n.levelId)!, code, nodeKey: key(n.id) });
    }
    for (const n of d.nodes.filter((x) => x.type === 'landmark' && x.label)) draft.landmarks.push({ levelCode: levelCode.get(n.levelId)!, name: n.label!, nodeKey: key(n.id) });
    const v = await this.createVersion(user, buildingId, draft);
    await this.publish(user, buildingId, v.version);
    return this.get(user, buildingId);
  }

  /** Operational toggle (e.g. elevator out of service) on any version's edge. */
  async setEdgeStatus(user: AuthUser, edgeId: string, status: 'open' | 'closed') {
    const e = await this.prisma.navigationEdge.findUnique({ where: { id: edgeId }, include: { mapVersion: true } });
    if (!e) throw new NotFoundException('Edge not found');
    await this.buildings.assertEditor(user, e.mapVersion.buildingId);
    await this.audit.log({ actorUserId: user.id, action: 'indoor_map.edge_status', resourceType: 'navigation_edge', resourceId: edgeId, metadata: { status } });
    return this.prisma.navigationEdge.update({ where: { id: edgeId }, data: { status } });
  }
}

@ApiTags('indoor-maps')
@ApiBearerAuth()
@Controller('indoor-maps')
export class IndoorMapsController {
  constructor(private svc: IndoorMapsService) {}
  @Get(':buildingId') get(@CurrentUser() u: AuthUser, @Param('buildingId', ParseUUIDPipe) b: string) { return this.svc.get(u, b); }
  @Get(':buildingId/versions') versions(@CurrentUser() u: AuthUser, @Param('buildingId', ParseUUIDPipe) b: string) { return this.svc.versions(u, b); }
  @Get(':buildingId/versions/:version') getVersion(@CurrentUser() u: AuthUser, @Param('buildingId', ParseUUIDPipe) b: string, @Param('version', ParseIntPipe) v: number) { return this.svc.get(u, b, v); }
  @Post(':buildingId/versions') create(@CurrentUser() u: AuthUser, @Param('buildingId', ParseUUIDPipe) b: string, @Body() d: MapVersionDto) { return this.svc.createVersion(u, b, d); }
  @Post(':buildingId/versions/:version/publish') publish(@CurrentUser() u: AuthUser, @Param('buildingId', ParseUUIDPipe) b: string, @Param('version', ParseIntPipe) v: number) { return this.svc.publish(u, b, v); }
  @Put(':buildingId') replace(@CurrentUser() u: AuthUser, @Param('buildingId', ParseUUIDPipe) b: string, @Body() d: EditorMapDto) { return this.svc.replace(u, b, d); }
  @Patch('edges/:edgeId') edge(@CurrentUser() u: AuthUser, @Param('edgeId', ParseUUIDPipe) e: string, @Body() d: EdgeStatusDto) { return this.svc.setEdgeStatus(u, e, d.status); }
}

@Module({ imports: [BuildingsModule], controllers: [IndoorMapsController], providers: [IndoorMapsService], exports: [IndoorMapsService] })
export class IndoorMapsModule {}
