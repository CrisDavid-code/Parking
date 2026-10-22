import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';

class NearbyQuery {
  @ApiProperty() @Type(() => Number) @IsLatitude() lat: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() lng: number;
  @ApiPropertyOptional({ default: 300 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(10) @Max(5000) radiusMeters = 300;
}

/** Geospatial lookups backed by PostGIS (geography + GIST indexes). */
@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private prisma: PrismaService) {}

  /** Buildings near a GPS fix — used to suggest the building when saving a parking spot. */
  @Get('nearby-buildings')
  nearby(@CurrentUser() u: AuthUser, @Query() q: NearbyQuery) {
    const admin = u.role === 'PLATFORM_ADMIN';
    return this.prisma.$queryRaw<{ id: string; name: string; address: string | null; distanceMeters: number; hasIndoorMap: boolean }[]>`
      SELECT b.id, b.name, b.address, ROUND(ST_Distance(b.geog, p.g)::numeric, 1)::float AS "distanceMeters",
             (b.published_version IS NOT NULL) AS "hasIndoorMap"
      FROM buildings b, (SELECT ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography AS g) p
      WHERE b.geog IS NOT NULL AND ST_DWithin(b.geog, p.g, ${q.radiusMeters})
        AND (${admin} OR b.is_public OR EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = b.organization_id AND m.user_id = ${u.id}::uuid))
      ORDER BY "distanceMeters" LIMIT 20`;
  }
}

@Module({ controllers: [LocationsController] })
export class LocationsModule {}
