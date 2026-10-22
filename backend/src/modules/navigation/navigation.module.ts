import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { NavigationMode, ParkingSession, PedestrianNavigationSession } from '@prisma/client';
import { AccessService } from '../../common/access.service';
import { AuthUser, CurrentUser } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { BuildingsModule, BuildingsService } from '../buildings/buildings.module';
import { IndoorMapsModule, IndoorMapsService, LoadedGraph } from '../indoor-maps/indoor-maps.module';
import { assessEstimate, SensorEstimateDto } from '../sensors/sensors.module';
import { planRoutes } from './graph';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true';

class RouteDto {
  @ApiProperty() @IsUUID() buildingId: string;
  @ApiProperty() @IsUUID() fromNodeId: string;
  @ApiProperty() @IsUUID() toNodeId: string;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() accessibleOnly?: boolean;
}
class CreateSessionDto {
  @ApiProperty() @IsUUID() parkingSessionId: string;
  @ApiPropertyOptional({ enum: NavigationMode }) @IsOptional() @IsIn(['basic', 'indoor', 'sensor']) mode?: NavigationMode;
}
class ConfirmLandmarkDto { @ApiProperty() @IsUUID() nodeId: string }
class SetLevelDto { @ApiProperty() @IsUUID() levelId: string }
class RouteQuery { @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() accessibleOnly?: boolean }

@Injectable()
export class NavigationService {
  constructor(private prisma: PrismaService, private access: AccessService, private maps: IndoorMapsService, private buildings: BuildingsService) {}

  /** Raw node-to-node route on a building's published graph. */
  async route(user: AuthUser, d: RouteDto) {
    await this.buildings.assertVisible(user, d.buildingId);
    const g = await this.maps.loadGraph(d.buildingId);
    if (!g) throw new NotFoundException('No published indoor map for this building');
    return this.plan(g, d.fromNodeId, d.toNodeId, d.accessibleOnly);
  }

  private plan(g: LoadedGraph, from: string, to: string, accessibleOnly?: boolean, destinationLabel?: string) {
    if (!g.nodes.has(from) || !g.nodes.has(to)) throw new BadRequestException('Origin and destination must be nodes of the published map');
    const r = planRoutes(g.nodes, g.edges, from, to, { accessibleOnly }, destinationLabel);
    if (!r) throw new UnprocessableEntityException({ message: 'No walkable route between these points', code: 'no_route', accessibleOnly: Boolean(accessibleOnly) });
    return { mapVersion: g.version, ...r };
  }

  /** Resolve the parking place to the published graph by stable node key. */
  private async targetNode(p: ParkingSession, g: LoadedGraph | null) {
    if (!g || !p.parkingPlaceId) return null;
    const place = await this.prisma.parkingPlace.findUnique({ where: { id: p.parkingPlaceId }, include: { node: true } });
    if (!place?.node) return null;
    const n = await this.prisma.navigationNode.findUnique({ where: { mapVersionId_key: { mapVersionId: g.mapVersionId, key: place.node.key } } });
    return n?.id ?? null;
  }

  private async loadSession(user: AuthUser, id: string) {
    const s = await this.prisma.pedestrianNavigationSession.findUnique({ where: { id }, include: { parkingSession: { include: { media: true } } } });
    if (!s || s.userId !== user.id) throw new NotFoundException('Navigation session not found');
    return s;
  }

  async create(user: AuthUser, d: CreateSessionDto) {
    const p = await this.prisma.parkingSession.findUnique({ where: { id: d.parkingSessionId } });
    if (!p) throw new NotFoundException('Parking session not found');
    await this.access.assertVehicle(user.id, p.vehicleId, 'view_parking');
    const g = p.buildingId ? await this.maps.loadGraph(p.buildingId) : null;
    const targetNodeId = await this.targetNode(p, g);
    const availableModes: NavigationMode[] = targetNodeId ? ['basic', 'indoor', 'sensor'] : ['basic'];
    const mode = d.mode ?? (targetNodeId ? 'indoor' : 'basic');
    if (!availableModes.includes(mode)) {
      throw new UnprocessableEntityException({ message: `Mode ${mode} is not available for this parking session`, code: 'mode_unavailable', availableModes, reason: !p.buildingId ? 'no_building' : !g ? 'no_indoor_map' : 'spot_not_mapped' });
    }
    const s = await this.prisma.pedestrianNavigationSession.create({ data: { userId: user.id, parkingSessionId: p.id, mode, mapVersionId: g?.mapVersionId, targetNodeId } });
    return this.present(s, availableModes);
  }

  private present(s: PedestrianNavigationSession, availableModes?: NavigationMode[]) {
    return {
      ...s,
      confirmedNodeId: s.positionConfirmed ? s.currentNodeId : null,
      createdAt: s.startedAt,
      availableModes: availableModes ?? (s.targetNodeId ? ['basic', 'indoor', 'sensor'] : ['basic']),
      // Sensor/AR mode depends on the client's native capabilities; the server can't vouch for it.
      sensorSupport: 'requires_native_app',
    };
  }

  async get(user: AuthUser, id: string) {
    const s = await this.loadSession(user, id);
    const { parkingSession, ...rest } = s;
    return { ...this.present(rest), parking: parkingSession, guidance: this.basicGuidance(parkingSession, rest.currentLevelId ? await this.prisma.buildingLevel.findUnique({ where: { id: rest.currentLevelId } }) : null) };
  }

  /** Mode A: textual guidance built only from what the user saved. No invented positions. */
  private basicGuidance(p: ParkingSession, current: { code: string; ordinal: number } | null) {
    const steps: string[] = [];
    if (p.levelLabel) {
      if (current && current.code === p.levelLabel) steps.push(`Ya estás en el nivel ${p.levelLabel}.`);
      else steps.push(current ? `Dirígete del nivel ${current.code} al nivel ${p.levelLabel}.` : `Dirígete al nivel ${p.levelLabel}.`);
    }
    if (p.referencePoint) steps.push(`Usa como referencia: ${p.referenceType ? ({ elevator: 'ascensor', stairs: 'escalera', ramp: 'rampa', other: '' } as Record<string, string>)[p.referenceType] + ' ' : ''}${p.referencePoint}.`.replace('  ', ' '));
    if (p.entrance) steps.push(`Entraste por: ${p.entrance}.`);
    if (p.zone) steps.push(`Busca la zona ${p.zone}.`);
    if (p.row) steps.push(`Sigue los indicadores de la fila ${p.row}.`);
    if (p.spot) steps.push(`Busca la plaza ${p.spot}.`);
    steps.push('Confirma que el vehículo coincide con la fotografía guardada.');
    return { positionAvailable: false, notice: 'La posición interior exacta no está disponible; las instrucciones se basan en los datos que guardaste.', steps };
  }

  /** Mode B: route from the user's confirmed node to the car. 409 when the position is unknown. */
  async sessionRoute(user: AuthUser, id: string, q: RouteQuery) {
    const s = await this.loadSession(user, id);
    if (s.status !== 'active') throw new BadRequestException('Navigation session ended');
    if (!s.targetNodeId || !s.parkingSession.buildingId) throw new UnprocessableEntityException({ message: 'Indoor routing unavailable; use basic guidance', code: 'mode_unavailable' });
    const g = await this.maps.loadGraph(s.parkingSession.buildingId);
    if (!g || g.mapVersionId !== s.mapVersionId) throw new ConflictException({ message: 'The indoor map changed; start a new navigation session', code: 'map_changed' });
    if (!s.currentNodeId || !s.positionConfirmed) {
      const landmarks = await this.prisma.indoorLandmark.findMany({ where: { node: { mapVersionId: g.mapVersionId }, ...(s.currentLevelId ? { levelId: s.currentLevelId } : {}) }, select: { id: true, name: true, description: true, levelId: true, nodeId: true } });
      const levels = await this.prisma.buildingLevel.findMany({ where: { buildingId: s.parkingSession.buildingId }, orderBy: { ordinal: 'desc' } });
      throw new ConflictException({ message: 'Position not confirmed. Select your level and a known landmark.', code: 'position_unknown', currentLevelId: s.currentLevelId, levels, landmarks });
    }
    const spot = s.parkingSession.spot ? `la plaza ${s.parkingSession.spot}` : undefined;
    return this.plan(g, s.currentNodeId, s.targetNodeId, q.accessibleOnly, spot);
  }

  async setLevel(user: AuthUser, id: string, d: SetLevelDto) {
    const s = await this.loadSession(user, id);
    const level = await this.prisma.buildingLevel.findUnique({ where: { id: d.levelId } });
    if (!level || level.buildingId !== s.parkingSession.buildingId) throw new BadRequestException('Level does not belong to the parking building');
    return this.position(user, id, { source: 'manual_level', levelId: d.levelId, confidence: 1, capturedAt: new Date() });
  }

  /** Records a sensor/manual estimate; only strong evidence moves the confirmed position (see assessEstimate). */
  async position(user: AuthUser, id: string, input: SensorEstimateDto) {
    // Manual input (no sensor fields) = the user telling us their level or a known point.
    const e = {
      ...input,
      source: input.source ?? (input.nodeId ? 'landmark' : 'manual_level'),
      confidence: input.confidence ?? 1,
      capturedAt: input.capturedAt ?? new Date(),
    } as const;
    const s = await this.loadSession(user, id);
    if (s.status !== 'active') throw new BadRequestException('Navigation session ended');
    let node: { id: string; levelId: string } | null = null;
    if (e.nodeId) {
      node = await this.prisma.navigationNode.findFirst({ where: { id: e.nodeId, mapVersionId: s.mapVersionId ?? undefined }, select: { id: true, levelId: true } });
      if (!node || !s.mapVersionId) throw new BadRequestException('nodeId is not part of this session map');
    }
    if (e.levelId && s.parkingSession.buildingId && !(await this.prisma.buildingLevel.findFirst({ where: { id: e.levelId, buildingId: s.parkingSession.buildingId } }))) {
      throw new BadRequestException('levelId is not part of this building');
    }
    const a = assessEstimate(e);
    await this.prisma.pedestrianPositionEstimate.create({ data: { ...e, sessionId: id } });
    const data: Partial<PedestrianNavigationSession> = {};
    if (a.acceptPosition && node) Object.assign(data, { currentNodeId: node.id, currentLevelId: node.levelId, positionConfirmed: true });
    else if (a.acceptLevel && e.levelId) Object.assign(data, { currentLevelId: e.levelId, positionConfirmed: e.levelId === s.currentLevelId ? s.positionConfirmed : false });
    if (a.requiresConfirmation && !a.acceptPosition) data.positionConfirmed = false;
    const updated = Object.keys(data).length ? await this.prisma.pedestrianNavigationSession.update({ where: { id }, data }) : s;
    return {
      positionConfirmed: updated.positionConfirmed,
      requiresConfirmation: a.requiresConfirmation && !a.acceptPosition,
      currentLevelId: updated.currentLevelId,
      currentNodeId: updated.currentNodeId,
      estimateAccepted: a.acceptPosition || a.acceptLevel,
    };
  }

  /** Drift correction: user confirms they're at a known landmark/node, resetting accumulated error. */
  async confirmLandmark(user: AuthUser, id: string, d: ConfirmLandmarkDto) {
    return this.position(user, id, { source: 'landmark', nodeId: d.nodeId, confidence: 1, uncertaintyMeters: 0, capturedAt: new Date() });
  }

  async end(user: AuthUser, id: string) {
    await this.loadSession(user, id);
    return this.prisma.pedestrianNavigationSession.update({ where: { id }, data: { status: 'ended', endedAt: new Date() } });
  }
}

const Id = () => Param('id', ParseUUIDPipe);

@ApiTags('navigation')
@ApiBearerAuth()
@Controller('navigation')
export class NavigationController {
  constructor(private svc: NavigationService) {}
  @Post('route') @HttpCode(200) route(@CurrentUser() u: AuthUser, @Body() d: RouteDto) { return this.svc.route(u, d); }
  @Post('sessions') create(@CurrentUser() u: AuthUser, @Body() d: CreateSessionDto) { return this.svc.create(u, d); }
  @Get('sessions/:id') get(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.get(u, id); }
  @Get('sessions/:id/route') sessionRoute(@CurrentUser() u: AuthUser, @Id() id: string, @Query() q: RouteQuery) { return this.svc.sessionRoute(u, id, q); }
  @Post('sessions/:id/level') @HttpCode(200) level(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: SetLevelDto) { return this.svc.setLevel(u, id, d); }
  @Post('sessions/:id/position') @HttpCode(200) position(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: SensorEstimateDto) { return this.svc.position(u, id, d); }
  @Post('sessions/:id/confirm-landmark') @HttpCode(200) confirm(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: ConfirmLandmarkDto) { return this.svc.confirmLandmark(u, id, d); }
  @Post('sessions/:id/end') @HttpCode(200) end(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.end(u, id); }
}

@Module({ imports: [IndoorMapsModule, BuildingsModule], controllers: [NavigationController], providers: [NavigationService] })
export class NavigationModule {}
