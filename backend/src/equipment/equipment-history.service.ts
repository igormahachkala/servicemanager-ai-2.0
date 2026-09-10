import { Injectable } from '@nestjs/common';
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

/** Заявок на единицу за годы набирается много; карточка показывает последние. */
const MAX_HISTORY_TICKETS = 200;

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
  ) {
    const equipment = await this.equipmentService.findOne(
      actorCompanyId,
      actorUserId,
      actorRole,
      equipmentId,
      requestedCompanyId,
    );

    const tickets = await this.prisma.ticket.findMany({
      // companyId рядом с equipmentId — изоляция арендаторов не должна
      // зависеть от того, что связь оборудования уже проверена выше.
      where: { equipmentId, companyId: equipment.companyId },
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
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_TICKETS,
    });

    // Состав работ по деталям берётся только отсюда — из явно занесённых строк,
    // а не из текста заявки.
    const parts = await this.prisma.installedPart.findMany({
      where: { equipmentId, companyId: equipment.companyId },
      select: {
        id: true,
        displayName: true,
        serialNumber: true,
        quantity: true,
        installedTicketId: true,
        removedTicketId: true,
      },
    });

    return {
      equipment: {
        id: equipment.id,
        name: equipment.name,
        companyId: equipment.companyId,
        locationId: equipment.locationId,
      },
      tickets: buildEquipmentHistory(tickets as any, parts as any),
      truncated: tickets.length === MAX_HISTORY_TICKETS,
    };
  }
}
