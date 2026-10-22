import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/** Maps Prisma errors to proper HTTP codes instead of leaking 500s/DB details. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Resource already exists'],
      P2025: [HttpStatus.NOT_FOUND, 'Resource not found'],
      P2003: [HttpStatus.BAD_REQUEST, 'Invalid reference'],
      P2023: [HttpStatus.BAD_REQUEST, 'Invalid identifier'],
    };
    const [statusCode, message] = map[e.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error'];
    if (statusCode === 500) throw e;
    host.switchToHttp().getResponse<Response>().status(statusCode).json({ statusCode, message, error: e.code });
  }
}
