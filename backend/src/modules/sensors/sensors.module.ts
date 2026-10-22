import { Controller, Get, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const SENSOR_SOURCES = ['pedometer', 'compass', 'barometer', 'ble', 'uwb', 'wifi', 'fused', 'manual_level', 'landmark'] as const;
export type SensorSource = (typeof SENSOR_SOURCES)[number];

/** Confidence at/above which an estimate may move the user's confirmed position. */
export const CONFIRM_CONFIDENCE = 0.7;
/** Below this, the client must ask the user to confirm level/landmark. */
export const LOW_CONFIDENCE = 0.5;

/** Estimate produced by a native sensor layer (or manual input). Never generated server-side. */
export class SensorEstimateDto {
  @ApiProperty({ enum: SENSOR_SOURCES }) @IsIn(SENSOR_SOURCES) source: SensorSource;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1_000_000) steps?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100_000) estimatedDistanceMeters?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(360) headingDegrees?: number;
  @ApiPropertyOptional({ enum: ['left', 'right', 'straight', 'u_turn'] }) @IsOptional() @IsIn(['left', 'right', 'straight', 'u_turn']) turnEstimate?: string;
  @ApiPropertyOptional({ description: 'Level code the sensor believes the user is on' }) @IsOptional() @IsString() @MaxLength(20) floorEstimate?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() levelId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() nodeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(300) @Max(1100) pressureHpa?: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) @IsNumber() @Min(0) @Max(1) confidence: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10_000) uncertaintyMeters?: number;
  @ApiProperty() @Type(() => Date) @IsDate() capturedAt: Date;
}

export interface EstimateAssessment { acceptPosition: boolean; acceptLevel: boolean; requiresConfirmation: boolean }

/**
 * Decides what an estimate is allowed to change. Pure function so the rules are testable:
 * - manual level selection sets the level but never confirms an exact position;
 * - only high-confidence estimates with a concrete node move the confirmed position;
 * - a floor change requires high confidence (no automatic level switch on weak data);
 * - weak estimates (below LOW_CONFIDENCE) drop confirmation so the client asks the user.
 */
export function assessEstimate(e: Pick<SensorEstimateDto, 'source' | 'confidence' | 'nodeId' | 'levelId'>): EstimateAssessment {
  if (e.source === 'manual_level') return { acceptPosition: false, acceptLevel: Boolean(e.levelId), requiresConfirmation: true };
  const strong = e.confidence >= CONFIRM_CONFIDENCE;
  return {
    acceptPosition: strong && Boolean(e.nodeId),
    acceptLevel: strong && Boolean(e.levelId),
    requiresConfirmation: e.confidence < LOW_CONFIDENCE,
  };
}

@ApiTags('sensors')
@ApiBearerAuth()
@Controller('sensors')
export class SensorsController {
  /** What the platform can do with sensor data. Web clients have no native pedometer/AR access. */
  @Get('capabilities')
  capabilities() {
    return {
      acceptedSources: SENSOR_SOURCES,
      confirmConfidence: CONFIRM_CONFIDENCE,
      lowConfidence: LOW_CONFIDENCE,
      web: { pedometer: false, barometer: false, ar: false, compass: 'device-orientation-api-only', note: 'Step counting, barometer and AR require the native mobile app (ARKit/ARCore).' },
      server: { computesIndoorPositionWithoutDeviceData: false, driftCorrection: 'landmark-confirmation' },
    };
  }
}

@Module({ controllers: [SensorsController] })
export class SensorsModule {}
