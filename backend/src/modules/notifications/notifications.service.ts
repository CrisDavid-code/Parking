import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PageQuery, paginate } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';

export interface DeliveryResult { delivered: boolean; reason?: string }

@Injectable()
export class NotificationsService {
  private log = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService, private cfg: ConfigService) {}

  notify(userId: string, type: string, title: string, body: string, data: Prisma.InputJsonValue = {}) {
    return this.prisma.notification.create({ data: { userId, type, title, body, data } });
  }

  list(userId: string, q: PageQuery & { unread?: boolean }) {
    const where: Prisma.NotificationWhereInput = { userId, ...(q.unread ? { readAt: null } : {}) };
    return paginate(q, this.prisma.notification.count({ where }), (skip, take) =>
      this.prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    );
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  /**
   * Email delivery is not wired to a provider yet. Returns delivered=false instead of pretending.
   * In non-production the message is logged so local flows (password reset) remain testable.
   */
  async sendEmail(to: string, subject: string, text: string): Promise<DeliveryResult> {
    if (this.cfg.get('env') !== 'production') this.log.warn(`[email not configured] to=${to} subject="${subject}" body="${text}"`);
    else this.log.warn(`[email not configured] message to ${to} dropped`);
    return { delivered: false, reason: 'email_provider_not_configured' };
  }

  async sendPush(userId: string, title: string): Promise<DeliveryResult> {
    this.log.debug(`[push not configured] user=${userId} title="${title}"`);
    return { delivered: false, reason: 'push_provider_not_configured' };
  }
}
