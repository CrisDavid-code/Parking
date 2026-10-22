import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { AccessService } from '../../common/access.service';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.module';

export interface PlanLimits { vehicles: number; devices: number; historyDays: number; members: number }
export type LimitKey = keyof PlanLimits;

export class PlanLimitException extends HttpException {
  constructor(limit: LimitKey, max: number) {
    super({ statusCode: 402, error: 'Plan Limit', message: `Plan limit reached for ${limit} (max ${max})`, limit, max }, HttpStatus.PAYMENT_REQUIRED);
  }
}

interface Owner { userId?: string; organizationId?: string }

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService, private cfg: ConfigService, private audit: AuditService, private access: AccessService) {}

  plans() {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }).then((ps) =>
      ps.map((p) => ({ ...p, priceMonthly: Number(p.priceMonthly) })),
    );
  }

  /** Server-side source of truth for entitlements; the client's notion of its plan is never trusted. */
  async limitsFor(o: Owner): Promise<PlanLimits> {
    const sub = await this.prisma.subscription.findFirst({
      where: o.organizationId ? { organizationId: o.organizationId } : { userId: o.userId },
      include: { plan: true },
    });
    const usable = sub && sub.status !== 'canceled' ? sub.plan : await this.prisma.plan.findUniqueOrThrow({ where: { code: 'free' } });
    return usable.limits as unknown as PlanLimits;
  }

  async assertWithinLimit(o: Owner, key: LimitKey, currentCount: number) {
    const max = (await this.limitsFor(o))[key];
    if (currentCount >= max) throw new PlanLimitException(key, max);
  }

  async mine(userId: string, organizationId?: string) {
    if (organizationId) await this.access.assertOrgRole(userId, organizationId, ['ORG_ADMIN']);
    const where = organizationId ? { organizationId } : { userId };
    const sub = await this.prisma.subscription.findFirst({ where, include: { plan: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return {
      ...sub,
      plan: { ...sub.plan, priceMonthly: Number(sub.plan.priceMonthly) },
      paymentsConfigured: this.paymentsConfigured(),
    };
  }

  paymentsConfigured() {
    return Boolean(this.cfg.get('billingProvider') && this.cfg.get('billingWebhookSecret'));
  }

  async change(userId: string, planCode: string, organizationId?: string) {
    const plan = await this.prisma.plan.findFirst({ where: { code: planCode, active: true } });
    if (!plan) throw new BadRequestException('Unknown plan');
    const sub = await this.mine(userId, organizationId);
    if (Number(plan.priceMonthly) === 0) {
      const updated = await this.prisma.subscription.update({ where: { id: sub.id }, data: { planCode, pendingPlanCode: null, status: 'active', cancelAtPeriodEnd: false } });
      await this.audit.log({ actorUserId: userId, organizationId, action: 'subscription.change', resourceType: 'subscription', resourceId: sub.id, metadata: { planCode } });
      return updated;
    }
    // Paid upgrade: only a verified provider webhook can activate it. Never simulate success.
    if (!this.paymentsConfigured()) throw new ServiceUnavailableException({ message: 'Payments are not configured yet', code: 'payments_not_configured' });
    const updated = await this.prisma.subscription.update({ where: { id: sub.id }, data: { pendingPlanCode: planCode } });
    await this.audit.log({ actorUserId: userId, organizationId, action: 'subscription.change_requested', resourceType: 'subscription', resourceId: sub.id, metadata: { planCode } });
    return { ...updated, status: 'pending_payment', checkoutUrl: null };
  }

  async cancel(userId: string, organizationId?: string) {
    const sub = await this.mine(userId, organizationId);
    if (Number(sub.plan.priceMonthly) === 0) throw new BadRequestException('Free plan cannot be cancelled');
    await this.audit.log({ actorUserId: userId, organizationId, action: 'subscription.cancel', resourceType: 'subscription', resourceId: sub.id });
    return this.prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true } });
  }

  /** Provider-agnostic webhook: HMAC-SHA256(rawBody, BILLING_WEBHOOK_SECRET) in `x-signature`. Idempotent per event id. */
  async handleWebhook(provider: string, rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = this.cfg.get<string>('billingWebhookSecret');
    if (!secret || provider !== this.cfg.get('billingProvider')) throw new NotFoundException('Unknown billing provider');
    if (!rawBody || !signature) throw new UnauthorizedException('Missing signature');
    const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new UnauthorizedException('Invalid signature');

    const evt = JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; data: { subscriptionId: string; planCode?: string; currentPeriodEnd?: string; providerRef?: string } };
    if (!evt?.id || !evt?.type || !evt?.data?.subscriptionId) throw new BadRequestException('Malformed event');
    const dup = await this.prisma.billingEvent.findUnique({ where: { provider_eventId: { provider, eventId: evt.id } } });
    if (dup) return { received: true, duplicate: true };

    const sub = await this.prisma.subscription.findUnique({ where: { id: evt.data.subscriptionId } });
    if (!sub) throw new BadRequestException('Unknown subscription');
    let data: Prisma.SubscriptionUpdateInput = {};
    switch (evt.type) {
      case 'subscription.activated': {
        const planCode = evt.data.planCode ?? sub.pendingPlanCode;
        if (!planCode || !(await this.prisma.plan.findUnique({ where: { code: planCode } }))) throw new BadRequestException('Unknown plan');
        data = { plan: { connect: { code: planCode } }, pendingPlanCode: null, status: 'active', provider, providerRef: evt.data.providerRef, currentPeriodEnd: evt.data.currentPeriodEnd ? new Date(evt.data.currentPeriodEnd) : null, cancelAtPeriodEnd: false };
        break;
      }
      case 'payment.failed': data = { status: 'past_due' }; break;
      case 'subscription.canceled': data = { status: 'canceled', plan: { connect: { code: 'free' } }, pendingPlanCode: null }; break;
      default: break; // unknown types are recorded but ignored
    }
    await this.prisma.$transaction([
      this.prisma.billingEvent.create({ data: { provider, eventId: evt.id, type: evt.type, payload: evt as unknown as Prisma.InputJsonValue, subscriptionId: sub.id } }),
      this.prisma.subscription.update({ where: { id: sub.id }, data }),
    ]);
    await this.audit.log({ organizationId: sub.organizationId, action: `billing.${evt.type}`, resourceType: 'subscription', resourceId: sub.id });
    return { received: true };
  }
}
