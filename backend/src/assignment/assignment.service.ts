import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentCandidate, AssignmentContext, AssignmentDecision, AssignmentStrategy } from './assignment.types';
import { decideAssignment } from './assignment.strategies';

@Injectable()
export class AssignmentService {
  // v2: persisted cursor round-robin (позже можно сделать company setting)
  private readonly strategy: AssignmentStrategy = 'round_robin_cursor_v2';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Важно:
   * - Если вызывается внутри транзакции TicketsService, передавай tx, чтобы cursor update был атомарен
   *   вместе с созданием/изменением тикета и domain events.
   * - Если tx не передан — используем PrismaService напрямую (будет отдельной транзакцией).
   */
  async decide(
    ctx: AssignmentContext,
    candidates: AssignmentCandidate[],
    tx?: Prisma.TransactionClient,
  ): Promise<AssignmentDecision> {
    if (!candidates || candidates.length === 0) {
      return { assignedTechnicianId: null, strategy: this.strategy, reason: 'no_candidates' };
    }

    if (this.strategy !== 'round_robin_cursor_v2') {
      // legacy / fallback
      const seed = ctx.ticketId ?? `${ctx.companyId}:${ctx.problemCategoryId}`;
      return decideAssignment(this.strategy, candidates, { seed });
    }

    const prisma = tx ?? this.prisma;
    const strategyKey = this.strategy; // string key stored in cursor table

    // 1) гарантируем наличие cursor row
    const cursorRow = await prisma.assignmentCursor.upsert({
      where: {
        companyId_strategy: {
          companyId: ctx.companyId,
          strategy: strategyKey,
        },
      },
      create: {
        companyId: ctx.companyId,
        strategy: strategyKey,
        cursor: 0,
      },
      update: {},
    });

    // 2) выбираем кандидата по текущему cursor
    const idx = cursorRow.cursor % candidates.length;
    const assignedTechnicianId = candidates[idx].id;

    // 3) увеличиваем cursor (атомарно)
    await prisma.assignmentCursor.update({
      where: { id: cursorRow.id },
      data: { cursor: { increment: 1 } },
    });

    return {
      assignedTechnicianId,
      strategy: this.strategy,
      reason: `cursor=${cursorRow.cursor} idx=${idx} N=${candidates.length}`,
    };
  }
}
