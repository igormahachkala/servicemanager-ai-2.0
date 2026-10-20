import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';

@Injectable()
export class SlaWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaWorkerService.name);

  private readonly intervalMs = 60_000;
  private readonly warningBeforeMs = 60 * 60_000; // 60 минут до дедлайна
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        this.logger.error('SLA tick failed', err?.stack || String(err));
      });
    }, this.intervalMs);

    this.tick().catch((err) => this.logger.error('Initial SLA tick failed', err?.stack || String(err)));

    this.logger.log(`SLA worker started (interval=${this.intervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.logger.log('SLA worker stopped');
  }

  private async tick() {
    const now = new Date();
    const warningFrom = new Date(now.getTime());
    const warningTo = new Date(now.getTime() + this.warningBeforeMs);

    await this.emitWarnings(now, warningFrom, warningTo);
    await this.markBreached(now);
  }

  private async emitWarnings(now: Date, warningFrom: Date, warningTo: Date) {
    const candidates = await this.prisma.ticket.findMany({
      where: {
        slaDueAt: {
          gt: warningFrom,
          lte: warningTo,
        },
        slaBreachedAt: null,
        status: {
          notIn: [TicketStatus.DONE, TicketStatus.CANCELED],
        },
      },
      select: {
        id: true,
        companyId: true,
        slaDueAt: true,
        status: true,
      },
    });

    if (candidates.length === 0) return;

    let createdCount = 0;

    for (const ticket of candidates) {
      const existing = await this.prisma.domainEvent.findFirst({
        where: {
          companyId: ticket.companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          type: 'ticket.sla_warning',
        },
        select: { id: true },
      });

      if (existing) continue;

      await this.prisma.$transaction(async (tx) => {
        await this.timelineService.recordTx(tx, {
          event: 'SLA_WARNING',
          companyId: ticket.companyId,
          ticketId: ticket.id,
          actorUserId: null,
          payload: {
            status: ticket.status,
            slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
            warningBeforeMinutes: Math.floor(this.warningBeforeMs / 60_000),
            warningAt: now.toISOString(),
          },
        });
      });

      createdCount += 1;
    }

    if (createdCount > 0) {
      this.logger.warn(`SLA warning emitted for ${createdCount} ticket(s)`);
    }
  }

  private async markBreached(now: Date) {
    const candidates = await this.prisma.ticket.findMany({
      where: {
        slaDueAt: { lt: now },
        slaBreachedAt: null,
        status: { notIn: [TicketStatus.DONE, TicketStatus.CANCELED] },
      },
      select: {
        id: true,
        companyId: true,
        slaDueAt: true,
        status: true,
      },
    });

    if (candidates.length === 0) return;

    let breachedCount = 0;

    for (const ticket of candidates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            slaBreachedAt: now,
          },
        });

        await this.timelineService.recordTx(tx, {
          event: 'SLA_BREACH',
          companyId: ticket.companyId,
          ticketId: ticket.id,
          actorUserId: null,
          payload: {
            status: ticket.status,
            slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
            breachedAt: now.toISOString(),
          },
        });
      });

      breachedCount += 1;
    }

    if (breachedCount > 0) {
      this.logger.warn(`SLA breached marked for ${breachedCount} ticket(s)`);
    }
  }
}
