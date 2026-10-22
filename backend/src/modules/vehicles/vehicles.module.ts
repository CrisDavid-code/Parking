import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, PageQuery } from '../../common/http';
import { MAX_UPLOAD_BYTES } from '../files/files.module';
import { AddMemberDto, CreateVehicleDto, UpdateVehicleDto } from './vehicles.dto';
import { VehiclesService } from './vehicles.service';

const Id = () => Param('id', ParseUUIDPipe);

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private svc: VehiclesService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) { return this.svc.list(u.id, q); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateVehicleDto) { return this.svc.create(u.id, d); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.get(u.id, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: UpdateVehicleDto) { return this.svc.update(u.id, id, d); }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.remove(u.id, id); }
  @Post(':id/primary') @HttpCode(200) primary(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.setPrimary(u.id, id); }
  @Post(':id/photo') @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  photo(@CurrentUser() u: AuthUser, @Id() id: string, @UploadedFile() f?: Express.Multer.File) { return this.svc.uploadPhoto(u.id, id, f); }
  @Get(':id/members') members(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.members(u.id, id); }
  @Post(':id/members') addMember(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: AddMemberDto) { return this.svc.addMember(u.id, id, d); }
  @Delete(':id/members/:userId') @HttpCode(204) removeMember(@CurrentUser() u: AuthUser, @Id() id: string, @Param('userId', ParseUUIDPipe) m: string) { return this.svc.removeMember(u.id, id, m); }
}

@Module({ controllers: [VehiclesController], providers: [VehiclesService], exports: [VehiclesService] })
export class VehiclesModule {}
