import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(companyId: string) {
    const now = new Date();

    // 1) counts by status
    const grouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: { companyId },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const s of Object.values(TicketStatus)) counts[s] = 0;
    for (const row of grouped) counts[row.status] = row._count._all;

    // 2) SLA breach v2 (по slaDueAt / slaBreachedAt / closedAt)
    const slaTickets = await this.prisma.ticket.findMany({
      where: {
        companyId,
        OR: [{ slaMinutes: { not: null } }, { slaDueAt: { not: null } }],
      },
      select: {
        id: true,
        createdAt: true,
        slaMinutes: true,
        slaDueAt: true,
        slaBreachedAt: true,
        closedAt: true,
      },
      take: 5000,
      orderBy: { createdAt: 'desc' },
    });

    let slaTotal = 0;
    let slaBreached = 0;

    for (const t of slaTickets) {
      const mins = t.slaMinutes ?? null;

      const hasSla = (typeof mins === 'number' && mins > 0) || t.slaDueAt !== null;
      if (!hasSla) continue;

      const dueAt =
        t.slaDueAt ??
        (typeof mins === 'number' && mins > 0
          ? new Date(t.createdAt.getTime() + mins * 60_000)
          : null);

      if (!dueAt) continue;

      slaTotal += 1;

      const breached =
        t.slaBreachedAt !== null ||
        (t.closedAt !== null
          ? t.closedAt.getTime() > dueAt.getTime()
          : now.getTime() > dueAt.getTime());

      if (breached) slaBreached += 1;
    }

    // 3) Avg time in status v2:
    // - учитываем NEW от ticket.createdAt
    // - учитываем "хвост" последнего статуса до closedAt/now
    // - работаем только по последним N тикетам, чтобы не убивать базу
    const TICKETS_LIMIT = 2000;

    const tickets = await this.prisma.ticket.findMany({
      where: { companyId },
      select: {
        id: true,
        createdAt: true,
        closedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: TICKETS_LIMIT,
    });

    const ticketMap = new Map<
      string,
      { createdAt: Date; endAt: Date }
    >();

    const ticketIds: string[] = [];
    for (const t of tickets) {
      ticketIds.push(t.id);
      ticketMap.set(t.id, {
        createdAt: t.createdAt,
        endAt: t.closedAt ?? now,
      });
    }

    // если тикетов нет — просто вернём нули
    const sums: Record<string, number> = {}; // total minutes
    const nums: Record<string, number> = {}; // number of intervals

    for (const s of Object.values(TicketStatus)) {
      sums[s] = 0;
      nums[s] = 0;
    }

    if (ticketIds.length > 0) {
      const history = await this.prisma.ticketStatusHistory.findMany({
        where: { ticketId: { in: ticketIds } },
        orderBy: [{ ticketId: 'asc' }, { createdAt: 'asc' }],
        select: { ticketId: true, toStatus: true, createdAt: true },
        take: 50000,
      });

      // сгруппируем историю по ticketId
      const byTicket = new Map<string, { toStatus: TicketStatus; createdAt: Date }[]>();
      for (const h of history) {
        const arr = byTicket.get(h.ticketId) ?? [];
        arr.push({ toStatus: h.toStatus, createdAt: h.createdAt });
        byTicket.set(h.ticketId, arr);
      }

      for (const ticketId of ticketIds) {
        const base = ticketMap.get(ticketId);
        if (!base) continue;

        const endAt = base.endAt;
        const createdAt = base.createdAt;

        // checkpoints: статус и время входа в статус
        const checkpoints: { status: TicketStatus; at: Date }[] = [];
        checkpoints.push({ status: TicketStatus.NEW, at: createdAt });

        const events = byTicket.get(ticketId) ?? [];

        // добавляем события как входы в статусы, но аккуратно:
        // - пропускаем дубли статуса подряд
        // - пропускаем события, которые раньше/равны предыдущему checkpoint
        for (const e of events) {
          const last = checkpoints[checkpoints.length - 1];
          if (e.createdAt.getTime() <= last.at.getTime()) continue;
          if (e.toStatus === last.status) continue;
          checkpoints.push({ status: e.toStatus, at: e.createdAt });
        }

        // посчитать интервалы между checkpoints + хвост до endAt
        for (let i = 0; i < checkpoints.length; i++) {
          const cur = checkpoints[i];
          const nextAt =
            i + 1 < checkpoints.length ? checkpoints[i + 1].at : endAt;

          if (nextAt.getTime() <= cur.at.getTime()) continue;

          const minutes = (nextAt.getTime() - cur.at.getTime()) / 60000;

          sums[cur.status] += minutes;
          nums[cur.status] += 1;
        }
      }
    }

    const avgMinutesInStatus: Record<string, number> = {};
    for (const s of Object.values(TicketStatus)) {
      const n = nums[s] ?? 0;
      avgMinutesInStatus[s] = n ? Math.round((sums[s] / n) * 100) / 100 : 0;
    }

    return {
      counts,
      sla: {
        evaluated: slaTotal,
        breached: slaBreached,
        breachedRate: slaTotal ? Math.round((slaBreached / slaTotal) * 10000) / 100 : 0,
      },
      avgMinutesInStatus,
      note: 'v1 counts + SLA v2 (dueAt/breachedAt/closedAt) + avgMinutesInStatus v2 (createdAt + tail)',
    };
  }
}
