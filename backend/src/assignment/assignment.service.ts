import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentCandidate, AssignmentContext, AssignmentDecision, AssignmentStrategy } from './assignment.types';
import { decideAssignment } from './assignment.strategies';

@Injectable()
export class AssignmentService {
  private readonly strategy: AssignmentStrategy = 'round_robin_cursor_v2';

  constructor(private readonly prisma: PrismaService) {}

  async decide(
    ctx: AssignmentContext,
    candidates: AssignmentCandidate[],
    tx?: Prisma.TransactionClient,
  ): Promise<AssignmentDecision> {
    if (!candidates || candidates.length === 0) {
      return { assignedTechnicianId: null, strategy: this.strategy, reason: 'no_candidates' };
    }

    if (this.strategy !== 'round_robin_cursor_v2') {
      const seed = ctx.ticketId ?? `${ctx.companyId}:${ctx.problemCategoryId}`;
      return decideAssignment(this.strategy, candidates, { seed });
    }

    const prisma = tx ?? this.prisma;
    const strategyKey = this.strategy;

    const maxMatched = Math.max(...candidates.map((c) => c.matchedSpecializationsCount));
    const bestMatched = candidates.filter((c) => c.matchedSpecializationsCount === maxMatched);

    const minActiveLoad = Math.min(...bestMatched.map((c) => c.activeLoad));
    const leastLoaded = bestMatched.filter((c) => c.activeLoad === minActiveLoad);

    const minInProgress = Math.min(...leastLoaded.map((c) => c.inProgressCount));
    const finalists = leastLoaded.filter((c) => c.inProgressCount === minInProgress);

    if (finalists.length === 1) {
      const winner = finalists[0];
      return {
        assignedTechnicianId: winner.id,
        strategy: this.strategy,
        reason: `best_match=${winner.matchedSpecializationsCount};active_load=${winner.activeLoad};in_progress=${winner.inProgressCount};single_best`,
      };
    }

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

    const sortedFinalists = [...finalists].sort((a, b) => a.id.localeCompare(b.id));
    const idx = cursorRow.cursor % sortedFinalists.length;
    const winner = sortedFinalists[idx];

    await prisma.assignmentCursor.update({
      where: { id: cursorRow.id },
      data: { cursor: { increment: 1 } },
    });

    return {
      assignedTechnicianId: winner.id,
      strategy: this.strategy,
      reason: `best_match=${winner.matchedSpecializationsCount};active_load=${winner.activeLoad};in_progress=${winner.inProgressCount};cursor=${cursorRow.cursor};idx=${idx};finalists=${sortedFinalists.length}`,
    };
  }
}
