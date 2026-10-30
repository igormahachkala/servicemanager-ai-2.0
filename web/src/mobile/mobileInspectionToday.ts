import type { InspectionSchedule, TicketCard, TicketStatus } from '../lib/api'
import { isActiveShiftRequiredError } from './mobileShiftGate'

/**
 * SMA-PLANNER-V1-MOBILE-TODAY-120G — решения экрана «Сегодня» без React.
 *
 * Всё, что можно решить без DOM, решается здесь: окно суток, порядок визитов,
 * счётчики заявок, состояние визита и разбор отказов запуска. Так это
 * проверяется обычным Vitest в среде node — jsdom в проекте нет намеренно.
 */

// ── окно суток ──────────────────────────────────────────────────────────────

export type TodayWindow = { from: string; to: string }

/**
 * Границы локальных суток. Обе включающие: бэкенд сравнивает nextDueAt через
 * gte/lte, поэтому визит в 23:59:59.999 обязан попасть в сегодняшний план,
 * а полночь следующего дня — нет.
 */
export function todayWindow(now: Date = new Date()): TodayWindow {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Верхняя включающая граница прошлых суток для существующего list API. */
export function previousVisitsUntil(window: TodayWindow): string {
  return new Date(Date.parse(window.from) - 1).toISOString()
}

/** API ограничивает выборку до проверки доступа к площадкам, а не после неё. */
export const TODAY_SCHEDULE_LIMIT = 200
export const TODAY_SCHEDULE_LIMIT_NOTE =
  'Для каждого периода сервер проверяет не более 200 планов. Список может быть неполным, даже если показано меньше.'

/**
 * Два независимых периода не позволяют старому backlog вытеснить сегодняшние
 * визиты из серверного лимита. Это группировка ответа, не проверка доступа.
 * При гонке обновлений сегодняшний ответ приоритетен: старый снимок того же
 * плана не должен снова показывать уже перенесённый или закрытый визит.
 */
export function groupTodaySchedules(
  current: InspectionSchedule[] | null | undefined,
  previous: InspectionSchedule[] | null | undefined,
  window: TodayWindow,
): { today: InspectionSchedule[]; previous: InspectionSchedule[] } {
  const result: { today: InspectionSchedule[]; previous: InspectionSchedule[] } = { today: [], previous: [] }
  const seen = new Set<string>()
  const from = Date.parse(window.from)
  const to = Date.parse(window.to)
  for (const schedule of [...(current || []), ...(previous || [])]) {
    if (seen.has(schedule.id)) continue
    seen.add(schedule.id)
    if (!schedule.isActive) continue
    const due = Date.parse(schedule.nextDueAt)
    if (!Number.isFinite(due) || due > to) continue
    if (due >= from) result.today.push(schedule)
    else if (deriveVisitState(schedule) !== 'COMPLETED') result.previous.push(schedule)
  }
  return result
}

// ── счётчики заявок ─────────────────────────────────────────────────────────

/**
 * Открытая заявка — та, которую ещё предстоит закрыть. DONE и CANCELED работой
 * не являются и в счётчик не попадают.
 */
export const OPEN_TICKET_STATUSES: TicketStatus[] = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAITING_ACCEPTANCE',
]

export function isOpenTicketStatus(status: TicketStatus | null | undefined): boolean {
  return !!status && (OPEN_TICKET_STATUSES as string[]).includes(status)
}

export type LocationTicketCounts = { urgent: number; nonUrgent: number }

export const EMPTY_TICKET_COUNTS: LocationTicketCounts = { urgent: 0, nonUrgent: 0 }

/**
 * Подписи счётчиков.
 *
 * Board техника сужен бэкендом до его собственного охвата, поэтому счётчик —
 * это заявки, видимые этому технику, а не все заявки объекта. Подпись обязана
 * говорить именно это: «на объекте» прочиталось бы как итог по компании.
 */
export const TODAY_COUNT_LABELS = {
  nonUrgent: 'Мои заявки здесь',
  urgent: 'Срочные',
  scopeNote: 'Считаются заявки, доступные вам',
} as const

/**
 * Счётчики по объектам за один проход по уже загруженному board.
 * Отдельного запроса на локацию не делается: N запросов на N визитов — это то,
 * чего экран должен избежать.
 */
export function groupOpenTicketCounts(cards: TicketCard[] | null | undefined): Map<string, LocationTicketCounts> {
  const byLocation = new Map<string, LocationTicketCounts>()
  const seen = new Set<string>()

  for (const card of cards || []) {
    if (!card) continue
    // Один и тот же билет может прийти из двух колонок board.
    if (card.id) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
    }
    const locationId = card.location?.id
    // Заявка без объекта ни к какому визиту не относится и счётчик не трогает.
    if (!locationId) continue
    if (!isOpenTicketStatus(card.status)) continue

    const bucket = byLocation.get(locationId) || { urgent: 0, nonUrgent: 0 }
    if (card.urgency === 'URGENT') bucket.urgent += 1
    else bucket.nonUrgent += 1
    byLocation.set(locationId, bucket)
  }

  return byLocation
}

export function countsForLocation(
  counts: Map<string, LocationTicketCounts> | null | undefined,
  locationId: string | null | undefined,
): LocationTicketCounts {
  if (!counts || !locationId) return { ...EMPTY_TICKET_COUNTS }
  return counts.get(locationId) || { ...EMPTY_TICKET_COUNTS }
}

// ── состояние визита ────────────────────────────────────────────────────────

export type VisitState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

export const VISIT_STATE_ACTION_LABELS: Record<VisitState, string> = {
  NOT_STARTED: 'Начать обход',
  IN_PROGRESS: 'Продолжить',
  COMPLETED: 'Обход выполнен',
}

/**
 * Состояние определяет последнее исполнение плана, а не сам план: незакрытый
 * обход — это визит в работе, завершённый — визит выполнен. Плана без обходов
 * ещё не касались.
 *
 * SMA-ROUNDS-RECURRENCE-FIX: завершение обхода переводит периодический план
 * на следующий срок. Завершённый обход прошлого визита поэтому не делает
 * выполненным новый: визит выполнен, только если обход закрывал именно
 * текущий срок плана.
 */
export function deriveVisitState(schedule: Pick<InspectionSchedule, 'lastRun' | 'nextDueAt'>): VisitState {
  const lastRun = schedule?.lastRun
  if (lastRun?.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (lastRun?.status === 'COMPLETED' && sameInstant(lastRun.dueAt, schedule.nextDueAt)) return 'COMPLETED'
  return 'NOT_STARTED'
}

function sameInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const at = Date.parse(a)
  return Number.isFinite(at) && at === Date.parse(b)
}

// ── карточка визита ─────────────────────────────────────────────────────────

/**
 * Адрес — то, что технику нужно, чтобы доехать. Если его не заполнили, идём
 * вниз по конкретности: город, затем код площадки. Пустая строка означает,
 * что показывать под названием нечего.
 */
export function locationAddressLine(location?: InspectionSchedule['location'] | null): string {
  const address = location?.address?.trim()
  if (address) return address
  const city = location?.city?.trim()
  if (city) return city
  const code = location?.platformCode?.trim()
  if (code) return code
  return ''
}

/** Время визита в локальном виде; без срока — пусто, а не «Invalid Date». */
export function plannedTimeLabel(nextDueAt?: string | null): string {
  if (!nextDueAt) return ''
  const date = new Date(nextDueAt)
  if (Number.isNaN(date.getTime())) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/** Для прошлых визитов нужны дата и год: одних часов недостаточно. */
export function plannedDateLabel(nextDueAt?: string | null): string {
  if (!nextDueAt) return ''
  const date = new Date(nextDueAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Льготные дни считает сервер. Прошлый срок сам по себе ещё не просрочка. */
export function previousVisitStatusLabel(schedule: Pick<InspectionSchedule, 'isOverdue'>): string {
  if (schedule.isOverdue === true) return 'Просрочен'
  if (schedule.isOverdue === false) return 'В пределах льготного срока'
  return 'Ожидает выполнения'
}

/**
 * Порядок — по запланированному времени. Бэкенд уже сортирует по nextDueAt,
 * но экран не должен зависеть от того, что его не переставят: визит без срока
 * уходит в конец, равные сроки разводятся по названию, чтобы порядок был
 * устойчивым между обновлениями.
 */
export function sortVisitsByPlannedTime<T extends Pick<InspectionSchedule, 'nextDueAt' | 'name'>>(
  schedules: T[] | null | undefined,
): T[] {
  const list = [...(schedules || [])]
  list.sort((a, b) => {
    const aTime = a?.nextDueAt ? new Date(a.nextDueAt).getTime() : Number.NaN
    const bTime = b?.nextDueAt ? new Date(b.nextDueAt).getTime() : Number.NaN
    const aBad = Number.isNaN(aTime)
    const bBad = Number.isNaN(bTime)
    if (aBad && bBad) return (a?.name || '').localeCompare(b?.name || '')
    if (aBad) return 1
    if (bBad) return -1
    if (aTime !== bTime) return aTime - bTime
    return (a?.name || '').localeCompare(b?.name || '')
  })
  return list
}

export type TodayVisitCard = {
  scheduleId: string
  templateId: string
  locationId: string
  equipmentId?: string
  plannedTime: string
  plannedDate: string
  previousStatusLabel: string
  isOverdue: boolean
  locationName: string
  addressLine: string
  templateName: string
  counts: LocationTicketCounts
  state: VisitState
  actionLabel: string
  runId: string | null
}

export function toTodayVisitCard(
  schedule: InspectionSchedule,
  counts: Map<string, LocationTicketCounts> | null | undefined,
): TodayVisitCard {
  const state = deriveVisitState(schedule)
  return {
    scheduleId: schedule.id,
    templateId: schedule.template?.id,
    locationId: schedule.location?.id,
    equipmentId: schedule.equipment?.id,
    plannedTime: plannedTimeLabel(schedule.nextDueAt),
    plannedDate: plannedDateLabel(schedule.nextDueAt),
    previousStatusLabel: previousVisitStatusLabel(schedule),
    isOverdue: schedule.isOverdue === true,
    locationName: schedule.location?.name || '',
    addressLine: locationAddressLine(schedule.location),
    templateName: schedule.template?.name || '',
    counts: countsForLocation(counts, schedule.location?.id),
    state,
    actionLabel: VISIT_STATE_ACTION_LABELS[state],
    runId: schedule.lastRun?.id ?? null,
  }
}

export function toTodayVisitCards(
  schedules: InspectionSchedule[] | null | undefined,
  counts: Map<string, LocationTicketCounts> | null | undefined,
): TodayVisitCard[] {
  return sortVisitsByPlannedTime(schedules).map((schedule) => toTodayVisitCard(schedule, counts))
}

// ── отказы запуска ──────────────────────────────────────────────────────────

export const RUN_IN_PROGRESS_CODE = 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS'
export const IDEMPOTENCY_IN_PROGRESS_CODE = 'IDEMPOTENCY_IN_PROGRESS'

export type StartFailure =
  /** Визит уже начат: вести к этому обходу, а не создавать второй. */
  | { kind: 'open'; runId: string }
  /** Тот же запуск ещё выполняется. Состояние временное: повторить, не плодить. */
  | { kind: 'retry' }
  /** Смена закрыта: показать существующий запрос на открытие смены. */
  | { kind: 'shift' }
  | { kind: 'error'; message: string }

function payloadOf(error: unknown): Record<string, unknown> | null {
  const payload = (error as { payload?: unknown })?.payload
  if (payload && typeof payload === 'object') return payload as Record<string, unknown>
  return null
}

function codeOf(error: unknown): string {
  const code = payloadOf(error)?.code
  return typeof code === 'string' ? code : ''
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return (error.message || '').trim()
  return String((error as { message?: unknown })?.message ?? '').trim()
}

/**
 * Разбор отказа запуска планового визита.
 *
 * Три отказа бэкенда означают разное и обязаны вести себя по-разному: открытый
 * обход — это навигация, идемпотентность — повтор, смена — существующий запрос
 * на её открытие. Слив их в одну ошибку показал бы технику тупик там, где
 * действие очевидно.
 */
export function resolveStartFailure(error: unknown): StartFailure {
  if (isActiveShiftRequiredError(error)) return { kind: 'shift' }

  const code = codeOf(error)
  if (code === RUN_IN_PROGRESS_CODE) {
    const runId = payloadOf(error)?.runId
    if (typeof runId === 'string' && runId) return { kind: 'open', runId }
    // Код без номера обхода: вести некуда, но и вторым обходом это не станет.
    return { kind: 'retry' }
  }
  if (code === IDEMPOTENCY_IN_PROGRESS_CODE) return { kind: 'retry' }

  return { kind: 'error', message: messageOf(error) || 'Не удалось начать обход' }
}
