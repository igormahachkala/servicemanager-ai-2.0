import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  OPEN_TICKET_STATUSES,
  TODAY_COUNT_LABELS,
  countsForLocation,
  deriveVisitState,
  groupOpenTicketCounts,
  locationAddressLine,
  plannedTimeLabel,
  resolveStartFailure,
  sortVisitsByPlannedTime,
  toTodayVisitCards,
  todayWindow,
} from './mobileInspectionToday'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

function card(overrides: any = {}) {
  return {
    id: overrides.id || 'tk-1',
    status: 'NEW',
    urgency: 'NOT_URGENT',
    location: { id: 'loc-1', name: 'Объект' },
    ...overrides,
  } as any
}

function schedule(overrides: any = {}) {
  return {
    id: 'sch-1',
    name: 'ТО',
    nextDueAt: '2026-09-17T09:00:00.000Z',
    template: { id: 'tpl-1', name: 'Ежемесячное ТО' },
    location: { id: 'loc-1', name: 'Фудзияма — Уфа', address: 'ул. Ленина, 1' },
    ...overrides,
  } as any
}

// ── окно суток ──────────────────────────────────────────────────────────────

describe('120G окно суток', () => {
  it('охватывает локальные сутки целиком', () => {
    const now = new Date(2026, 8, 17, 13, 45, 12)
    const { from, to } = todayWindow(now)
    const start = new Date(from)
    const end = new Date(to)

    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(8)
    expect(start.getDate()).toBe(17)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)

    expect(end.getDate()).toBe(17)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
  })

  it('визит без минуты до полуночи ещё сегодняшний, ровно в полночь — уже нет', () => {
    const now = new Date(2026, 8, 17, 8, 0, 0)
    const { from, to } = todayWindow(now)
    const lastMinute = new Date(2026, 8, 17, 23, 59, 0).getTime()
    const midnight = new Date(2026, 8, 18, 0, 0, 0).getTime()

    expect(lastMinute).toBeGreaterThanOrEqual(new Date(from).getTime())
    expect(lastMinute).toBeLessThanOrEqual(new Date(to).getTime())
    expect(midnight).toBeGreaterThan(new Date(to).getTime())
  })
})

// ── порядок ─────────────────────────────────────────────────────────────────

describe('120G порядок визитов', () => {
  it('идёт по запланированному времени', () => {
    const sorted = sortVisitsByPlannedTime([
      schedule({ id: 'b', nextDueAt: '2026-09-17T15:00:00.000Z' }),
      schedule({ id: 'a', nextDueAt: '2026-09-17T09:00:00.000Z' }),
      schedule({ id: 'c', nextDueAt: '2026-09-17T12:00:00.000Z' }),
    ])
    expect(sorted.map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })

  it('визит без срока уходит в конец, а не ломает порядок', () => {
    const sorted = sortVisitsByPlannedTime([
      schedule({ id: 'none', nextDueAt: null }),
      schedule({ id: 'a', nextDueAt: '2026-09-17T09:00:00.000Z' }),
    ])
    expect(sorted.map((s) => s.id)).toEqual(['a', 'none'])
  })

  it('равные сроки разводятся по названию — порядок устойчив между обновлениями', () => {
    const at = '2026-09-17T09:00:00.000Z'
    const sorted = sortVisitsByPlannedTime([
      schedule({ id: 'b', name: 'Бета', nextDueAt: at }),
      schedule({ id: 'a', name: 'Альфа', nextDueAt: at }),
    ])
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('исходный массив не переставляется', () => {
    const input = [
      schedule({ id: 'b', nextDueAt: '2026-09-17T15:00:00.000Z' }),
      schedule({ id: 'a', nextDueAt: '2026-09-17T09:00:00.000Z' }),
    ]
    sortVisitsByPlannedTime(input)
    expect(input.map((s) => s.id)).toEqual(['b', 'a'])
  })
})

// ── счётчики ────────────────────────────────────────────────────────────────

describe('120G счётчики заявок', () => {
  it('группирует по объекту и делит срочные и остальные', () => {
    const counts = groupOpenTicketCounts([
      card({ id: '1', location: { id: 'loc-1' }, urgency: 'URGENT' }),
      card({ id: '2', location: { id: 'loc-1' }, urgency: 'NOT_URGENT' }),
      card({ id: '3', location: { id: 'loc-1' }, urgency: 'NOT_URGENT' }),
      card({ id: '4', location: { id: 'loc-2' }, urgency: 'URGENT' }),
    ])
    expect(counts.get('loc-1')).toEqual({ urgent: 1, nonUrgent: 2 })
    expect(counts.get('loc-2')).toEqual({ urgent: 1, nonUrgent: 0 })
  })

  it('завершённые и отменённые заявки работой не считаются', () => {
    const counts = groupOpenTicketCounts([
      card({ id: '1', status: 'DONE' }),
      card({ id: '2', status: 'CANCELED' }),
      card({ id: '3', status: 'AWAITING_ACCEPTANCE' }),
    ])
    expect(counts.get('loc-1')).toEqual({ urgent: 0, nonUrgent: 1 })
    expect(OPEN_TICKET_STATUSES).not.toContain('DONE')
    expect(OPEN_TICKET_STATUSES).not.toContain('CANCELED')
  })

  it('заявка без объекта счётчик не трогает', () => {
    const counts = groupOpenTicketCounts([
      card({ id: '1', location: null }),
      card({ id: '2', location: undefined }),
    ])
    expect(counts.size).toBe(0)
  })

  it('одна заявка из двух колонок board считается один раз', () => {
    const counts = groupOpenTicketCounts([
      card({ id: 'same' }),
      card({ id: 'same' }),
    ])
    expect(counts.get('loc-1')).toEqual({ urgent: 0, nonUrgent: 1 })
  })

  it('объект без заявок и отсутствующая карта дают нули, а не падение', () => {
    const counts = groupOpenTicketCounts([card()])
    expect(countsForLocation(counts, 'loc-unknown')).toEqual({ urgent: 0, nonUrgent: 0 })
    expect(countsForLocation(counts, null)).toEqual({ urgent: 0, nonUrgent: 0 })
    expect(countsForLocation(null, 'loc-1')).toEqual({ urgent: 0, nonUrgent: 0 })
    expect(groupOpenTicketCounts(null).size).toBe(0)
  })

  it('подпись счётчика не обещает итог по компании', () => {
    // Board техника сужен бэкендом: «на объекте» прочиталось бы как всё, что там есть.
    expect(TODAY_COUNT_LABELS.nonUrgent).toBe('Мои заявки здесь')
    expect(TODAY_COUNT_LABELS.scopeNote).toMatch(/доступные вам/)
  })
})

// ── адрес ───────────────────────────────────────────────────────────────────

describe('120G адрес объекта', () => {
  it('показывает адрес, когда он есть', () => {
    expect(locationAddressLine({ id: 'l', name: 'N', address: 'ул. Ленина, 1' } as any)).toBe('ул. Ленина, 1')
  })

  it('без адреса опускается до города, затем до кода площадки', () => {
    expect(locationAddressLine({ id: 'l', name: 'N', address: null, city: 'Уфа' } as any)).toBe('Уфа')
    expect(locationAddressLine({ id: 'l', name: 'N', city: null, platformCode: 'UFA-01' } as any)).toBe('UFA-01')
  })

  it('пустые строки не считаются заполненными', () => {
    expect(locationAddressLine({ id: 'l', name: 'N', address: '   ', city: 'Уфа' } as any)).toBe('Уфа')
    expect(locationAddressLine({ id: 'l', name: 'N' } as any)).toBe('')
    expect(locationAddressLine(null)).toBe('')
  })
})

describe('120G время визита', () => {
  it('без срока и при мусорной дате не показывает Invalid Date', () => {
    expect(plannedTimeLabel(null)).toBe('')
    expect(plannedTimeLabel('не дата')).toBe('')
  })

  it('форматирует часы и минуты с ведущим нулём', () => {
    expect(plannedTimeLabel(new Date(2026, 8, 17, 9, 5).toISOString())).toBe('09:05')
  })
})

// ── состояние визита ────────────────────────────────────────────────────────

describe('120G состояние визита', () => {
  it('план без обходов ещё не начат', () => {
    expect(deriveVisitState({ lastRun: null } as any)).toBe('NOT_STARTED')
    expect(deriveVisitState({} as any)).toBe('NOT_STARTED')
  })

  it('незакрытый обход — визит в работе', () => {
    expect(deriveVisitState({ lastRun: { id: 'r', status: 'IN_PROGRESS' } } as any)).toBe('IN_PROGRESS')
  })

  it('завершённый обход — визит выполнен', () => {
    expect(deriveVisitState({ lastRun: { id: 'r', status: 'COMPLETED' } } as any)).toBe('COMPLETED')
  })

  it('карточка несёт подпись действия и номер обхода для продолжения', () => {
    const [inProgress] = toTodayVisitCards(
      [schedule({ lastRun: { id: 'run-7', status: 'IN_PROGRESS' } })],
      groupOpenTicketCounts([card({ id: '1', urgency: 'URGENT' })]),
    )
    expect(inProgress.state).toBe('IN_PROGRESS')
    expect(inProgress.actionLabel).toBe('Продолжить')
    expect(inProgress.runId).toBe('run-7')
    expect(inProgress.counts).toEqual({ urgent: 1, nonUrgent: 0 })

    const [completed] = toTodayVisitCards([schedule({ lastRun: { id: 'r', status: 'COMPLETED' } })], null)
    expect(completed.actionLabel).toBe('Обход выполнен')

    const [fresh] = toTodayVisitCards([schedule()], null)
    expect(fresh.actionLabel).toBe('Начать обход')
    expect(fresh.runId).toBeNull()
    expect(fresh.addressLine).toBe('ул. Ленина, 1')
    expect(fresh.templateName).toBe('Ежемесячное ТО')
  })
})

// ── отказы запуска ──────────────────────────────────────────────────────────

describe('120G разбор отказа запуска', () => {
  it('уже начатый визит ведёт к своему обходу', () => {
    const failure = resolveStartFailure({
      status: 409,
      message: 'Обход по этому плану уже начат.',
      payload: { code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS', runId: 'run-open' },
    })
    expect(failure).toEqual({ kind: 'open', runId: 'run-open' })
  })

  it('идемпотентный повтор — временное состояние, а не второй обход', () => {
    const failure = resolveStartFailure({
      status: 409,
      message: 'Операция уже выполняется. Повторите позже.',
      payload: { code: 'IDEMPOTENCY_IN_PROGRESS' },
    })
    expect(failure).toEqual({ kind: 'retry' })
  })

  it('код занятости без номера обхода не выдумывает навигацию', () => {
    const failure = resolveStartFailure({
      status: 409,
      message: 'Обход по этому плану уже начат.',
      payload: { code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS' },
    })
    expect(failure).toEqual({ kind: 'retry' })
  })

  it('закрытая смена отдаётся существующему запросу на её открытие', () => {
    expect(resolveStartFailure({ status: 409, message: 'ACTIVE_SHIFT_REQUIRED' })).toEqual({ kind: 'shift' })
    expect(
      resolveStartFailure({ status: 409, message: 'Откройте рабочую смену, чтобы выполнить это действие.' }),
    ).toEqual({ kind: 'shift' })
  })

  it('занятость визита не путается с закрытой сменой', () => {
    const failure = resolveStartFailure({
      status: 409,
      message: 'Обход по этому плану уже начат.',
      payload: { code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS', runId: 'run-1' },
    })
    expect(failure.kind).toBe('open')
  })

  it('прочий отказ остаётся ошибкой с текстом сервера', () => {
    expect(resolveStartFailure({ status: 500, message: 'Внутренняя ошибка' })).toEqual({
      kind: 'error',
      message: 'Внутренняя ошибка',
    })
    expect(resolveStartFailure(null)).toEqual({ kind: 'error', message: 'Не удалось начать обход' })
  })
})

// ── контракт исходников ─────────────────────────────────────────────────────

describe('120G source contract', () => {
  const page = () => read('src/mobile/MobileInspectionTodayPage.tsx')
  const router = () => read('src/router.tsx')
  const scheduleService = () => read('../backend/src/inspection/inspection-schedule.service.ts')

  it('маршрут заведён в обоих мобильных корнях', () => {
    expect((router().match(/path="inspection\/today"/g) || []).length).toBe(2)
    expect(router()).toMatch(/import\('\.\/mobile\/MobileInspectionTodayPage'\)/)
  })

  it('план запрашивается окном суток и без клиентского сужения по технику', () => {
    expect(page()).toMatch(/api\.getInspectionSchedules\(\{ from: window\.from, to: window\.to/)
    // Сужение делает сервер. Фильтр по технику в запросе был бы не ограничением,
    // а его имитацией: сервер всё равно перезапишет, а читатель поверит клиенту.
    const call = page().match(/api\.getInspectionSchedules\(\{[^}]*\}\)/)?.[0] || ''
    expect(call).not.toBe('')
    expect(call).not.toMatch(/assignedToUserId/)
  })

  it('счётчики берутся из board одним запросом, а не по запросу на объект', () => {
    expect(page()).toMatch(/api\.board\(\{ take: 500 \}\)/)
    expect((page().match(/api\.board\(/g) || []).length).toBe(1)
  })

  it('запуск несёт scheduleId и ведёт на существующий экран обхода', () => {
    expect(page()).toMatch(/api\.startInspectionRun/)
    expect(page()).toMatch(/scheduleId: card\.scheduleId/)
    expect(page()).toMatch(/mobilePath\(location\.pathname, `\/inspection\/\$\{run\.id\}`\)/)
  })

  it('ссылки строятся через mobilePath, без зашитого корня', () => {
    expect(page()).toMatch(/mobilePath/)
    expect(page()).not.toMatch(/['"`]\/m\//)
  })

  it('второй мастер запуска не заводится', () => {
    expect(page()).not.toMatch(/getTechnicianBoundContexts|getLinkedClients/)
  })

  it('сервер по-прежнему сужает список техника и сортирует по ближайшему сроку', () => {
    expect(scheduleService()).toMatch(/where\.assignedToUserId = user\.id/)
    expect(scheduleService()).toMatch(/orderBy: \[\{ nextDueAt: 'asc' \}/)
    expect(scheduleService()).toMatch(/address: true/)
  })
})
