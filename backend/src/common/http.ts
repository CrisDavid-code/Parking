import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { createHash, randomBytes } from 'crypto';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'PLATFORM_ADMIN';
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const PLATFORM_ADMIN = 'platformAdmin';
export const PlatformAdminOnly = () => SetMetadata(PLATFORM_ADMIN, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return (ctx.switchToHttp().getRequest<Request & { user: AuthUser }>()).user;
});

export class PageQuery {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize = 20;
  @ApiPropertyOptional({ description: 'Free-text search' }) @IsOptional() @IsString() @MaxLength(100) q?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function paginate<T>(q: PageQuery, count: Promise<number>, rows: (skip: number, take: number) => Promise<T[]>): Promise<Page<T>> {
  const [total, items] = await Promise.all([count, rows((q.page - 1) * q.pageSize, q.pageSize)]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
