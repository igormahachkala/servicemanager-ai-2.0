import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class SlaWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaWorkerService.name);

  // Можно будет вынести в env, но пока фиксируем безопасный дефолт
  private readonly intervalMs = 60_000; // 1 минута
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Стартуем worker после поднятия модуля
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        this.logger.error('SLA tick failed', err?.stack || String(err));
      });
    }, this.intervalMs);

    // Первый прогон сразу, чтобы не ждать минуту
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

    // Обновляем пачкой: SLA просрочен, breach ещё не ставили, тикет не закрыт/не отменён
    const res = await this.prisma.ticket.updateMany({
      where: {
        slaDueAt: { lt: now },
        slaBreachedAt: null,
        status: { notIn: [TicketStatus.DONE, TicketStatus.CANCELED] },
      },
      data: {
        slaBreachedAt: now,
      },
    });

    if (res.count > 0) {
      this.logger.warn(`SLA breached marked for ${res.count} ticket(s)`);
    }
  }
}
