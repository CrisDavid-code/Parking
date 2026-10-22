import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';

/**
 * Data retention:
 *  - location_events: per billing owner's plan historyDays, capped by LOCATION_RETENTION_DAYS;
 *  - pedestrian_position_estimates: POSITION_ESTIMATE_RETENTION_DAYS;
 *  - expired/revoked auth sessions and used/expired reset tokens.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger(RetentionService.name);
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  onModuleInit() {
    // ponytail: in-process daily timer; move to a scheduler/queue (BullMQ) when running >1 replica.
    if (this.cfg.get('retentionJobEnabled')) this.timer = setInterval(() => this.run().catch((e) => this.log.error(e)), 86_400_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    const globalDays = this.cfg.get<number>('locationRetentionDays')!;
    const estimateDays = this.cfg.get<number>('positionEstimateRetentionDays')!;
    const day = 86_400_000;
    // Effective retention per vehicle = min(plan historyDays of its billing owner, global cap).
    const locationEvents = await this.prisma.$executeRaw`
      DELETE FROM location_events e
      USING vehicles v
      LEFT JOIN subscriptions s ON (v.organization_id IS NOT NULL AND s.organization_id = v.organization_id)
                                OR (v.organization_id IS NULL AND s.user_id = v.owner_id)
      LEFT JOIN plans p ON p.code = CASE WHEN s.status = 'canceled' OR s.id IS NULL THEN 'free' ELSE s.plan_code END
      WHERE e.vehicle_id = v.id
        AND e.captured_at < ${now}::timestamptz - make_interval(days => LEAST(COALESCE((p.limits->>'historyDays')::int, ${globalDays}::int), ${globalDays}::int))`;
    const estimates = await this.prisma.pedestrianPositionEstimate.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - estimateDays * day) } } });
    const sessions = await this.prisma.authSession.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 30 * day) } }] } });
    const resets = await this.prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } });
    const result = { locationEvents, positionEstimates: estimates.count, authSessions: sessions.count, resetTokens: resets.count };
    this.log.log(`retention run: ${JSON.stringify(result)}`);
    return result;
  }
}
