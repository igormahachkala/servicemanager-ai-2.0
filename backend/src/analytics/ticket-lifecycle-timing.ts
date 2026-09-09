import { TicketStatus } from '@prisma/client'

/**
 * SMA-TICKET-LIFECYCLE-TIME-ANALYTICS-108A.
 *
 * Разбор жизненного цикла заявки по канонической истории статусов.
 * Здесь нет обращений к БД и нет правил доступа: на вход приходят уже
 * отобранные строки, на выходе — отметки времени и длительности.
 *
 * Правила выведены из фактической истории Production (998 заявок, 5586 переходов),
 * а не из предположений о том, как «должно быть»:
 *
 *   ASSIGNED            937 из NEW, 163 из ASSIGNED  → переназначения существуют
 *   IN_PROGRESS         860 из ASSIGNED, 912 из IN_PROGRESS → 912 самопереходов
 *   AWAITING_ACCEPTANCE 806 из IN_PROGRESS, 21 самопереход
 *   DONE                732 из AWAITING_ACCEPTANCE, 58 напрямую из IN_PROGRESS
 *
 * Отсюда два решения, без которых цифры были бы неверными.
 *
 * 1. Самопереходы (fromStatus === toStatus) отбрасываются. Их 912 только у
 *    IN_PROGRESS — это пересохранение статуса, а не новое начало работы.
 *    Если их учитывать, «начало работ» у 848 заявок из 863 определится неверно.
 *
 * 2. Считается ПЕРВОЕ вхождение каждого этапа, а не последнее. Переназначение,
 *    возврат из приёмки и повторная работа не должны задним числом сдвигать
 *    момент, когда заявку впервые назначили или впервые начали делать.
 *    Поэтому имена явные: firstAssignedAt, firstWorkStartedAt.
 *
 * 3. «Выполнена» — это передача на приёмку (AWAITING_ACCEPTANCE). Но 58 заявок
 *    закрывались напрямую IN_PROGRESS → DONE, минуя приёмку. Для них момент
 *    выполнения совпадает с DONE, иначе выполнение у них не посчиталось бы вовсе.
 *
 * 4. «Принята» — переход в DONE. Роль исполнителя перехода намеренно не
 *    проверяется: в Production DONE ставят и MASTER, и ADMIN, и NETWORK_DIRECTOR,
 *    и TECHNICIAN. Это момент закрытия работ, а не доказательство того, что
 *    кнопку нажал именно клиент.
 */

/** Строка истории статусов в объёме, нужном для расчёта. */
export type TicketStatusHistoryRow = {
  fromStatus: TicketStatus | null
  toStatus: TicketStatus
  createdAt: Date
}

export type TicketLifecycleInput = {
  createdAt: Date
  closedAt?: Date | null
  statusHistory: TicketStatusHistoryRow[]
}

export type TicketLifecycleTimestamps = {
  createdAt: Date
  firstAssignedAt: Date | null
  firstWorkStartedAt: Date | null
  awaitingAcceptanceAt: Date | null
  completedAt: Date | null
  acceptedAt: Date | null
  closedAt: Date | null
}

/**
 * Длительности этапов в миллисекундах. null означает «этап не наступил»,
 * а не ноль: заявку без назначения нельзя считать назначенной мгновенно.
 */
export type TicketLifecycleDurations = {
  timeToAssignment: number | null
  timeAssignmentToWork: number | null
  timeToCompletion: number | null
  workCycleTime: number | null
  acceptanceWaitTime: number | null
  totalLifecycleTime: number | null
}

export type DurationSummary = {
  count: number
  averageMs: number | null
  medianMs: number | null
  p75Ms: number | null
  p90Ms: number | null
}

/** Самопереход статуса — техническая запись, этапом не является. */
function isRealTransition(row: TicketStatusHistoryRow): boolean {
  return row.fromStatus !== row.toStatus
}

function sortedByTime(rows: TicketStatusHistoryRow[]): TicketStatusHistoryRow[] {
  return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

function firstEntryInto(
  rows: TicketStatusHistoryRow[],
  status: TicketStatus,
): Date | null {
  const row = rows.find((item) => item.toStatus === status && isRealTransition(item))
  return row ? row.createdAt : null
}

export function resolveTicketLifecycleTimestamps(
  ticket: TicketLifecycleInput,
): TicketLifecycleTimestamps {
  const rows = sortedByTime(ticket.statusHistory ?? [])

  const firstAssignedAt = firstEntryInto(rows, TicketStatus.ASSIGNED)
  const firstWorkStartedAt = firstEntryInto(rows, TicketStatus.IN_PROGRESS)
  const awaitingAcceptanceAt = firstEntryInto(rows, TicketStatus.AWAITING_ACCEPTANCE)
  const acceptedAt = firstEntryInto(rows, TicketStatus.DONE)

  // Выполнение = передача на приёмку; для заявок, закрытых напрямую из работы,
  // моментом выполнения считается сам DONE.
  const completedAt = awaitingAcceptanceAt ?? acceptedAt

  return {
    createdAt: ticket.createdAt,
    firstAssignedAt,
    firstWorkStartedAt,
    awaitingAcceptanceAt,
    completedAt,
    acceptedAt,
    closedAt: ticket.closedAt ?? null,
  }
}

/**
 * Разность двух отметок. null, если какой-то из концов не наступил.
 * Отрицательные значения отбрасываются: расхождение часов или правка истории
 * не должны создавать «минус два часа» в среднем.
 */
function diff(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null
  const ms = to.getTime() - from.getTime()
  return ms >= 0 ? ms : null
}

export function computeTicketLifecycleDurations(
  timestamps: TicketLifecycleTimestamps,
): TicketLifecycleDurations {
  const finishedAt = timestamps.acceptedAt ?? timestamps.closedAt

  return {
    timeToAssignment: diff(timestamps.createdAt, timestamps.firstAssignedAt),
    timeAssignmentToWork: diff(timestamps.firstAssignedAt, timestamps.firstWorkStartedAt),
    timeToCompletion: diff(timestamps.createdAt, timestamps.completedAt),
    workCycleTime: diff(timestamps.firstWorkStartedAt, timestamps.completedAt),
    acceptanceWaitTime: diff(timestamps.awaitingAcceptanceAt, timestamps.acceptedAt),
    totalLifecycleTime: diff(timestamps.createdAt, finishedAt),
  }
}

/**
 * Перцентиль по методу «ближайшего ранга» на отсортированном массиве.
 * Медиана чётной длины — среднее двух серединных значений, как её обычно и ждут.
 */
function percentile(sortedValues: number[], fraction: number): number | null {
  if (sortedValues.length === 0) return null
  if (sortedValues.length === 1) return sortedValues[0]

  const position = fraction * (sortedValues.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sortedValues[lower]
  const weight = position - lower
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

/**
 * Сводка по набору длительностей.
 *
 * Среднего мало: несколько «висяков» смещают его так, что операционно им
 * пользоваться нельзя. Поэтому рядом всегда идут медиана и хвосты.
 * Значения null (этап не наступил) в расчёт не входят и не считаются нулями.
 */
export function summarizeDurations(values: Array<number | null | undefined>): DurationSummary {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (numbers.length === 0) {
    return { count: 0, averageMs: null, medianMs: null, p75Ms: null, p90Ms: null }
  }

  const sorted = [...numbers].sort((a, b) => a - b)
  const total = sorted.reduce((sum, value) => sum + value, 0)

  return {
    count: sorted.length,
    averageMs: Math.round(total / sorted.length),
    medianMs: Math.round(percentile(sorted, 0.5) as number),
    p75Ms: Math.round(percentile(sorted, 0.75) as number),
    p90Ms: Math.round(percentile(sorted, 0.9) as number),
  }
}

export const TICKET_LIFECYCLE_METRICS = [
  'timeToAssignment',
  'timeAssignmentToWork',
  'timeToCompletion',
  'workCycleTime',
  'acceptanceWaitTime',
  'totalLifecycleTime',
] as const

export type TicketLifecycleMetric = (typeof TICKET_LIFECYCLE_METRICS)[number]

export type TicketLifecycleSummary = Record<TicketLifecycleMetric, DurationSummary> & {
  tickets: number
}

/** Сводка по набору заявок: по одной строке на каждую метрику. */
export function summarizeTicketLifecycles(
  durations: TicketLifecycleDurations[],
): TicketLifecycleSummary {
  const summary = {} as TicketLifecycleSummary
  for (const metric of TICKET_LIFECYCLE_METRICS) {
    summary[metric] = summarizeDurations(durations.map((row) => row[metric]))
  }
  summary.tickets = durations.length
  return summary
}
