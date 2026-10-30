import { describe, expect, it } from 'vitest'
import {
  buildPlanFact,
  completedTiming,
  planFactOptions,
  planFactPeriod,
  planFactQueries,
  scopePlanFact,
} from './inspectionPlanFact'
import { FILTER, NOW, data, plan, run } from './inspectionPlanFact.fixtures'

describe('observed round plan/fact', () => {
  it('does not close the next future occurrence using an old completed run', () => {
    const result = buildPlanFact(data(), FILTER)
    expect(result.plans[0]).toMatchObject({
      label: 'План · факт не подтверждён',
      overdue: false,
      run: undefined,
    })
    expect(result.completed).toHaveLength(1)
    expect(result.completed[0].title).toBe('Историческое название')
    expect(result.lateCount).toBe(1)
  })
  it('deduplicates plan/run ids and prefers completion over stale active data', () => {
    const result = buildPlanFact(
      data({
        schedules: [plan(), plan()],
        completed: [run(), run()],
        active: [run({ status: 'IN_PROGRESS' })],
      }),
      FILTER,
    )
    expect(result.plans).toHaveLength(1)
    expect(result.completed).toHaveLength(1)
    expect(result.active).toHaveLength(0)
  })
  it('links only the matching occurrence and location, not merely scheduleId', () => {
    const pending = run({
      id: 'active-1',
      status: 'IN_PROGRESS',
      completedAt: null,
      dueAt: plan().nextDueAt,
    })
    expect(
      buildPlanFact(data({ active: [pending] }), FILTER).plans[0].label,
    ).toBe('В процессе')
    pending.location = {
      id: 'other',
      name: 'Другой',
      clientCompanyId: 'client-1',
    }
    expect(
      buildPlanFact(data({ active: [pending] }), FILTER).plans[0].run,
    ).toBeUndefined()
    pending.location = {
      id: 'loc-1',
      name: 'Другой контур',
      clientCompanyId: 'client-2',
    }
    expect(
      buildPlanFact(data({ active: [pending] }), FILTER).plans[0].run,
    ).toBeUndefined()
  })
  it('uses captured grace deadline for late completion and does not invent missing values', () => {
    expect(completedTiming(run())).toBe('late')
    expect(completedTiming(run({ overdueAt: '2026-10-22T00:00:00Z' }))).toBe(
      'on-time',
    )
    expect(completedTiming(run({ overdueAt: null }))).toBe('unknown')
    expect(completedTiming(run({ completedAt: 'invalid' }))).toBe('unknown')
    expect(
      buildPlanFact(
        data({
          schedules: [
            plan({
              nextDueAt: '2026-10-20T09:00:00Z',
              overdueAt: '2026-10-20T09:00:00Z',
              isOverdue: true,
            }),
          ],
          completed: [],
        }),
        FILTER,
      ).overdueCount,
    ).toBe(1)
  })
  it('does not reassign historical performer when current worker changes', () => {
    const old = buildPlanFact(data(), { ...FILTER, employeeId: 'worker-old' })
    expect(old.completed).toHaveLength(1)
    expect(old.plans).toHaveLength(0)
    const next = buildPlanFact(data(), { ...FILTER, employeeId: 'worker-new' })
    expect(next.completed).toHaveLength(0)
    expect(next.plans).toHaveLength(1)
    expect(run().performedBy?.id).toBe('worker-old')
  })
  it('uses completedAt for old starts; active ignores dates; request never substitutes createdAt', () => {
    const result = buildPlanFact(
      data({
        active: [
          run({
            id: 'active',
            status: 'IN_PROGRESS',
            completedAt: null,
            createdAt: '2025-01-01T00:00:00Z',
          }),
        ],
      }),
      FILTER,
    )
    expect(result.completed).toHaveLength(1)
    expect(result.active).toHaveLength(1)
    expect(
      buildPlanFact(data(), { ...FILTER, from: '2026-10-22' }).completed,
    ).toHaveLength(0)
    const requests = planFactQueries(FILTER, NOW)
    expect(requests.completed).toMatchObject({
      status: 'COMPLETED',
      limit: 200,
    })
    expect(requests.completed.completedFrom).toBe(
      new Date('2026-10-01T00:00:00').toISOString(),
    )
    expect(requests.completed).not.toHaveProperty('from')
    expect(requests.active).not.toHaveProperty('from')
    expect(requests.active).not.toHaveProperty('completedFrom')
    expect(requests.overdueSchedules).toEqual({
      active: true,
      locationId: undefined,
      assignedToUserId: undefined,
      to: new Date(NOW).toISOString(),
    })
    expect(() =>
      planFactQueries({ ...FILTER, from: '2026-11-01' }, NOW),
    ).toThrow()
  })
  it('narrows source records and options to selected owner, failing closed on missing scope', () => {
    const scoped = scopePlanFact(
      data({
        active: [
          run({
            location: {
              id: 'hidden',
              name: 'Скрытый объект',
              clientCompanyId: 'foreign',
            },
          }),
        ],
      }),
      'client-1',
    )
    expect(scoped.active).toEqual([])
    expect(planFactOptions(scoped).locations).toEqual([['loc-1', 'Объект 1']])
    expect(scopePlanFact(data(), 'foreign')).toEqual({
      schedules: [],
      overdueSchedules: [],
      completed: [],
      active: [],
    })
  })
  it('honestly flags capped samples and handles empty results', () => {
    expect(
      buildPlanFact(
        data({
          completed: Array.from({ length: 200 }, (_, n) =>
            run({ id: String(n) }),
          ),
        }),
        FILTER,
      ).possiblyTruncated,
    ).toBe(true)
    expect(
      buildPlanFact(
        { schedules: [], overdueSchedules: [], completed: [], active: [] },
        FILTER,
      ),
    ).toMatchObject({
      plans: [],
      completed: [],
      active: [],
      overdueCount: 0,
      lateCount: 0,
    })
  })
})

describe('calendar validity and exact asset occurrence', () => {
  it.each([
    '2026-02-31',
    '2026-02-29',
    '2026-13-01',
    '2026-2-01',
    '2026-10-01T00:00:00Z',
  ])('rejects invalid/normalized local date %s', (value) => {
    expect(planFactPeriod(value, '').invalid).toBe(true)
    expect(planFactPeriod('', value).invalid).toBe(true)
    expect(() => planFactQueries({ ...FILTER, from: value }, NOW)).toThrow()
  })
  it('accepts leap day and keeps local day boundaries across DST changes', () => {
    const prior = process.env.TZ
    try {
      process.env.TZ = 'Europe/Berlin'
      const spring = planFactPeriod('2026-03-29', '2026-03-29')
      expect(spring.invalid).toBe(false)
      expect(spring.end! - spring.start! + 1).toBe(23 * 60 * 60 * 1000)
      const fall = planFactPeriod('2026-10-25', '2026-10-25')
      expect(fall.end! - fall.start! + 1).toBe(25 * 60 * 60 * 1000)
      expect(planFactPeriod('2028-02-29', '2028-02-29').invalid).toBe(false)
    } finally {
      if (prior === undefined) delete process.env.TZ
      else process.env.TZ = prior
    }
  })
  it('does not close a newly selected asset with an old same-site, same-date run', () => {
    const scheduled = plan({
      nextDueAt: run().dueAt!,
      overdueAt: run().overdueAt!,
      equipment: { id: 'eq-new', name: 'Новое' },
    })
    const actual = run({ equipment: { id: 'eq-old', name: 'Старое' } })
    const result = buildPlanFact(
      data({ schedules: [scheduled], completed: [actual] }),
      FILTER,
    )
    expect(result.plans[0].run).toBeUndefined()
    expect(result.plans[0]).toMatchObject({
      overdue: false,
      label: 'План · факт не подтверждён',
    })
  })
  it('matches work by a different actual performer without rewriting either person', () => {
    const scheduled = plan({ nextDueAt: run().dueAt! })
    const result = buildPlanFact(data({ schedules: [scheduled] }), {
      ...FILTER,
      employeeId: 'worker-new',
    })
    expect(result.completed).toHaveLength(0)
    expect(result.plans[0].run?.performedBy?.id).toBe('worker-old')
    expect(result.plans[0].plan.assignedTo?.id).toBe('worker-new')
  })
})

describe('overdue comes from the server flag, not from the loaded sample', () => {
  it('marks an unstarted plan overdue even when the employee filter hides other performers', () => {
    const source = data({
      schedules: [
        plan({
          nextDueAt: run().dueAt!,
          overdueAt: run().overdueAt!,
          isOverdue: true,
        }),
      ],
      completed: [],
      active: [],
    })
    const result = buildPlanFact(source, {
      ...FILTER,
      employeeId: 'worker-new',
    })
    expect(result.plans[0]).toMatchObject({
      overdue: true,
      label: 'Просрочен',
    })
    expect(result.overdueCount).toBe(1)
    expect(result.overdueStartedCount).toBe(0)
  })
  it('labels an exactly matched unfinished run as started and overdue, independent of performer', () => {
    const scheduled = plan({
      nextDueAt: run().dueAt!,
      overdueAt: run().overdueAt!,
      isOverdue: true,
    })
    const result = buildPlanFact(
      data({
        schedules: [scheduled],
        completed: [],
        active: [run({ status: 'IN_PROGRESS', completedAt: null })],
      }),
      { ...FILTER, employeeId: 'worker-new' },
    )
    expect(result.plans[0]).toMatchObject({
      overdue: true,
      label: 'В процессе · просрочен',
    })
    expect(result.overdueCount).toBe(1)
    expect(result.overdueStartedCount).toBe(1)
  })
  it('does not guess overdue from the client clock when the server says the grace period is running', () => {
    const result = buildPlanFact(
      data({
        schedules: [
          plan({
            nextDueAt: run().dueAt!,
            overdueAt: run().overdueAt!,
            isOverdue: false,
          }),
        ],
        completed: [],
      }),
      FILTER,
    )
    expect(result.plans[0]).toMatchObject({
      overdue: false,
      label: 'План · факт не подтверждён',
    })
    expect(result.overdueCount).toBe(0)
  })
})

describe('overdue plans from earlier months', () => {
  const september = plan({
    id: 'plan-sept',
    name: 'Сентябрьский визит',
    nextDueAt: '2026-09-15T09:00:00Z',
    overdueAt: '2026-09-16T09:00:00Z',
    graceDays: 1,
    isOverdue: true,
    lastRun: null,
  })
  it('shows an unstarted September plan in the October period and counts it', () => {
    const result = buildPlanFact(
      data({ overdueSchedules: [september] }),
      FILTER,
    )
    expect(result.plans.map((row) => row.plan.id)).toEqual([
      'plan-sept',
      'plan-1',
    ])
    expect(result.plans[0]).toMatchObject({
      overdue: true,
      label: 'Просрочен',
      run: undefined,
    })
    expect(result.overdueCount).toBe(1)
  })
  it('still shows it after the period moves to a later month', () => {
    const result = buildPlanFact(data({ overdueSchedules: [september] }), {
      ...FILTER,
      from: '2026-12-01',
      to: '2026-12-31',
    })
    expect(result.plans.map((row) => row.plan.id)).toEqual(['plan-sept'])
    expect(result.overdueCount).toBe(1)
  })
  it('shows a plan returned by both requests once and its started run once', () => {
    const started = run({
      id: 'run-sept',
      scheduleId: 'plan-sept',
      status: 'IN_PROGRESS',
      dueAt: '2026-09-15T09:00:00Z',
      overdueAt: '2026-09-16T09:00:00Z',
      completedAt: null,
    })
    const result = buildPlanFact(
      data({
        schedules: [september, plan()],
        overdueSchedules: [september],
        completed: [],
        active: [started, started],
      }),
      FILTER,
    )
    expect(result.plans.map((row) => row.plan.id)).toEqual([
      'plan-sept',
      'plan-1',
    ])
    expect(result.plans[0]).toMatchObject({
      label: 'В процессе · просрочен',
      run: { id: 'run-sept' },
    })
    expect(result.active.map((row) => row.id)).toEqual(['run-sept'])
    expect(result.overdueStartedCount).toBe(1)
  })
  it('keeps the September completed run out of the October fact and the closed plan out of overdue', () => {
    const closed = run({
      id: 'run-sept-done',
      scheduleId: 'plan-sept',
      dueAt: '2026-09-15T09:00:00Z',
      completedAt: '2026-09-20T09:00:00Z',
    })
    // После завершения сервер сдвинул срок, план больше не просрочен.
    const advanced = {
      ...september,
      nextDueAt: '2026-11-15T09:00:00Z',
      isOverdue: false,
    }
    const result = buildPlanFact(
      data({
        schedules: [],
        overdueSchedules: [advanced],
        completed: [closed],
      }),
      FILTER,
    )
    expect(result.plans).toEqual([])
    expect(result.completed).toEqual([])
    expect(result.overdueCount).toBe(0)
  })
  it('respects the location, current assignee and active filters for overdue plans', () => {
    const source = data({
      schedules: [],
      overdueSchedules: [
        september,
        { ...september, id: 'plan-off', isActive: false },
      ],
    })
    expect(
      buildPlanFact(source, { ...FILTER, locationId: 'other' }).plans,
    ).toEqual([])
    expect(
      buildPlanFact(source, { ...FILTER, employeeId: 'worker-old' }).plans,
    ).toEqual([])
    expect(
      buildPlanFact(source, { ...FILTER, employeeId: 'worker-new' }).plans.map(
        (row) => row.plan.id,
      ),
    ).toEqual(['plan-sept'])
  })
  it('drops overdue plans of another owner and offers their location only in scope', () => {
    const foreign = {
      ...september,
      id: 'plan-foreign',
      location: { id: 'loc-f', name: 'Чужой', clientCompanyId: 'foreign' },
    }
    const scoped = scopePlanFact(
      data({ overdueSchedules: [september, foreign] }),
      'client-1',
    )
    expect(scoped.overdueSchedules.map((row) => row.id)).toEqual(['plan-sept'])
    expect(planFactOptions(scoped).locations).toEqual([['loc-1', 'Объект 1']])
  })
  it('requests overdue plans without the period window, under the same filters', () => {
    const requests = planFactQueries(
      { ...FILTER, locationId: 'loc-1', employeeId: 'worker-new' },
      NOW,
    )
    expect(requests.overdueSchedules).toEqual({
      active: true,
      locationId: 'loc-1',
      assignedToUserId: 'worker-new',
      to: new Date(NOW).toISOString(),
    })
    expect(requests.overdueSchedules).not.toHaveProperty('from')
  })
  it('flags a capped overdue sample', () => {
    expect(
      buildPlanFact(
        data({
          overdueSchedules: Array.from({ length: 200 }, (_, n) =>
            plan({ ...september, id: `o-${n}` }),
          ),
        }),
        FILTER,
      ).possiblyTruncated,
    ).toBe(true)
  })
})

it('keeps a future plan neutral when employee-filtered facts may omit another performer', () => {
  const result = buildPlanFact(data({ completed: [], active: [] }), {
    ...FILTER,
    employeeId: 'worker-new',
  })
  expect(result.plans[0]).toMatchObject({
    label: 'План · факт не подтверждён',
    overdue: false,
  })
  expect(result.plans[0].run).toBeUndefined()
})
