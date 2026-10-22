import { Body, Controller, HttpCode, Module, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/http';
import { UsersModule } from '../users/users.module';
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { AuthService } from './auth.service';

const ctx = (r: Request) => ({ ip: r.ip, userAgent: r.headers['user-agent'] });

@ApiTags('auth')
@Public()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register') register(@Body() d: RegisterDto, @Req() r: Request) { return this.auth.register(d, ctx(r)); }
  @Post('login') @HttpCode(200) login(@Body() d: LoginDto, @Req() r: Request) { return this.auth.login(d, ctx(r)); }
  @Post('refresh') @HttpCode(200) refresh(@Body() d: RefreshDto, @Req() r: Request) { return this.auth.refresh(d.refreshToken, ctx(r)); }
  @Post('logout') @HttpCode(204) async logout(@Body() d: RefreshDto) { await this.auth.logout(d.refreshToken); }
  @Post('forgot-password') @HttpCode(202) async forgot(@Body() d: ForgotPasswordDto) { await this.auth.forgotPassword(d.email); return { ok: true }; }
  @Post('reset-password') @HttpCode(204) async reset(@Body() d: ResetPasswordDto) { await this.auth.resetPassword(d.token, d.password); }
}

@Module({ imports: [UsersModule], controllers: [AuthController], providers: [AuthService] })
export class AuthModule {}
