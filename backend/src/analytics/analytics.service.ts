import { Injectable } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
  ) {}

  async overview(companyId: string) {
    const now = new Date();
    const TICKETS_LIMIT = 2000;

    const createdCount = await this.prisma.ticket.count({
      where: { companyId },
    });

    const openByStatusGrouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: {
        companyId,
        status: {
          in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
        },
      },
      _count: { _all: true },
    });

    const openByStatus: {
      NEW: number;
      ASSIGNED: number;
      IN_PROGRESS: number;
    } = {
      NEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
    };

    for (const row of openByStatusGrouped) {
      if (row.status === TicketStatus.NEW) openByStatus.NEW = row._count._all;
      if (row.status === TicketStatus.ASSIGNED) openByStatus.ASSIGNED = row._count._all;
      if (row.status === TicketStatus.IN_PROGRESS) openByStatus.IN_PROGRESS = row._count._all;
    }

    const backlogOpenTotal =
      openByStatus.NEW + openByStatus.ASSIGNED + openByStatus.IN_PROGRESS;

    const unassignedOpenTickets = await this.prisma.ticket.count({
      where: {
        companyId,
        status: {
          in: [TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
        },
        assignedTechnicianId: null,
      },
    });

    const slaEvaluatedCount = await this.prisma.ticket.count({
      where: {
        companyId,
        slaDueAt: { not: null },
      },
    });

    const slaBreachedCount = await this.prisma.ticket.count({
      where: {
        companyId,
        slaBreachedAt: { not: null },
      },
    });

    const slaOkCount = Math.max(slaEvaluatedCount - slaBreachedCount, 0);

    const okPercent =
      slaEvaluatedCount > 0
        ? Math.round((slaOkCount / slaEvaluatedCount) * 10000) / 100
        : 0;

    const breachedPercent =
      slaEvaluatedCount > 0
        ? Math.round((slaBreachedCount / slaEvaluatedCount) * 10000) / 100
        : 0;

    const tickets = await this.prisma.ticket.findMany({
      where: { companyId },
      select: {
        id: true,
        createdAt: true,
        assignedTechnicianId: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
      take: TICKETS_LIMIT,
    });

    const ticketIds = tickets.map((t) => t.id);
    const createdAtById = new Map<string, Date>();

    for (const t of tickets) {
      createdAtById.set(t.id, t.createdAt);
    }

    const technicians = await this.prisma.user.findMany({
      where: {
        companyId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        email: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const technicianEmailById = new Map<string, string>();
    for (const tech of technicians) {
      technicianEmailById.set(tech.id, tech.email);
    }

    if (ticketIds.length === 0) {
      return {
        createdCount,
        openByStatus,
        summary: {
          backlogOpenTotal,
          unassignedOpenTickets,
        },
        sla: {
          evaluatedCount: slaEvaluatedCount,
          breachedCount: slaBreachedCount,
          okPercent,
          breachedPercent,
        },
        timing: {
          evaluatedTickets: 0,
          meanTimeToAssignMinutes: 0,
          meanTimeToResolveMinutes: 0,
          note: 'No tickets available for timing metrics',
        },
        workloadByTechnician: [],
        throughputByTechnician: [],
        note: 'overview v4 (timeline-backed)',
        now,
      };
    }

    const timelineEvents = await this.timelineService.listTicketEvents(companyId, ticketIds);
    const firstAssignedAt = new Map<string, Date>();
    const firstDoneAt = new Map<string, Date>();

    for (const event of timelineEvents) {
      if (
        (event.timelineEvent === 'TICKET_ASSIGNED' || event.timelineEvent === 'TICKET_CLAIMED') &&
        !firstAssignedAt.has(event.ticketId)
      ) {
        firstAssignedAt.set(event.ticketId, event.at);
      }

      const payload = event.payload as { toStatus?: TicketStatus } | null;

      if (
        event.timelineEvent === 'STATUS_CHANGED' &&
        payload?.toStatus === TicketStatus.DONE &&
        !firstDoneAt.has(event.ticketId)
      ) {
        firstDoneAt.set(event.ticketId, event.at);
      }
    }

    let assignSum = 0;
    let assignN = 0;

    let resolveSum = 0;
    let resolveN = 0;

    for (const id of ticketIds) {
      const createdAt = createdAtById.get(id);
      if (!createdAt) continue;

      const assignedAt = firstAssignedAt.get(id);
      if (assignedAt && assignedAt.getTime() > createdAt.getTime()) {
        assignSum += (assignedAt.getTime() - createdAt.getTime()) / 60000;
        assignN += 1;
      }

      const doneAt = firstDoneAt.get(id);
      if (doneAt && doneAt.getTime() > createdAt.getTime()) {
        resolveSum += (doneAt.getTime() - createdAt.getTime()) / 60000;
        resolveN += 1;
      }
    }

    const meanTimeToAssignMinutes =
      assignN > 0 ? Math.round((assignSum / assignN) * 100) / 100 : 0;

    const meanTimeToResolveMinutes =
      resolveN > 0 ? Math.round((resolveSum / resolveN) * 100) / 100 : 0;

    const openTicketsWithAssignee = await this.prisma.ticket.findMany({
      where: {
        companyId,
        status: {
          in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
        },
        assignedTechnicianId: { not: null },
      },
      select: {
        assignedTechnicianId: true,
        status: true,
      },
    });

    const workloadMap = new Map<
      string,
      {
        technicianId: string;
        technicianEmail: string;
        assignedOpenCount: number;
        inProgressCount: number;
        totalOpenCount: number;
      }
    >();

    for (const row of openTicketsWithAssignee) {
      const technicianId = row.assignedTechnicianId;
      if (!technicianId) continue;

      const existing = workloadMap.get(technicianId) ?? {
        technicianId,
        technicianEmail: technicianEmailById.get(technicianId) ?? technicianId,
        assignedOpenCount: 0,
        inProgressCount: 0,
        totalOpenCount: 0,
      };

      if (row.status === TicketStatus.ASSIGNED) {
        existing.assignedOpenCount += 1;
      }

      if (row.status === TicketStatus.IN_PROGRESS) {
        existing.inProgressCount += 1;
      }

      existing.totalOpenCount += 1;

      workloadMap.set(technicianId, existing);
    }

    const workloadByTechnician = Array.from(workloadMap.values()).sort((a, b) => {
      if (b.totalOpenCount !== a.totalOpenCount) {
        return b.totalOpenCount - a.totalOpenCount;
      }
      return a.technicianEmail.localeCompare(b.technicianEmail);
    });

    const doneByTech = new Map<string, number>();

    for (const t of tickets) {
      if (t.status !== TicketStatus.DONE) continue;
      if (!t.assignedTechnicianId) continue;

      doneByTech.set(
        t.assignedTechnicianId,
        (doneByTech.get(t.assignedTechnicianId) ?? 0) + 1,
      );
    }

    const throughputByTechnician = Array.from(doneByTech.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technicianId, doneCount]) => ({
        technicianId,
        technicianEmail: technicianEmailById.get(technicianId) ?? technicianId,
        doneCount,
      }));

    return {
      createdCount,
      openByStatus,
      summary: {
        backlogOpenTotal,
        unassignedOpenTickets,
      },
      sla: {
        evaluatedCount: slaEvaluatedCount,
        breachedCount: slaBreachedCount,
        okPercent,
        breachedPercent,
      },
      timing: {
        evaluatedTickets: ticketIds.length,
        meanTimeToAssignMinutes,
        meanTimeToResolveMinutes,
        note: 'Mean times computed from ticket.createdAt to first assignment/claim and DONE timeline events over last N tickets',
      },
      workloadByTechnician,
      throughputByTechnician,
      now,
      note: 'overview v4 (counts + backlog + sla percent + workload + throughput + timeline mean times)',
    };
  }
}
