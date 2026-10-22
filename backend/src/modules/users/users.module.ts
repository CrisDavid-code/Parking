import { Body, Controller, Delete, Get, HttpCode, Module, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/http';
import { UsersService } from './users.service';

class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 10) locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() locationPrefs?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() onboardingDone?: boolean;
}

class DeleteMeDto {
  @ApiProperty() @IsString() @MaxLength(128) password: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.users.me(u.id); }
  @Patch('me') update(@CurrentUser() u: AuthUser, @Body() d: UpdateMeDto) { return this.users.update(u.id, d as never); }
  @Get('me/export') export(@CurrentUser() u: AuthUser) { return this.users.export(u.id); }
  @Delete('me') @HttpCode(204) async delete(@CurrentUser() u: AuthUser, @Body() d: DeleteMeDto) { await this.users.delete(u.id, d.password); }
}

@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
