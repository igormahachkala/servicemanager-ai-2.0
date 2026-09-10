import { BadRequestException, Injectable } from '@nestjs/common';
import { TicketAttachmentPurpose, TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EquipmentService } from './equipment.service';
import { buildEquipmentHistory } from './equipment-history.model';

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * История обслуживания единицы. Доступ не решается здесь: он целиком
 * делегирован EquipmentService.findOne — тому же каноническому пути, которым
 * открывается карточка. Не видно карточку — не видно и историю, без второго
 * набора правил.
 */

/**
 * SMA-EQUIPMENT-PARTS-POLISH-110C.
 *
 * Страница истории. 110B отдавал последние 200 и молча обрезал остальное —
 * по такой карточке нельзя было отличить «заявок было 200» от «их 900,
 * и семисот вы не видите». Теперь выдача постраничная, и хвост достижим.
 *
 * Пагинация курсорная, а не по offset. Заявки приходят постоянно, и при
 * offset вставка новой строки сдвигает окно: одна и та же заявка попадает
 * на две страницы либо пропадает между ними. Курсор по (createdAt, id)
 * от вставок не зависит.
 */
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Курсор — пара «дата создания, id». Одной даты мало: у заявок, созданных
 * в одну миллисекунду, порядок был бы неопределённым, и строка могла бы
 * повториться на следующей странице. id разрывает ничью и делает порядок
 * строгим.
 */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(raw?: string): { createdAt: Date; id: string } | null {
  const value = (raw || '').trim();
  if (!value) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestException('Некорректный курсор');
  }
  const sep = decoded.lastIndexOf('|');
  if (sep <= 0) throw new BadRequestException('Некорректный курсор');
  const createdAt = new Date(decoded.slice(0, sep));
  const id = decoded.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) {
    throw new BadRequestException('Некорректный курсор');
  }
  return { createdAt, id };
}

function resolveLimit(raw?: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PAGE_SIZE;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 1) {
    throw new BadRequestException('Некорректный размер страницы');
  }
  return Math.min(Math.floor(num), MAX_PAGE_SIZE);
}

@Injectable()
export class EquipmentHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipmentService: EquipmentService,
  ) {}

  async getHistory(
    actorCompanyId: string,
    actorUserId: string,
    actorRole: UserRole,
    equipmentId: string,
    requestedCompanyId?: string,
    page: { limit?: unknown; cursor?: string } = {},
  ) {
    const limit = resolveLimit(page.limit);
    const cursor = decodeCursor(page.cursor);

    const equipment = await this.equipmentService.findOne(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
      requestedCompanyId,
    );

    const rows = await this.prisma.ticket.findMany({
      // companyId рядом с equipmentId — изоляция арендаторов не должна
      // зависеть от того, что связь оборудования уже проверена выше.
      where: {
        equipmentId,
        companyId: equipment.companyId,
        // Строгий порядок (createdAt desc, id desc): берём то, что «меньше»
        // курсора по этой паре.
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        ticketNumber: true,
        createdAt: true,
        closedAt: true,
        status: true,
        problemText: true,
        problemCategory: { select: { name: true } },
        assignedTechnician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: { select: { id: true, name: true } },
          },
        },
        statusHistory: {
          where: {
            toStatus: { in: [TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE] },
          },
          select: {
            toStatus: true,
            comment: true,
            createdAt: true,
            changedBy: { select: { firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          where: { purpose: TicketAttachmentPurpose.WORK_REPORT },
          select: {
            id: true,
            url: true,
            originalName: true,
            mimeType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      // На одну больше запрошенного: лишняя строка отвечает на вопрос
      // «есть ли ещё», не требуя отдельного count по всей истории.
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const tickets = hasMore ? rows.slice(0, limit) : rows;
    const last = tickets[tickets.length - 1];

    // Состав работ по деталям берётся только отсюда — из явно занесённых строк,
    // а не из текста заявки. Тянем только по заявкам этой страницы: грузить
    // все детали единицы ради 25 строк незачем.
    const pageTicketIds = tickets.map((row) => row.id);
    const parts = pageTicketIds.length
      ? await this.prisma.installedPart.findMany({
      where: {
        equipmentId,
        companyId: equipment.companyId,
        OR: [
          { installedTicketId: { in: pageTicketIds } },
          { removedTicketId: { in: pageTicketIds } },
        ],
      },
      select: {
        id: true,
        displayName: true,
        serialNumber: true,
        quantity: true,
        installedTicketId: true,
        removedTicketId: true,
      },
        })
      : [];

    return {
      equipment: {
        id: equipment.id,
        name: equipment.name,
        companyId: equipment.companyId,
        locationId: equipment.locationId,
      },
      tickets: buildEquipmentHistory(tickets as any, parts as any),
      page: {
        limit,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
      },
    };
  }
}
