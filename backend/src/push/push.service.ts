import { createHash } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import type { PushPreference, PushSubscription } from '@prisma/client';
import * as webpush from 'web-push';

import { PrismaService } from '../prisma/prisma.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UpdatePushPreferencesDto } from './dto/update-push-preferences.dto';

/**
 * Payload, который читает web/public/sw.js (см. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §2а/§3).
 * Отправляем строго эти поля — SW не знает других.
 */
export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
  targetRoute?: string;
  ticketId?: string;
  notificationType?: string;
  linkedClientCompanyId?: string | null;
  companyId?: string | null;
  navigate?: string;
  badge?: number;
  silent?: boolean;
};

/**
 * Типы событий = булевы поля PushPreference (тумблеры на /push-settings).
 * sendToUser с одним из этих типов уважает соответствующий тумблер получателя.
 * 'test' и прочие строки трактуются как «без гейта» (шлём всегда).
 */
export type PushEventType =
  | 'chat'
  | 'ticketNew'
  | 'assignment'
  | 'statusChange'
  | 'acceptance'
  | 'acceptanceReject'
  | 'sla'
  | 'news';

const PUSH_PREF_KEYS: readonly string[] = [
  'chat',
  'ticketNew',
  'assignment',
  'statusChange',
  'acceptance',
  'acceptanceReject',
  'sla',
  'news',
];

/**
 * Web Push (mobile-поток). См. docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §4.
 * Синхронная отправка (без очереди) — этого достаточно для /push/test и доменных триггеров;
 * очередь/ретраи можно добавить позже, не меняя контракт эндпоинтов.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapidConfigured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    const privateKey = process.env.VAPID_PRIVATE_KEY || '';
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
    this.vapidConfigured = Boolean(publicKey && privateKey);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn(
        'VAPID keys not configured — push sending disabled (endpoints still respond).',
      );
    }
  }

  /** GET /push/vapid-public-key — фронт подписывается этим ключом. Пусто => sending выключен. */
  getVapidPublicKey(): { key: string } {
    return { key: process.env.VAPID_PUBLIC_KEY || '' };
  }

  /** POST /push/subscriptions — upsert по endpoint (эндпоинт глобально уникален). */
  async saveSubscription(
    userId: string,
    companyId: string,
    dto: SubscribePushDto,
    userAgent?: string,
  ): Promise<{ ok: boolean }> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        companyId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        platform: dto.platform ?? null,
        userAgent: userAgent ?? null,
        declarative: dto.declarative ?? false,
      },
      update: {
        // endpoint мог «переехать» на другого пользователя того же устройства — актуализируем владельца.
        userId,
        companyId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        platform: dto.platform ?? null,
        userAgent: userAgent ?? null,
        declarative: dto.declarative ?? false,
        lastSeenAt: new Date(),
        failCount: 0,
        disabledAt: null,
      },
    });
    return { ok: true };
  }

  /** DELETE /push/subscriptions — снятие подписки (idempotent). */
  async removeSubscription(
    userId: string,
    endpoint: string,
  ): Promise<{ ok: boolean }> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
    return { ok: true };
  }

  /** POST /push/subscriptions/heartbeat — продлеваем «живость» подписки. */
  async heartbeat(userId: string, endpoint: string): Promise<{ ok: boolean }> {
    await this.prisma.pushSubscription.updateMany({
      where: { endpoint, userId },
      data: { lastSeenAt: new Date(), failCount: 0, disabledAt: null },
    });
    return { ok: true };
  }

  /** GET /push/preferences — создаём дефолт при первом обращении. */
  async getPreferences(userId: string): Promise<PushPreference> {
    return this.prisma.pushPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  /** PATCH /push/preferences — частичное обновление (upsert, чтобы работать без предварительного GET). */
  async updatePreferences(
    userId: string,
    patch: UpdatePushPreferencesDto,
  ): Promise<PushPreference> {
    return this.prisma.pushPreference.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: { ...patch },
    });
  }

  /** POST /push/test — отправляет тестовый push на все активные подписки пользователя. */
  async sendTest(userId: string): Promise<{ ok: boolean }> {
    const payload: PushPayload = {
      title: 'Сервис Менеджер',
      body: 'Тестовое уведомление — push работает ✅',
      tag: 'push-test',
      url: '/m',
      targetRoute: '/m',
      notificationType: 'test',
      navigate: '/m',
      badge: 1,
    };
    const sent = await this.sendToUser(userId, payload, 'test');
    return { ok: sent > 0 };
  }

  /**
   * Отправка payload на все активные подписки пользователя.
   * Возвращает число успешных доставок. Мёртвые эндпоинты (404/410) отключаются.
   */
  async sendToUser(
    userId: string,
    payload: PushPayload,
    eventType: string,
    entityId?: string,
  ): Promise<number> {
    if (!this.vapidConfigured) {
      this.logger.warn(
        `sendToUser(${eventType}) skipped — VAPID not configured.`,
      );
      return 0;
    }
    // Уважать пользовательские тумблеры: если тип события совпадает с полем
    // PushPreference и оно выключено — не слать. Нет строки настроек = дефолты (слать).
    if (PUSH_PREF_KEYS.includes(eventType)) {
      const pref = await this.prisma.pushPreference.findUnique({
        where: { userId },
      });
      if (pref && (pref as Record<string, unknown>)[eventType] === false) {
        return 0;
      }
    }
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId, disabledAt: null },
    });
    let ok = 0;
    for (const sub of subs) {
      const delivered = await this.sendToSubscription(
        sub,
        payload,
        eventType,
        entityId,
      );
      if (delivered) ok += 1;
    }
    return ok;
  }

  private async sendToSubscription(
    sub: PushSubscription,
    payload: PushPayload,
    eventType: string,
    entityId?: string,
  ): Promise<boolean> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        payload.tag
          ? { headers: { Topic: this.safeTopic(payload.tag) } }
          : undefined,
      );
      await this.prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastSeenAt: new Date(), failCount: 0 },
      });
      await this.log(sub.id, eventType, entityId, 'ok');
      return true;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 404 Not Found / 410 Gone — подписка мертва у push-сервиса, отключаем её.
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { disabledAt: new Date(), failCount: { increment: 1 } },
        });
        await this.log(sub.id, eventType, entityId, `gone:${statusCode}`);
      } else {
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { failCount: { increment: 1 } },
        });
        await this.log(
          sub.id,
          eventType,
          entityId,
          `error:${statusCode ?? 'unknown'}`,
        );
        this.logger.warn(
          `push send failed (sub ${sub.id}, ${eventType}): ${String(err)}`,
        );
      }
      return false;
    }
  }

  private async log(
    subscriptionId: string,
    eventType: string,
    entityId: string | undefined,
    status: string,
  ): Promise<void> {
    try {
      await this.prisma.pushDeliveryLog.create({
        data: { subscriptionId, eventType, entityId: entityId ?? null, status },
      });
    } catch {
      // журнал доставки не критичен — не роняем отправку из-за него
    }
  }

  /**
   * Apple-safe значение заголовка `Topic` (collapse-key). Apple (web.push.apple.com)
   * строже RFC 8030 и отвергает наши теги (`push-test`, `ticketId:type`, `news:id`)
   * с `BadWebPushTopic` (спецсимволы `:`, дефис, длина >32). Хэшируем тег в 32
   * hex-символа [0-9a-f] — Apple принимает, а группировка сохраняется (одинаковый
   * tag → одинаковый Topic). Клиентская группировка идёт отдельно через payload.tag в sw.js.
   */
  private safeTopic(tag: string): string {
    return createHash('sha256').update(tag).digest('hex').slice(0, 32);
  }
}
