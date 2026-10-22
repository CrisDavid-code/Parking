import { Controller, Get, Global, HttpCode, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { AuthUser, CurrentUser, PageQuery } from '../../common/http';
import { NotificationsService } from './notifications.service';

class NotificationQuery extends PageQuery {
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() unread?: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: NotificationQuery) { return this.svc.list(u.id, q); }
  @Post('read-all') @HttpCode(204) async readAll(@CurrentUser() u: AuthUser) { await this.svc.markAllRead(u.id); }
  @Post(':id/read') @HttpCode(204) async read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { await this.svc.markRead(u.id, id); }
}

@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
