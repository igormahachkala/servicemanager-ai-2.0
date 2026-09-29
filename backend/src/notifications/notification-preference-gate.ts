import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';

import {
  NotificationPreferencesService,
  type NotificationPreferenceDecision,
} from './notification-preferences.service';

/**
 * SMA-NOTIFICATION-PREFERENCES-V2-105B.
 *
 * Ворота настроек уведомлений на единственном пути записи Notification.
 *
 * Порядок остаётся каноническим и не меняется:
 *
 *   событие → разрешение доступа → настройка → Notification → канал
 *
 * Ворота стоят последними и умеют ровно одно: убрать получателя, которого
 * доступ уже разрешил. Добавить получателя они не могут физически — на вход
 * приходит готовый список строк, и метод только фильтрует его.
 *
 * Второго резолвера доступа и второго резолвера настроек здесь нет:
 * доступ посчитан раньше (filterRecipientsByTicketAccess), решение по настройке
 * принимает NotificationPreferencesService из 105A, контур берётся из уже
 * существующего ServiceContractsService.getLinkedClientAccess.
 */

/** Минимум, который ворота читают у строки уведомления. */
export type PreferenceGateRow = {
  userId: string;
  companyId: string;
  type: string;
  linkedClientCompanyId?: string | null;
};

/**
 * Подавляем только по явно выставленной настройке.
 *
 * SYSTEM_DEFAULT в каталоге 105A — это список «что предлагать включённым»
 * в настройках (105C), а не описание того, что рассылается сегодня: для части
 * ролей он пуст. Гасить по нему значило бы молча выключить доставку, которая
 * сейчас работает в Production. Обратная совместимость важнее: компания без
 * настроек обязана получать ровно то же, что получала до 105B.
 *
 * LEGACY_PUSH_PREFERENCE тоже не гасит: это тумблер push, и им нельзя
 * выключать in-app. На канале PUSH его по-прежнему уважает PushService —
 * дублировать эту логику здесь не нужно.
 *
 * UNKNOWN_EVENT и INVALID_INPUT означают «данных о настройке нет».
 * Отсутствие данных не запрещает доставку: запрет — это решение, а не пробел.
 */
const SUPPRESSING_SOURCES = new Set(['USER_OVERRIDE']);

export function shouldSuppress(
  decision: NotificationPreferenceDecision,
): boolean {
  return decision.enabled === false && SUPPRESSING_SOURCES.has(decision.source);
}

@Injectable()
export class NotificationPreferenceGate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
    private readonly serviceContracts: ServiceContractsService,
  ) {}

  /**
   * Отфильтровать строки уведомлений по настройкам получателей.
   * Возвращается подмножество входа — новых получателей не появляется.
   */
  async filterRows<T extends PreferenceGateRow>(
    rows: T[],
    channel: NotificationChannel,
  ): Promise<T[]> {
    if (!rows.length) return rows;
    if (channel !== NotificationChannel.IN_APP) return rows;

    /**
     * Быстрый выход: пока ни у одной задетой компании нет ни одной настройки,
     * решать нечего. Веер получателей на одно событие большой, и без этой
     * проверки каждая строка стоила бы двух запросов резолвера впустую.
     */
    const companyIds = [
      ...new Set(rows.map((row) => row.companyId).filter(Boolean)),
    ];
    if (!(await this.anyPreferenceConfigured(companyIds))) return rows;

    const roles = await this.loadRoles(rows);
    const contourCache = new Map<string, NotificationContour | null>();
    const kept: T[] = [];

    for (const row of rows) {
      const role = roles.get(row.userId);
      if (!role) {
        // Получателя не прочитали — это не решение выключить доставку.
        kept.push(row);
        continue;
      }

      const contour = await this.resolveContour(row, contourCache);
      if (!contour) {
        kept.push(row);
        continue;
      }

      const decision = await this.preferences.resolvePreference({
        companyId: row.companyId,
        contour,
        role,
        userId: row.userId,
        eventType: row.type,
        channel,
      });

      if (!shouldSuppress(decision)) kept.push(row);
    }

    return kept;
  }

  private async anyPreferenceConfigured(
    companyIds: string[],
  ): Promise<boolean> {
    if (!companyIds.length) return false;
    const userScoped = await this.prisma.userNotificationPreference.count({
      where: {
        companyId: { in: companyIds },
        channel: NotificationChannel.IN_APP,
        enabled: false,
      },
      take: 1,
    } as any);
    return userScoped > 0;
  }

  private async loadRoles(
    rows: PreferenceGateRow[],
  ): Promise<Map<string, UserRole>> {
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
    if (!userIds.length) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, role: true },
    });
    return new Map(users.map((user) => [user.id, user.role]));
  }

  /**
   * Контур получателя.
   *
   * Строка уведомления уже несёт linkedClientCompanyId: он пуст, когда получатель
   * сидит в компании самой заявки, и заполнен, когда заявку ведёт провайдер.
   * Роль провайдера по этому клиенту берётся из действующего контракта тем же
   * методом, которым её берут остальные подсистемы.
   */
  private async resolveContour(
    row: PreferenceGateRow,
    cache: Map<string, NotificationContour | null>,
  ): Promise<NotificationContour | null> {
    const clientCompanyId = (row.linkedClientCompanyId || '').trim();
    if (!clientCompanyId) return NotificationContour.CLIENT;

    const key = `${row.companyId}:${clientCompanyId}`;
    if (cache.has(key)) return cache.get(key) ?? null;

    let contour: NotificationContour | null = null;
    try {
      const access = await this.serviceContracts.getLinkedClientAccess(
        row.companyId,
        clientCompanyId,
      );
      if (access) {
        contour =
          access.role === 'SECONDARY'
            ? NotificationContour.SECONDARY_PROVIDER
            : NotificationContour.PRIMARY_PROVIDER;
      }
    } catch {
      // Контракт не прочитали — настройку не применяем, доставку не рушим.
      contour = null;
    }

    cache.set(key, contour);
    return contour;
  }
}
