import { Body, Controller, Get, Global, Headers, HttpCode, Module, Param, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AuthUser, CurrentUser, Public } from '../../common/http';
import { SubscriptionsService } from './subscriptions.service';

class OrgScope { @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string }
class ChangePlanDto extends OrgScope { @ApiProperty() @IsString() @MaxLength(32) planCode: string }

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private svc: SubscriptionsService) {}
  @Public() @Get('plans') plans() { return this.svc.plans(); }
  @Get('me') mine(@CurrentUser() u: AuthUser, @Query() q: OrgScope) { return this.svc.mine(u.id, q.organizationId); }
  @Post('change') @HttpCode(200) change(@CurrentUser() u: AuthUser, @Body() d: ChangePlanDto) { return this.svc.change(u.id, d.planCode, d.organizationId); }
  @Post('cancel') @HttpCode(200) cancel(@CurrentUser() u: AuthUser, @Body() d: OrgScope) { return this.svc.cancel(u.id, d.organizationId); }
  @Public() @Post('webhooks/:provider') @HttpCode(200)
  webhook(@Param('provider') provider: string, @Req() req: RawBodyRequest<Request>, @Headers('x-signature') sig?: string) {
    return this.svc.handleWebhook(provider, req.rawBody, sig);
  }
}

@Global()
@Module({ controllers: [SubscriptionsController], providers: [SubscriptionsService], exports: [SubscriptionsService] })
export class SubscriptionsModule {}
