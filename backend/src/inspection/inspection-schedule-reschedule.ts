import { BadRequestException, ConflictException } from '@nestjs/common';
import { InspectionRunStatus, type Prisma } from '@prisma/client';
import { isISO8601 } from 'class-validator';

import { emitDomainEventTx } from '../events/events.bus';
import { PrismaService } from '../prisma/prisma.service';
import {
  INSTANT_WITH_ZONE,
  RescheduleNextOccurrenceDto,
} from './dto/reschedule-next-occurrence.dto';
import {
  nextOccurrenceAfter,
  recurrenceStep,
  type RecurrenceInput,
} from './inspection-recurrence';

type ScheduleSnapshot = RecurrenceInput & {
  id: string;
  isActive: boolean;
  updatedAt: Date;
  nextDueAt: Date;
  replacedDueAt: Date | null;
  company: { timezone: string | null } | null;
};

export function nextOccurrenceConflict() {
  return new ConflictException({
    code: 'INSPECTION_SCHEDULE_NEXT_OCCURRENCE_CONFLICT',
    message:
      'План изменён, снят с плана или обход уже начат. Обновите план перед переносом.',
  });
}

function parseInstant(value: string, field: string): Date {
  if (
    typeof value !== 'string' ||
    !INSTANT_WITH_ZONE.test(value) ||
    !isISO8601(value, { strict: true })
  )
    throw new BadRequestException(`Invalid ${field}`);
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()))
    throw new BadRequestException(`Invalid ${field}`);
  return result;
}

/**
 * Move only the unstarted cursor, never an InspectionRun or recurrence anchor.
 * The caller first applies the existing management policy and location scope.
 * The existing DomainEvent store records old/new dates in the same transaction.
 */
export async function moveNextOccurrence<T>(
  prisma: PrismaService,
  companyId: string,
  actorUserId: string,
  current: ScheduleSnapshot,
  dto: RescheduleNextOccurrenceDto,
  readUpdated: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const target = parseInstant(dto.nextDueAt, 'nextDueAt');
  const revision = parseInstant(dto.expectedUpdatedAt, 'expectedUpdatedAt');
  const cursor = parseInstant(dto.expectedNextDueAt, 'expectedNextDueAt');
  if (
    !current.isActive ||
    !recurrenceStep(current) ||
    current.updatedAt.getTime() !== revision.getTime() ||
    current.nextDueAt.getTime() !== cursor.getTime()
  )
    throw nextOccurrenceConflict();
  if (target.getTime() <= Date.now())
    throw new BadRequestException('Новый срок должен быть в будущем.');
  if (target.getTime() === cursor.getTime())
    throw new BadRequestException('Выберите другой срок.');

  // Перенос заменяет один слот сетки, тот же при повторных переносах. Новый
  // срок обязан остаться раньше следующего слота: иначе после выполнения план
  // молча пропустил бы визит, а далёкая дата погасила бы всю серию.
  const replaced = current.replacedDueAt ?? cursor;
  const nextSlot = nextOccurrenceAfter(
    current,
    replaced,
    current.company?.timezone,
  );
  if (nextSlot && target.getTime() >= nextSlot.getTime()) {
    throw new BadRequestException({
      code: 'INSPECTION_SCHEDULE_NEXT_OCCURRENCE_TOO_LATE',
      message: 'Новый срок должен быть раньше следующего визита по плану: перенос не может пропустить визит.',
      nextSlotDueAt: nextSlot.toISOString(),
    });
  }

  return prisma.$transaction(async (tx) => {
    const updatedAt = new Date(Math.max(Date.now(), revision.getTime() + 1));
    // The exact same row/revision reservation as createScheduledRun. A start or
    // second move makes this predicate fail once PostgreSQL releases the row.
    const { count } = await tx.inspectionSchedule.updateMany({
      where: {
        id: current.id,
        companyId,
        isActive: true,
        updatedAt: revision,
        nextDueAt: cursor,
        runs: {
          none: { status: InspectionRunStatus.IN_PROGRESS },
          some: { status: InspectionRunStatus.COMPLETED },
        },
      },
      data: {
        nextDueAt: target,
        // Возврат на исходный слот снимает перенос.
        replacedDueAt:
          target.getTime() === replaced.getTime() ? null : replaced,
        updatedAt,
      },
    });
    if (count !== 1) throw nextOccurrenceConflict();

    // Read history only after acquiring the schedule row. Any subsequent start
    // must wait, and any failed validation rolls the cursor AND revision back.
    // A max over ALL facts also rejects an already used dueAt, without assuming
    // createdAt order equals the order in which occurrences were completed.
    const history = await tx.inspectionRun.aggregate({
      where: { scheduleId: current.id, companyId },
      _max: { dueAt: true, completedAt: true },
    });
    const closedUntil = Math.max(
      history._max.dueAt?.getTime() ?? -Infinity,
      history._max.completedAt?.getTime() ?? -Infinity,
    );
    if (!Number.isFinite(closedUntil)) throw nextOccurrenceConflict();
    if (target.getTime() <= Math.max(Date.now(), closedUntil)) {
      throw new BadRequestException(
        'Новый срок должен быть в будущем и позже сроков и завершений всех предыдущих обходов.',
      );
    }
    // Completion continues the grid after max(dueAt, completedAt, replaced),
    // so an earlier move adds no visit and a later one skips none.
    await emitDomainEventTx(tx, {
      type: 'inspection.schedule_updated',
      entityType: 'InspectionSchedule',
      companyId,
      entityId: current.id,
      actorUserId,
      payload: {
        action: 'next_occurrence_rescheduled',
        oldNextDueAt: cursor.toISOString(),
        newNextDueAt: target.toISOString(),
        replacedDueAt: replaced.toISOString(),
        expectedUpdatedAt: revision.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    });
    return readUpdated(tx);
  });
}
