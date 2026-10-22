import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC, PLATFORM_ADMIN, AuthUser } from './http';
import { PrismaService } from './prisma.service';

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * Role is always re-read from the DB — never trusted from the token or the client.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    req.user = await this.verify(req.headers.authorization);
    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_ADMIN, targets) && req.user.role !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException('Platform admin role required');
    }
    return true;
  }

  async verify(header?: string): Promise<AuthUser> {
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Missing bearer token');
    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, email: true, role: true, deletedAt: true } });
    if (!user || user.deletedAt) throw new UnauthorizedException('User not found');
    return { id: user.id, email: user.email, role: user.role };
  }
}
