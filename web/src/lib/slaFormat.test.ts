/**
 * SMA-ANALYTICS-V2-PHASE2 (A3) — проверки отображения SLA исполнением.
 *
 * Окружение node, DOM нет: модуль чистый, и каждое правило проверяется на
 * поведении функции, а не на присутствии строки в исходнике.
 */
import { describe, expect, it } from 'vitest'

import {
  NO_DATA,
  describeOpenOverdue,
  describeSlaBasis,
  formatMinutes,
  formatOpenOverdue,
  formatSlaRatio,
  pickSlaForScope,
  type SlaMetricsView,
} from './slaFormat'

function metrics(overrides: Partial<SlaMetricsView> = {}): SlaMetricsView {
  return {
    avgResponseMinutes: null,
    avgResolutionMinutes: null,
    withinSlaRatio: null,
    withinSlaCount: 0,
    slaEvaluatedCount: 0,
    slaBreaches: 0,
    respondedCount: 0,
    resolvedCount: 0,
    withoutSlaCount: 0,
    ...overrides,
  }
}

describe('formatMinutes', () => {
  it('отсутствие данных и ноль выглядят РАЗНО', () => {
    expect(formatMinutes(null)).toBe(NO_DATA)
    expect(formatMinutes(undefined)).toBe(NO_DATA)
    expect(formatMinutes(0)).toBe('0 мин')
    expect(formatMinutes(0)).not.toBe(formatMinutes(null))
  })

  it('минуты, часы и сутки', () => {
    expect(formatMinutes(45)).toBe('45 мин')
    expect(formatMinutes(60)).toBe('1 ч')
    expect(formatMinutes(135)).toBe('2 ч 15 мин')
    expect(formatMinutes(1440)).toBe('1 д')
    expect(formatMinutes(1500)).toBe('1 д 1 ч')
  })

  it('округляет до минуты', () => {
    expect(formatMinutes(44.6)).toBe('45 мин')
  })
})

describe('formatSlaRatio', () => {
  it('нет данных — прочерк, а не 0%', () => {
    expect(formatSlaRatio(null)).toBe(NO_DATA)
    expect(formatSlaRatio(null)).not.toBe('0%')
  })

  it('доля в проценты', () => {
    expect(formatSlaRatio(0)).toBe('0%')
    expect(formatSlaRatio(0.5)).toBe('50%')
    expect(formatSlaRatio(1)).toBe('100%')
  })
})

describe('describeSlaBasis', () => {
  it('объясняет знаменатель', () => {
    expect(describeSlaBasis(metrics({ withinSlaCount: 3, slaEvaluatedCount: 4 }))).toContain(
      '3 из 4',
    )
  })

  it('называет завершённые без срока отдельно, а не как выполненные', () => {
    const text = describeSlaBasis(metrics({ withinSlaCount: 1, slaEvaluatedCount: 2, withoutSlaCount: 5 }))
    expect(text).toContain('1 из 2')
    expect(text).toContain('5')
    expect(text).toContain('без срока')
  })

  it('когда оценивать нечего, так и говорит', () => {
    expect(describeSlaBasis(metrics())).toContain('нет завершённых заявок со сроком')
    expect(describeSlaBasis(metrics({ withoutSlaCount: 2 }))).toContain('без срока')
  })
})

describe('текущая просрочка отделена от исторических нарушений', () => {
  it('показывает число открытых просроченных со знаменателем', () => {
    const m = metrics({ openCount: 7, openOverdueCount: 3, slaBreaches: 99 })
    expect(formatOpenOverdue(m)).toBe('3')
    expect(describeOpenOverdue(m)).toBe('из 7 открытых')
  })

  it('не подменяет текущую просрочку историческими нарушениями', () => {
    // Исторических 99, но сейчас просрочено 0 — и это должно быть видно.
    const m = metrics({ openCount: 4, openOverdueCount: 0, slaBreaches: 99 })
    expect(formatOpenOverdue(m)).toBe('0')
    expect(formatOpenOverdue(m)).not.toBe(String(m.slaBreaches))
  })

  it('нет открытых заявок — так и говорит', () => {
    expect(describeOpenOverdue(metrics({ openCount: 0, openOverdueCount: 0 }))).toBe(
      'открытых заявок нет',
    )
  })

  it('старый бэкенд без этих полей даёт прочерк, а не ноль', () => {
    const m = metrics()
    expect(formatOpenOverdue(m)).toBe(NO_DATA)
    expect(formatOpenOverdue(m)).not.toBe('0')
    expect(describeOpenOverdue(m)).toContain('нет данных')
  })
})

describe('pickSlaForScope', () => {
  const org = metrics({ avgResolutionMinutes: 100 })
  const city = metrics({ avgResolutionMinutes: 20 })

  it('без выбранного города показывает организацию', () => {
    expect(pickSlaForScope(org, city, false)).toBe(org)
  })

  it('с выбранным городом показывает город', () => {
    expect(pickSlaForScope(org, city, true)).toBe(city)
  })

  it('не подменяет город организацией, если городских данных нет', () => {
    // Иначе под ярлыком города показывались бы цифры всей организации.
    expect(pickSlaForScope(org, undefined, true)).toBeNull()
  })

  it('старый бэкенд без SLA не ломает экран', () => {
    expect(pickSlaForScope(undefined, undefined, false)).toBeNull()
  })
})
