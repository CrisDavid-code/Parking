import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ALL_PERMISSIONS } from '../../common/access.service';

export class CreateVehicleDto {
  @ApiProperty() @IsString() @Length(1, 60) alias: string;
  @ApiProperty() @IsString() @Length(1, 60) make: string;
  @ApiProperty() @IsString() @Length(1, 60) model: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2100) year?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) color?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) plate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) maintenanceStatus?: string;
}
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}

export class AddMemberDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toLowerCase()) @IsEmail() email: string;
  @ApiProperty({ enum: ALL_PERMISSIONS, isArray: true }) @IsArray() @ArrayUnique() @IsIn(ALL_PERMISSIONS, { each: true }) permissions: string[];
}
