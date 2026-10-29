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
    const result = buildPlanFact(data(), FILTER, NOW)
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
      NOW,
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
      buildPlanFact(data({ active: [pending] }), FILTER, NOW).plans[0].label,
    ).toBe('В процессе')
    pending.location = {
      id: 'other',
      name: 'Другой',
      clientCompanyId: 'client-1',
    }
    expect(
      buildPlanFact(data({ active: [pending] }), FILTER, NOW).plans[0].run,
    ).toBeUndefined()
    pending.location = {
      id: 'loc-1',
      name: 'Другой контур',
      clientCompanyId: 'client-2',
    }
    expect(
      buildPlanFact(data({ active: [pending] }), FILTER, NOW).plans[0].run,
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
            }),
          ],
          completed: [],
        }),
        FILTER,
        NOW,
      ).unconfirmedCount,
    ).toBe(1)
  })
  it('does not reassign historical performer when current worker changes', () => {
    const old = buildPlanFact(
      data(),
      { ...FILTER, employeeId: 'worker-old' },
      NOW,
    )
    expect(old.completed).toHaveLength(1)
    expect(old.plans).toHaveLength(0)
    const next = buildPlanFact(
      data(),
      { ...FILTER, employeeId: 'worker-new' },
      NOW,
    )
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
      NOW,
    )
    expect(result.completed).toHaveLength(1)
    expect(result.active).toHaveLength(1)
    expect(
      buildPlanFact(data(), { ...FILTER, from: '2026-10-22' }, NOW).completed,
    ).toHaveLength(0)
    const requests = planFactQueries(FILTER)
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
    expect(() => planFactQueries({ ...FILTER, from: '2026-11-01' })).toThrow()
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
        NOW,
      ).possiblyTruncated,
    ).toBe(true)
    expect(
      buildPlanFact({ schedules: [], completed: [], active: [] }, FILTER, NOW),
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
    expect(() => planFactQueries({ ...FILTER, from: value })).toThrow()
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
      NOW,
    )
    expect(result.plans[0].run).toBeUndefined()
    expect(result.plans[0].overdue).toBe(false)
    expect(result.plans[0].unconfirmed).toBe(true)
  })
  it('matches work by a different actual performer without rewriting either person', () => {
    const scheduled = plan({ nextDueAt: run().dueAt! })
    const result = buildPlanFact(
      data({ schedules: [scheduled] }),
      { ...FILTER, employeeId: 'worker-new' },
      NOW,
    )
    expect(result.completed).toHaveLength(0)
    expect(result.plans[0].run?.performedBy?.id).toBe('worker-old')
    expect(result.plans[0].plan.assignedTo?.id).toBe('worker-new')
  })
})

describe('limited employee facts cannot prove missing work', () => {
  it('does not label a plan for A overdue when the filtered API may have omitted work by B', () => {
    const source = data({
      schedules: [
        plan({ nextDueAt: run().dueAt!, overdueAt: run().overdueAt! }),
      ],
      completed: [],
      active: [],
    })
    const result = buildPlanFact(
      source,
      { ...FILTER, employeeId: 'worker-new' },
      NOW,
    )
    expect(result.plans[0]).toMatchObject({
      overdue: false,
      unconfirmed: true,
      label: 'Срок прошёл · факт не подтверждён',
    })
    expect(result.overdueCount).toBe(0)
    expect(result.unconfirmedCount).toBe(1)
  })
  it('reports confirmed overdue only for an exactly matched unfinished run, independent of performer', () => {
    const scheduled = plan({
      nextDueAt: run().dueAt!,
      overdueAt: run().overdueAt!,
    })
    const result = buildPlanFact(
      data({
        schedules: [scheduled],
        completed: [],
        active: [run({ status: 'IN_PROGRESS', completedAt: null })],
      }),
      { ...FILTER, employeeId: 'worker-new' },
      NOW,
    )
    expect(result.plans[0]).toMatchObject({ overdue: true, unconfirmed: false })
    expect(result.overdueCount).toBe(1)
    expect(result.unconfirmedCount).toBe(0)
  })
})

it('keeps a future plan neutral when employee-filtered facts may omit another performer', () => {
  const result = buildPlanFact(
    data({ completed: [], active: [] }),
    { ...FILTER, employeeId: 'worker-new' },
    NOW,
  )
  expect(result.plans[0]).toMatchObject({
    label: 'План · факт не подтверждён',
    overdue: false,
    unconfirmed: false,
  })
  expect(result.plans[0].run).toBeUndefined()
})
