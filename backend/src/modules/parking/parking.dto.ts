import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PageQuery } from '../../common/http';

export class CreateParkingDto {
  @ApiProperty() @IsUUID() vehicleId: string;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() latitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() longitude?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) accuracyMeters?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() buildingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() levelId?: string;
  @ApiPropertyOptional({ description: 'Free text level (PB, B1, B2…) when no mapped level exists' }) @IsOptional() @IsString() @MaxLength(20) levelLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) zone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) row?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) spot?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) entrance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) referencePoint?: string;
  @ApiPropertyOptional({ enum: ['elevator', 'stairs', 'ramp', 'other'] }) @IsOptional() @IsIn(['elevator', 'stairs', 'ramp', 'other']) referenceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) ticketNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @ApiPropertyOptional({ enum: ['gps', 'manual', 'device'] }) @IsOptional() @IsIn(['gps', 'manual', 'device']) source?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() startedAt?: Date;
}

export class UpdateParkingDto extends PartialType(OmitType(CreateParkingDto, ['vehicleId'] as const)) {}

export class ParkingQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
  @ApiPropertyOptional({ enum: ['active', 'ended'] }) @IsOptional() @IsIn(['active', 'ended']) status?: 'active' | 'ended';
}

export class ActiveQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() vehicleId?: string;
}
