import type { Prisma } from '@prisma/client';

import { nextOccurrenceAfter } from './inspection-recurrence';

export type ScheduleAdvanceResult =
  | { outcome: 'advanced'; scheduleId: string; nextDueAt: Date }
  | { outcome: 'finished'; scheduleId: string }
  | {
      outcome: 'skipped';
      reason: 'not_found' | 'not_current_occurrence' | 'already_advanced';
    };

/**
 * SMA-ROUNDS-RECURRENCE-FIX — закрыть визит плана завершённым обходом.
 *
 * Обход закрывает визит, только если он и есть текущий визит: его dueAt равен
 * nextDueAt плана. Обход прошлого визита, обход «от руки» и повторное завершение
 * план не двигают — иначе один визит сдвинул бы расписание дважды.
 *
 * Запись идёт сравнением с обменом: updateMany с условием на прежний nextDueAt.
 * Два завершения, проскочившие проверку одновременно, сдвинут план один раз —
 * второе увидит count = 0.
 *
 * Следующий срок — первый по сетке после max(срок визита, момент завершения).
 * Поздно закрытый визит не оставляет за собой хвост просроченных: пропущенные
 * сроки покрыты этим обходом, следующий — уже в будущем.
 *
 * Перенесённый визит (replacedDueAt задан) закрывает слот сетки, который он
 * заменил, а не тот, что ближе к новому сроку. Перенос раньше не возвращает
 * план на тот же слот второй раз, перенос позже не перепрыгивает следующий.
 *
 * Однократный план
 * после своего визита выключается: следующего визита у него нет, а активный
 * план с прошедшим сроком навсегда числился бы просроченным.
 *
 * Компания — та же, что у обхода: план и его исполнение принадлежат одному
 * провайдеру (startRun ищет план по companyId актора). Фильтр стоит и здесь,
 * чтобы чужой scheduleId в строке обхода не мог тронуть чужой план.
 */
export async function advanceScheduleAfterRun(
  tx: Prisma.TransactionClient,
  run: {
    scheduleId: string;
    companyId: string;
    dueAt: Date | null;
    completedAt: Date;
  },
): Promise<ScheduleAdvanceResult> {
  const schedule = await tx.inspectionSchedule.findFirst({
    where: { id: run.scheduleId, companyId: run.companyId },
    select: {
      id: true,
      frequency: true,
      intervalDays: true,
      startDate: true,
      nextDueAt: true,
      replacedDueAt: true,
      company: { select: { timezone: true } },
    },
  });
  if (!schedule) return { outcome: 'skipped', reason: 'not_found' };
  if (!run.dueAt || schedule.nextDueAt.getTime() !== run.dueAt.getTime()) {
    return { outcome: 'skipped', reason: 'not_current_occurrence' };
  }

  const closedUntil = new Date(
    Math.max(
      run.dueAt.getTime(),
      run.completedAt.getTime(),
      schedule.replacedDueAt?.getTime() ?? -Infinity,
    ),
  );
  const next = nextOccurrenceAfter(
    schedule,
    closedUntil,
    schedule.company?.timezone,
  );

  const { count } = await tx.inspectionSchedule.updateMany({
    where: { id: schedule.id, companyId: run.companyId, nextDueAt: run.dueAt },
    data: next
      ? { nextDueAt: next, replacedDueAt: null }
      : { isActive: false, replacedDueAt: null },
  });
  if (count === 0) return { outcome: 'skipped', reason: 'already_advanced' };

  return next
    ? { outcome: 'advanced', scheduleId: schedule.id, nextDueAt: next }
    : { outcome: 'finished', scheduleId: schedule.id };
}
