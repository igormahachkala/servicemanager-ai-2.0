import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(companyId: string) {
    const now = new Date();

    const TICKETS_LIMIT = 2000;

    // 1) Base counts
    const createdCount = await this.prisma.ticket.count({ where: { companyId } });

    const openByStatusGrouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: {
        companyId,
        status: { in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
      },
      _count: { _all: true },
    });

    const openByStatus: Record<string, number> = {
      NEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
    };
    for (const row of openByStatusGrouped) openByStatus[row.status] = row._count._all;

    // 2) SLA breached count (истина теперь slaBreachedAt)
    const slaBreachedCount = await this.prisma.ticket.count({
      where: { companyId, slaBreachedAt: { not: null } },
    });

    // 3) Берём последние N тикетов — на них считаем “время до assign/done”
    const tickets = await this.prisma.ticket.findMany({
      where: { companyId },
      select: { id: true, createdAt: true, assignedTechnicianId: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: TICKETS_LIMIT,
    });

    const ticketIds = tickets.map((t) => t.id);
    const createdAtById = new Map<string, Date>();
    for (const t of tickets) createdAtById.set(t.id, t.createdAt);

    // Если тикетов нет — возвращаем базовую структуру
    if (ticketIds.length === 0) {
      return {
        createdCount,
        openByStatus,
        sla: { breachedCount: slaBreachedCount },
        timing: {
          evaluatedTickets: 0,
          meanTimeToAssignMinutes: 0,
          meanTimeToResolveMinutes: 0,
        },
        throughputByTechnician: [],
        note: 'overview v2 (empty)',
        now,
      };
    }

    // 4) История статусов по этим тикетам
    const history = await this.prisma.ticketStatusHistory.findMany({
      where: { ticketId: { in: ticketIds } },
      select: { ticketId: true, toStatus: true, createdAt: true },
      orderBy: [{ ticketId: 'asc' }, { createdAt: 'asc' }],
      take: 100000,
    });

    // 5) Находим первые моменты ASSIGNED и DONE по каждому тикету
    const firstAssignedAt = new Map<string, Date>();
    const firstDoneAt = new Map<string, Date>();

    for (const h of history) {
      if (h.toStatus === TicketStatus.ASSIGNED && !firstAssignedAt.has(h.ticketId)) {
        firstAssignedAt.set(h.ticketId, h.createdAt);
      }
      if (h.toStatus === TicketStatus.DONE && !firstDoneAt.has(h.ticketId)) {
        firstDoneAt.set(h.ticketId, h.createdAt);
      }
    }

    // 6) Считаем средние времена
    let assignSum = 0;
    let assignN = 0;

    let resolveSum = 0;
    let resolveN = 0;

    for (const id of ticketIds) {
      const createdAt = createdAtById.get(id);
      if (!createdAt) continue;

      const a = firstAssignedAt.get(id);
      if (a && a.getTime() > createdAt.getTime()) {
        assignSum += (a.getTime() - createdAt.getTime()) / 60000;
        assignN += 1;
      }

      const d = firstDoneAt.get(id);
      if (d && d.getTime() > createdAt.getTime()) {
        resolveSum += (d.getTime() - createdAt.getTime()) / 60000;
        resolveN += 1;
      }
    }

    const meanTimeToAssignMinutes = assignN ? Math.round((assignSum / assignN) * 100) / 100 : 0;
    const meanTimeToResolveMinutes = resolveN ? Math.round((resolveSum / resolveN) * 100) / 100 : 0;

    // 7) Throughput by technician (DONE) по последним N тикетам
    // Считаем по Ticket.status = DONE и assignedTechnicianId != null
    const doneByTech = new Map<string, number>();
    for (const t of tickets) {
      if (t.status !== TicketStatus.DONE) continue;
      if (!t.assignedTechnicianId) continue;
      doneByTech.set(t.assignedTechnicianId, (doneByTech.get(t.assignedTechnicianId) ?? 0) + 1);
    }

    const throughputByTechnician = Array.from(doneByTech.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technicianId, doneCount]) => ({ technicianId, doneCount }));

    return {
      createdCount,
      openByStatus,
      sla: {
        breachedCount: slaBreachedCount,
      },
      timing: {
        evaluatedTickets: ticketIds.length,
        meanTimeToAssignMinutes,
        meanTimeToResolveMinutes,
        note:
          'Mean times computed from ticket.createdAt to first ASSIGNED/DONE status history event over last N tickets',
      },
      throughputByTechnician,
      now,
      note: 'overview v2 (counts + slaBreachedAt + mean times + throughput top10 over last N tickets)',
    };
  }
}
