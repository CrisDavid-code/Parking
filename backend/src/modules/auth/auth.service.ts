import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma.service';
import { randomToken, sha256 } from '../../common/http';
import { AuditService } from '../audit/audit.module';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;

interface Ctx { ip?: string; userAgent?: string }

@Injectable()
export class AuthService {
  // Verified against for unknown emails so login timing doesn't reveal account existence.
  private dummyHash = argon2.hash(randomToken());
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: ConfigService,
    private users: UsersService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto, ctx: Ctx) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        fullName: dto.fullName,
        accountType: dto.accountType ?? 'personal',
        profile: { create: {} },
        subscriptions: { create: { planCode: 'free', status: 'active' } },
      },
    });
    await this.audit.log({ actorUserId: user.id, action: 'auth.register', resourceType: 'user', resourceId: user.id, ip: ctx.ip });
    return this.issue(user.id, ctx);
  }

  async login(dto: LoginDto, ctx: Ctx) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) {
      await argon2.verify(await this.dummyHash, dto.password);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new UnauthorizedException('Account temporarily locked. Try again later.');
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLoginCount: failed },
      });
      await this.audit.log({ actorUserId: user.id, action: failed >= MAX_FAILED ? 'auth.locked' : 'auth.login_failed', resourceType: 'user', resourceId: user.id, ip: ctx.ip });
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.audit.log({ actorUserId: user.id, action: 'auth.login', resourceType: 'user', resourceId: user.id, ip: ctx.ip });
    return this.issue(user.id, ctx);
  }

  /** Rotating refresh tokens: each refresh revokes the old session; reuse of a revoked token revokes all sessions. */
  async refresh(token: string, ctx: Ctx) {
    const s = await this.prisma.authSession.findUnique({ where: { refreshTokenHash: sha256(token) } });
    if (!s) throw new UnauthorizedException('Invalid refresh token');
    if (s.revokedAt) {
      await this.prisma.authSession.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ actorUserId: s.userId, action: 'auth.refresh_reuse_detected', resourceType: 'auth_session', resourceId: s.id, ip: ctx.ip });
      throw new UnauthorizedException('Refresh token reuse detected; all sessions revoked');
    }
    if (s.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    await this.prisma.authSession.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return this.issue(s.userId, ctx);
  }

  async logout(token: string) {
    await this.prisma.authSession.updateMany({ where: { refreshTokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Always responds the same way to avoid account enumeration. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) return;
    const token = randomToken();
    await this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) } });
    const link = `${this.cfg.get<string>('appUrl')}/reset-password?token=${encodeURIComponent(token)}`;
    await this.notifications.sendEmail(user.email, 'Restablecer contraseña', `Usa este enlace (válido 30 min): ${link}`);
  }

  async resetPassword(token: string, password: string) {
    const t = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.usedAt || t.expiresAt < new Date()) throw new BadRequestException('Invalid or expired reset token');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await argon2.hash(password), failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.authSession.updateMany({ where: { userId: t.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ actorUserId: t.userId, action: 'auth.password_reset', resourceType: 'user', resourceId: t.userId });
  }

  private async issue(userId: string, ctx: Ctx) {
    const refreshToken = randomToken(48);
    await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.cfg.get<number>('refreshTtlDays')! * 86_400_000),
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 255),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: userId });
    return { accessToken, refreshToken, user: await this.users.me(userId) };
  }
}
