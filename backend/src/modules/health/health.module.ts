import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';
import { FilesService } from '../files/files.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService, private files: FilesService, private subs: SubscriptionsService) {}

  /** Liveness: process is up. */
  @Get('live') live() { return { status: 'ok' }; }

  /** Readiness: DB + PostGIS reachable. Integrations are reported, not required. */
  @Get()
  async ready() {
    try {
      const [{ postgis }] = await this.prisma.$queryRaw<{ postgis: string }[]>`SELECT postgis_lib_version() AS postgis`;
      return {
        status: 'ok',
        database: 'up',
        postgis,
        integrations: { storage: this.files.configured ? 'configured' : 'not_configured', payments: this.subs.paymentsConfigured() ? 'configured' : 'not_configured', email: 'not_configured', push: 'not_configured' },
      };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
