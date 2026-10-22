import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/http';
import { MAX_UPLOAD_BYTES } from '../files/files.module';
import { ActiveQuery, CreateParkingDto, ParkingQuery, UpdateParkingDto } from './parking.dto';
import { ParkingService } from './parking.service';

const Id = () => Param('id', ParseUUIDPipe);

@ApiTags('parking-sessions')
@ApiBearerAuth()
@Controller('parking-sessions')
export class ParkingController {
  constructor(private svc: ParkingService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ParkingQuery) { return this.svc.list(u.id, q); }
  @Get('active') active(@CurrentUser() u: AuthUser, @Query() q: ActiveQuery) { return this.svc.active(u.id, q); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() d: CreateParkingDto) { return this.svc.create(u.id, d); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.get(u.id, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Id() id: string, @Body() d: UpdateParkingDto) { return this.svc.update(u.id, id, d); }
  @Post(':id/end') @HttpCode(200) end(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.end(u.id, id); }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Id() id: string) { return this.svc.remove(u.id, id); }
  @Post(':id/media') @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  media(@CurrentUser() u: AuthUser, @Id() id: string, @UploadedFile() f?: Express.Multer.File) { return this.svc.addMedia(u.id, id, f); }
  @Delete(':id/media/:mediaId') @HttpCode(204) removeMedia(@CurrentUser() u: AuthUser, @Id() id: string, @Param('mediaId', ParseUUIDPipe) m: string) { return this.svc.removeMedia(u.id, id, m); }
}

@Module({ controllers: [ParkingController], providers: [ParkingService], exports: [ParkingService] })
export class ParkingModule {}
