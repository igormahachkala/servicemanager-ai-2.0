import { TicketStatus } from '@prisma/client'

import {
  computeTicketLifecycleDurations,
  resolveTicketLifecycleTimestamps,
  summarizeDurations,
  summarizeTicketLifecycles,
  type TicketStatusHistoryRow,
} from './ticket-lifecycle-timing'

/**
 * SMA-TICKET-LIFECYCLE-TIME-ANALYTICS-108A.
 *
 * Сценарии взяты из фактической истории Production, а не придуманы:
 * переназначения (163 перехода), самопереходы IN_PROGRESS (912), возвраты
 * из приёмки (27) и закрытие напрямую из работы (58) там встречаются реально.
 */

const T = (iso: string) => new Date(iso)
const MIN = 60_000
const HOUR = 60 * MIN

function row(
  from: TicketStatus | null,
  to: TicketStatus,
  at: string,
): TicketStatusHistoryRow {
  return { fromStatus: from, toStatus: to, createdAt: T(at) }
}

/** Обычный полный путь: создана → назначена → в работе → на приёмке → принята. */
const FULL_HISTORY: TicketStatusHistoryRow[] = [
  row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
  row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
  row(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, '2026-09-01T12:00:00Z'),
  row(TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_ACCEPTANCE, '2026-09-01T13:00:00Z'),
  row(TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE, '2026-09-01T15:00:00Z'),
]

function lifecycle(history: TicketStatusHistoryRow[], closedAt?: string) {
  return computeTicketLifecycleDurations(
    resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      closedAt: closedAt ? T(closedAt) : null,
      statusHistory: history,
    }),
  )
}

describe('resolveTicketLifecycleTimestamps', () => {
  it('1-5: полный цикл раскладывается по этапам', () => {
    const ts = resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      closedAt: T('2026-09-01T15:00:00Z'),
      statusHistory: FULL_HISTORY,
    })

    expect(ts.firstAssignedAt).toEqual(T('2026-09-01T10:15:00Z'))
    expect(ts.firstWorkStartedAt).toEqual(T('2026-09-01T12:00:00Z'))
    expect(ts.awaitingAcceptanceAt).toEqual(T('2026-09-01T13:00:00Z'))
    expect(ts.completedAt).toEqual(T('2026-09-01T13:00:00Z'))
    expect(ts.acceptedAt).toEqual(T('2026-09-01T15:00:00Z'))
  })

  it('пример из задачи считается ровно как в постановке', () => {
    const d = lifecycle(FULL_HISTORY, '2026-09-01T15:00:00Z')

    expect(d.timeToAssignment).toBe(15 * MIN)
    expect(d.timeAssignmentToWork).toBe(105 * MIN)
    expect(d.workCycleTime).toBe(HOUR)
    expect(d.timeToCompletion).toBe(3 * HOUR)
    expect(d.acceptanceWaitTime).toBe(2 * HOUR)
    expect(d.totalLifecycleTime).toBe(5 * HOUR)
  })

  it('самопереходы IN_PROGRESS не считаются новым началом работ', () => {
    // 912 таких переходов в Production; без фильтра «начало работ» уехало бы.
    const ts = resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      statusHistory: [
        row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
        row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
        row(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, '2026-09-01T12:00:00Z'),
        row(TicketStatus.IN_PROGRESS, TicketStatus.IN_PROGRESS, '2026-09-01T12:30:00Z'),
        row(TicketStatus.IN_PROGRESS, TicketStatus.IN_PROGRESS, '2026-09-01T12:45:00Z'),
      ],
    })

    expect(ts.firstWorkStartedAt).toEqual(T('2026-09-01T12:00:00Z'))
  })

  it('9: переназначение не сдвигает момент первого назначения', () => {
    const ts = resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      statusHistory: [
        row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
        row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
        row(TicketStatus.ASSIGNED, TicketStatus.ASSIGNED, '2026-09-01T14:00:00Z'),
      ],
    })

    expect(ts.firstAssignedAt).toEqual(T('2026-09-01T10:15:00Z'))
  })

  it('8: возврат из приёмки не сдвигает первое выполнение и первую приёмку', () => {
    const ts = resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      statusHistory: [
        row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
        row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
        row(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, '2026-09-01T11:00:00Z'),
        row(TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_ACCEPTANCE, '2026-09-01T12:00:00Z'),
        // клиент вернул в работу
        row(TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.IN_PROGRESS, '2026-09-01T13:00:00Z'),
        row(TicketStatus.IN_PROGRESS, TicketStatus.AWAITING_ACCEPTANCE, '2026-09-01T14:00:00Z'),
        row(TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE, '2026-09-01T15:00:00Z'),
      ],
    })

    expect(ts.firstWorkStartedAt).toEqual(T('2026-09-01T11:00:00Z'))
    expect(ts.awaitingAcceptanceAt).toEqual(T('2026-09-01T12:00:00Z'))
    expect(ts.acceptedAt).toEqual(T('2026-09-01T15:00:00Z'))
  })

  it('закрытие напрямую из работы: выполнение совпадает с DONE', () => {
    // 58 таких заявок в Production; иначе у них не посчиталось бы выполнение.
    const ts = resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      statusHistory: [
        row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
        row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
        row(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, '2026-09-01T11:00:00Z'),
        row(TicketStatus.IN_PROGRESS, TicketStatus.DONE, '2026-09-01T12:00:00Z'),
      ],
    })

    expect(ts.awaitingAcceptanceAt).toBeNull()
    expect(ts.completedAt).toEqual(T('2026-09-01T12:00:00Z'))
    expect(ts.acceptedAt).toEqual(T('2026-09-01T12:00:00Z'))
  })

  it('порядок строк истории не влияет на результат', () => {
    const shuffled = [...FULL_HISTORY].reverse()
    const ts = resolveTicketLifecycleTimestamps({
      createdAt: T('2026-09-01T10:00:00Z'),
      statusHistory: shuffled,
    })

    expect(ts.firstAssignedAt).toEqual(T('2026-09-01T10:15:00Z'))
    expect(ts.firstWorkStartedAt).toEqual(T('2026-09-01T12:00:00Z'))
  })
})

describe('computeTicketLifecycleDurations — незавершённые заявки', () => {
  it('6: заявка без назначения не даёт ни одной длительности этапа', () => {
    const d = lifecycle([row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z')])

    expect(d.timeToAssignment).toBeNull()
    expect(d.timeAssignmentToWork).toBeNull()
    expect(d.timeToCompletion).toBeNull()
    expect(d.workCycleTime).toBeNull()
    expect(d.acceptanceWaitTime).toBeNull()
    expect(d.totalLifecycleTime).toBeNull()
  })

  it('7: незавершённая заявка даёт ранние этапы и не даёт поздние', () => {
    const d = lifecycle([
      row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
      row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
      row(TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, '2026-09-01T12:00:00Z'),
    ])

    expect(d.timeToAssignment).toBe(15 * MIN)
    expect(d.timeAssignmentToWork).toBe(105 * MIN)
    expect(d.timeToCompletion).toBeNull()
    expect(d.totalLifecycleTime).toBeNull()
  })

  it('незавершённая заявка не превращается в ноль — иначе среднее занижается', () => {
    const d = lifecycle([row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z')])
    expect(d.totalLifecycleTime).not.toBe(0)
  })

  it('отрицательная разность отбрасывается, а не портит среднее', () => {
    const d = lifecycle([
      row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
      // назначение «раньше» создания — расхождение часов либо правка истории
      row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T09:00:00Z'),
    ])
    expect(d.timeToAssignment).toBeNull()
  })

  it('closedAt используется как финал, когда приёмки не было', () => {
    const d = lifecycle(
      [
        row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
        row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:15:00Z'),
      ],
      '2026-09-01T18:00:00Z',
    )
    expect(d.totalLifecycleTime).toBe(8 * HOUR)
  })
})

describe('summarizeDurations', () => {
  it('18: медиана и среднее считаются раздельно и расходятся на выбросах', () => {
    // Пример из постановки: среднее много больше медианы.
    const s = summarizeDurations([HOUR, HOUR, HOUR, 100 * HOUR])

    expect(s.count).toBe(4)
    expect(s.medianMs).toBe(HOUR)
    expect(s.averageMs).toBe(Math.round((103 * HOUR) / 4))
    expect(s.averageMs).toBeGreaterThan(s.medianMs as number)
  })

  it('медиана чётной длины — среднее двух серединных', () => {
    expect(summarizeDurations([1000, 3000]).medianMs).toBe(2000)
  })

  it('перцентили упорядочены и не выходят за пределы выборки', () => {
    const s = summarizeDurations([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(s.medianMs as number).toBeLessThanOrEqual(s.p75Ms as number)
    expect(s.p75Ms as number).toBeLessThanOrEqual(s.p90Ms as number)
    expect(s.p90Ms as number).toBeLessThanOrEqual(10)
  })

  it('19: пустая выборка возвращает нули и null, а не падает', () => {
    expect(summarizeDurations([])).toEqual({
      count: 0,
      averageMs: null,
      medianMs: null,
      p75Ms: null,
      p90Ms: null,
    })
  })

  it('null-значения не считаются нулями и не входят в count', () => {
    const s = summarizeDurations([null, undefined, 2 * HOUR, null])
    expect(s.count).toBe(1)
    expect(s.averageMs).toBe(2 * HOUR)
  })

  it('одно значение даёт одинаковые среднее, медиану и хвосты', () => {
    const s = summarizeDurations([5 * MIN])
    expect(s).toEqual({
      count: 1,
      averageMs: 5 * MIN,
      medianMs: 5 * MIN,
      p75Ms: 5 * MIN,
      p90Ms: 5 * MIN,
    })
  })
})

describe('summarizeTicketLifecycles', () => {
  it('считает каждую метрику по своей подвыборке', () => {
    const finished = lifecycle(FULL_HISTORY, '2026-09-01T15:00:00Z')
    const assignedOnly = lifecycle([
      row(null, TicketStatus.NEW, '2026-09-01T10:00:00Z'),
      row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-01T10:45:00Z'),
    ])

    const summary = summarizeTicketLifecycles([finished, assignedOnly])

    expect(summary.tickets).toBe(2)
    // назначение есть у обеих
    expect(summary.timeToAssignment.count).toBe(2)
    expect(summary.timeToAssignment.medianMs).toBe(30 * MIN)
    // полный цикл — только у первой
    expect(summary.totalLifecycleTime.count).toBe(1)
    expect(summary.totalLifecycleTime.averageMs).toBe(5 * HOUR)
  })

  it('19: набор без заявок не ломает сводку', () => {
    const summary = summarizeTicketLifecycles([])
    expect(summary.tickets).toBe(0)
    expect(summary.totalLifecycleTime.count).toBe(0)
    expect(summary.totalLifecycleTime.averageMs).toBeNull()
  })

  it('20: отметки сравниваются как моменты времени, а не как локальные даты', () => {
    // Один и тот же момент в разных зонах — длительность не меняется.
    const utc = computeTicketLifecycleDurations(
      resolveTicketLifecycleTimestamps({
        createdAt: new Date('2026-09-01T23:30:00Z'),
        statusHistory: [
          row(null, TicketStatus.NEW, '2026-09-01T23:30:00Z'),
          row(TicketStatus.NEW, TicketStatus.ASSIGNED, '2026-09-02T00:30:00Z'),
        ],
      }),
    )
    const shifted = computeTicketLifecycleDurations(
      resolveTicketLifecycleTimestamps({
        createdAt: new Date('2026-09-02T04:30:00+05:00'),
        statusHistory: [
          { fromStatus: null, toStatus: TicketStatus.NEW, createdAt: new Date('2026-09-02T04:30:00+05:00') },
          {
            fromStatus: TicketStatus.NEW,
            toStatus: TicketStatus.ASSIGNED,
            createdAt: new Date('2026-09-02T05:30:00+05:00'),
          },
        ],
      }),
    )

    expect(utc.timeToAssignment).toBe(HOUR)
    expect(shifted.timeToAssignment).toBe(HOUR)
  })
})
