/**
 * SMA-WORK-CALENDAR-V1 — правила отображения единого календаря работ.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node.
 *
 * Календарь — read-only проекция. Чего здесь нет намеренно:
 *
 * Рабочих слотов. В данных V1 нет ни времени начала, ни длительности:
 * Ticket.plannedDueAt и InspectionSchedule.nextDueAt — сроки. Срок кладётся
 * на дату как отметка «до …», а не растягивается в блок на шкале часов.
 * Время 09:00, «час на работу», конец рабочего дня не подставляются.
 *
 * Своей просрочки. Просрочку обхода считает recurrence-логика бэкенда
 * (recurrence.isOverdue), календарь её только показывает.
 *
 * Прав. Что пользователь видит, решает GET /work-calendar. Фильтры здесь
 * только сужают уже полученный ответ и никогда не расширяют его.
 */
import { appendScopeToPath } from './api'
import { locationCardPath, type ScopeParams } from './equipmentCard'
import { locationSectionLinks } from './locationCardSections'
import type {
  WorkCalendarAssigned,
  WorkCalendarCapabilities,
  WorkCalendarEvent,
  WorkCalendarEventKind,
  WorkCalendarResponse,
} from './workCalendarApi'

export type CalendarView = 'day' | 'week' | 'month'
export type CalendarGrouping = 'employees' | 'locations' | 'works'

export const VIEW_LABEL: Record<CalendarView, string> = { day: 'День', week: 'Неделя', month: 'Месяц' }
export const GROUPING_LABEL: Record<CalendarGrouping, string> = {
  employees: 'По сотрудникам',
  locations: 'По объектам',
  works: 'По работам',
}
export const KIND_LABEL: Record<WorkCalendarEventKind, string> = { TICKET: 'Заявка', INSPECTION: 'Обход' }

// ─── Диапазон ───────────────────────────────────────────────────────────────

export type CalendarRange = {
  view: CalendarView
  /** Начало первого дня, локальная полночь. */
  from: Date
  /** Начало дня после последнего — граница полуинтервала [from, to). */
  to: Date
  /** Дни диапазона, YYYY-MM-DD в часовом поясе браузера. */
  days: string[]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD по локальным компонентам даты. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/**
 * Границы дня, недели (с понедельника) и месяца.
 *
 * Только сборка даты из компонентов (new Date(y, m, d)): прибавление 24 часов
 * к полуночи в день перевода часов дало бы 23:00 или 01:00, и сутки съехали бы.
 */
export function calendarRange(view: CalendarView, anchor: Date): CalendarRange {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const d = anchor.getDate()
  let from: Date
  let to: Date
  if (view === 'day') {
    from = new Date(y, m, d)
    to = new Date(y, m, d + 1)
  } else if (view === 'week') {
    const mondayOffset = (anchor.getDay() + 6) % 7
    from = new Date(y, m, d - mondayOffset)
    to = new Date(y, m, d - mondayOffset + 7)
  } else {
    from = new Date(y, m, 1)
    to = new Date(y, m + 1, 1)
  }
  const days: string[] = []
  for (let i = 0; ; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    if (day >= to) break
    days.push(dayKey(day))
  }
  return { view, from, to, days }
}

/** Соседний период: step = -1 назад, +1 вперёд. */
export function shiftAnchor(view: CalendarView, anchor: Date, step: number): Date {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const d = anchor.getDate()
  if (view === 'day') return new Date(y, m, d + step)
  if (view === 'week') return new Date(y, m, d + step * 7)
  // Месяц: якорь — первое число, иначе 31 января + 1 месяц уехало бы в март.
  return new Date(y, m + step, 1)
}

export function rangeTitle(range: CalendarRange): string {
  const first = range.from
  const last = parseDayKey(range.days[range.days.length - 1] ?? dayKey(range.from))
  if (range.view === 'day') {
    return first.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (range.view === 'month') {
    const label = first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }
  const sameMonth = first.getMonth() === last.getMonth()
  const left = first.toLocaleDateString('ru-RU', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const right = last.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${left} – ${right}`
}

/** Заголовок колонки дня: «пн 21». */
export function dayColumnLabel(key: string): { weekday: string; day: string } {
  const date = parseDayKey(key)
  return {
    weekday: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
    day: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  }
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// ─── Время события ──────────────────────────────────────────────────────────

function validDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Срок события или null.
 *
 * Только mode = DUE с корректной датой. startAt/endAt не читаются: в V1 их нет,
 * а срок без окна не становится началом работы.
 */
export function eventDueAt(event: WorkCalendarEvent): Date | null {
  if (event.timing?.mode !== 'DUE') return null
  return validDate(event.timing.dueAt)
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat | null>()

function zonedFormatter(timeZone: string): Intl.DateTimeFormat | null {
  if (!zonedFormatters.has(timeZone)) {
    try {
      zonedFormatters.set(timeZone, new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }))
    } catch {
      zonedFormatters.set(timeZone, null)
    }
  }
  return zonedFormatters.get(timeZone) ?? null
}

/** День срока в часовом поясе календаря. Неизвестный пояс — пояс браузера. */
export function zonedDayKey(date: Date, timeZone: string | null | undefined): string {
  const formatter = timeZone ? zonedFormatter(timeZone) : null
  if (!formatter) return dayKey(date)
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function zonedTime(date: Date, timeZone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
  try {
    return date.toLocaleTimeString('ru-RU', timeZone ? { ...options, timeZone } : options)
  } catch {
    return date.toLocaleTimeString('ru-RU', options)
  }
}

/** Подпись на отметке в ячейке дня: «срок 14:00». Без срока — пусто. */
export function dueChipLabel(event: WorkCalendarEvent, timeZone?: string | null): string {
  const due = eventDueAt(event)
  return due ? `срок ${zonedTime(due, timeZone)}` : ''
}

/** Полная подпись срока для карточки и списка. */
export function dueFullLabel(event: WorkCalendarEvent, timeZone?: string | null): string {
  const due = eventDueAt(event)
  if (!due) return 'Без плановой даты'
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  let date: string
  try {
    date = due.toLocaleDateString('ru-RU', timeZone ? { ...options, timeZone } : options)
  } catch {
    date = due.toLocaleDateString('ru-RU', options)
  }
  return `до ${date}, ${zonedTime(due, timeZone)}`
}

export type TimingSplit = {
  /** День → события со сроком в этот день, по возрастанию срока. */
  byDay: Map<string, WorkCalendarEvent[]>
  /** Без плановой даты — секция «Без назначенного времени». */
  unscheduled: WorkCalendarEvent[]
  /** Срок вне видимых дней (пояс сервера и браузера разошёлся). Не теряем молча. */
  outside: WorkCalendarEvent[]
}

export function splitByTiming(events: readonly WorkCalendarEvent[], days: readonly string[], timeZone?: string | null): TimingSplit {
  const visible = new Set(days)
  const byDay = new Map<string, WorkCalendarEvent[]>()
  const unscheduled: WorkCalendarEvent[] = []
  const outside: WorkCalendarEvent[] = []
  for (const event of sortEvents(events)) {
    const due = eventDueAt(event)
    if (!due) {
      unscheduled.push(event)
      continue
    }
    const key = zonedDayKey(due, timeZone)
    if (!visible.has(key)) {
      outside.push(event)
      continue
    }
    const list = byDay.get(key)
    if (list) list.push(event)
    else byDay.set(key, [event])
  }
  return { byDay, unscheduled, outside }
}

/** По сроку; без срока — в конце; при равенстве — по названию. */
export function sortEvents(events: readonly WorkCalendarEvent[]): WorkCalendarEvent[] {
  return [...events].sort((a, b) => {
    const da = eventDueAt(a)?.getTime() ?? Number.POSITIVE_INFINITY
    const db = eventDueAt(b)?.getTime() ?? Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    return (a.title || '').localeCompare(b.title || '', 'ru')
  })
}

// ─── Фильтры ────────────────────────────────────────────────────────────────

export type CalendarFilters = {
  employeeIds: string[]
  locationIds: string[]
  eventTypes: WorkCalendarEventKind[]
  statuses: string[]
  assigned: WorkCalendarAssigned
  includeUnscheduled: boolean
  includeCompleted: boolean
}

export const EMPTY_FILTERS: CalendarFilters = {
  employeeIds: [],
  locationIds: [],
  eventTypes: [],
  statuses: [],
  assigned: 'all',
  includeUnscheduled: true,
  includeCompleted: false,
}

export function activeFilterCount(filters: CalendarFilters): number {
  return (
    (filters.employeeIds.length ? 1 : 0) +
    (filters.locationIds.length ? 1 : 0) +
    (filters.eventTypes.length ? 1 : 0) +
    (filters.statuses.length ? 1 : 0) +
    (filters.assigned !== 'all' ? 1 : 0)
  )
}

/**
 * Те же фильтры, что ушли на сервер, повторно на ответе.
 *
 * Только сужение. Если сервер параметр не поддержал, лишнее не покажется;
 * если поддержал — повтор ничего не меняет. Расширить ответ отсюда нельзя.
 */
export function applyFilters(events: readonly WorkCalendarEvent[], filters: CalendarFilters): WorkCalendarEvent[] {
  const employees = new Set(filters.employeeIds)
  const locations = new Set(filters.locationIds)
  const kinds = new Set(filters.eventTypes)
  const statuses = new Set(filters.statuses)
  return events.filter((event) => {
    if (employees.size && !(event.employeeId && employees.has(event.employeeId))) return false
    if (locations.size && !(event.locationId && locations.has(event.locationId))) return false
    if (kinds.size && !kinds.has(event.kind)) return false
    if (statuses.size && !(event.status && statuses.has(event.status))) return false
    if (filters.assigned === 'assigned' && !event.employeeId) return false
    if (filters.assigned === 'unassigned' && event.employeeId) return false
    if (!filters.includeUnscheduled && !eventDueAt(event)) return false
    return true
  })
}

// ─── Строки ─────────────────────────────────────────────────────────────────

export type CalendarRowKind = 'employee' | 'location' | 'unassigned' | 'noLocation' | 'otherEmployees' | 'otherLocations'

export type CalendarRow = {
  key: string
  kind: CalendarRowKind
  label: string
  sublabel: string
  inactive: boolean
  events: WorkCalendarEvent[]
}

function groupBy(events: readonly WorkCalendarEvent[], keyOf: (e: WorkCalendarEvent) => string | null) {
  const map = new Map<string | null, WorkCalendarEvent[]>()
  for (const event of events) {
    const key = keyOf(event)
    const list = map.get(key)
    if (list) list.push(event)
    else map.set(key, [event])
  }
  return map
}

const ROLE_LABEL: Record<string, string> = {
  PLATFORM_ADMIN: 'Администратор платформы',
  ADMIN: 'Администратор',
  ADMIN_PROVIDER: 'Администратор',
  CLIENT_ADMIN: 'Администратор клиента',
  DISPATCHER: 'Диспетчер',
  MASTER: 'Мастер',
  TECHNICIAN: 'Техник',
  CLIENT: 'Клиент',
  TERRITORIAL_MANAGER: 'Территориальный менеджер',
  NETWORK_DIRECTOR: 'Директор сети',
  STAFF: 'Сотрудник',
}

/**
 * Строки сотрудников.
 *
 * Список сотрудников — resources.employees, а не события: сотрудник без работ
 * в периоде остаётся строкой с пустыми днями. Событие исполнителя, которого
 * нет в ресурсах, не теряется — уходит в общую строку без идентификатора.
 */
export function buildEmployeeRows(
  response: Pick<WorkCalendarResponse, 'resources'>,
  events: readonly WorkCalendarEvent[],
  options: { filters: CalendarFilters; showEmpty: boolean },
): CalendarRow[] {
  const { filters, showEmpty } = options
  const byEmployee = groupBy(events, (e) => e.employeeId ?? null)
  const selected = new Set(filters.employeeIds)
  const known = new Set<string>()
  const rows: CalendarRow[] = []

  const employees = [...response.resources.employees]
    .filter((emp) => emp && typeof emp.id === 'string')
    .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'ru'))
  for (const emp of employees) {
    known.add(emp.id)
    if (selected.size && !selected.has(emp.id)) continue
    if (filters.assigned === 'unassigned') continue
    const own = byEmployee.get(emp.id) ?? []
    if (!own.length && !showEmpty) continue
    rows.push({
      key: `employee:${emp.id}`,
      kind: 'employee',
      label: emp.displayName || 'Без имени',
      sublabel: ROLE_LABEL[emp.role] ?? '',
      inactive: emp.isActive === false,
      events: own,
    })
  }

  const others = events.filter((e) => e.employeeId && !known.has(e.employeeId))
  if (others.length) {
    rows.push({
      key: 'otherEmployees',
      kind: 'otherEmployees',
      label: 'Другие исполнители',
      sublabel: 'Нет в списке сотрудников',
      inactive: false,
      events: others,
    })
  }

  const unassigned = byEmployee.get(null) ?? []
  const unassignedHidden = selected.size > 0 || filters.assigned === 'assigned'
  if (!unassignedHidden && (unassigned.length || showEmpty)) {
    rows.push({
      key: 'unassigned',
      kind: 'unassigned',
      label: 'Нераспределённые',
      sublabel: 'Исполнитель не назначен',
      inactive: false,
      events: unassigned,
    })
  }
  return rows
}

/** Строки объектов — тот же принцип, что у сотрудников. */
export function buildLocationRows(
  response: Pick<WorkCalendarResponse, 'resources'>,
  events: readonly WorkCalendarEvent[],
  options: { filters: CalendarFilters; showEmpty: boolean },
): CalendarRow[] {
  const { filters, showEmpty } = options
  const byLocation = groupBy(events, (e) => e.locationId ?? null)
  const selected = new Set(filters.locationIds)
  const known = new Set<string>()
  const rows: CalendarRow[] = []

  const locations = [...response.resources.locations]
    .filter((loc) => loc && typeof loc.id === 'string')
    .sort((a, b) => (a.city || '').localeCompare(b.city || '', 'ru') || (a.name || '').localeCompare(b.name || '', 'ru'))
  for (const loc of locations) {
    known.add(loc.id)
    if (selected.size && !selected.has(loc.id)) continue
    const own = byLocation.get(loc.id) ?? []
    if (!own.length && !showEmpty) continue
    rows.push({
      key: `location:${loc.id}`,
      kind: 'location',
      label: loc.name || 'Без названия',
      sublabel: [loc.city, loc.address, loc.clientName]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' · '),
      inactive: false,
      events: own,
    })
  }

  const others = events.filter((e) => e.locationId && !known.has(e.locationId))
  if (others.length) {
    rows.push({
      key: 'otherLocations',
      kind: 'otherLocations',
      label: 'Другие объекты',
      sublabel: 'Нет в списке объектов',
      inactive: false,
      events: others,
    })
  }
  const noLocation = byLocation.get(null) ?? []
  if (noLocation.length && !selected.size) {
    rows.push({ key: 'noLocation', kind: 'noLocation', label: 'Без объекта', sublabel: '', inactive: false, events: noLocation })
  }
  return rows
}

// ─── Подписи и ссылки ───────────────────────────────────────────────────────

const STATUS_RU: Record<string, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  AWAITING_ACCEPTANCE: 'Ожидает приёмки',
  FIELD_COMPLETE: 'Выполнено',
  DONE: 'Завершена',
  CANCELED: 'Отменена',
  ACTIVE: 'Активен',
  INACTIVE: 'Приостановлен',
  OVERDUE: 'Просрочен',
  DUE: 'К выполнению',
  SCHEDULED: 'Запланирован',
  COMPLETED: 'Выполнен',
}

/** Статусы заявок для фильтра — всегда в списке, даже если в периоде их нет. */
export const TICKET_STATUS_OPTIONS = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'FIELD_COMPLETE', 'DONE', 'CANCELED']

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_RU[status] ?? status
}

/** Варианты фильтра статусов: статусы заявок + встреченные в ответе. */
export function statusOptions(events: readonly WorkCalendarEvent[]): string[] {
  const seen = new Set(TICKET_STATUS_OPTIONS)
  const extra: string[] = []
  for (const event of events) {
    if (event.status && !seen.has(event.status)) {
      seen.add(event.status)
      extra.push(event.status)
    }
  }
  return [...TICKET_STATUS_OPTIONS, ...extra.sort()]
}

const FREQUENCY_RU: Record<string, string> = {
  DAILY: 'Ежедневно',
  WEEKLY: 'Еженедельно',
  BIWEEKLY: 'Раз в две недели',
  MONTHLY: 'Ежемесячно',
  QUARTERLY: 'Раз в квартал',
  SEMIANNUAL: 'Раз в полгода',
  YEARLY: 'Ежегодно',
  ANNUAL: 'Ежегодно',
  CUSTOM: 'Свой интервал',
}

export function frequencyLabel(frequency: string | null | undefined, intervalDays?: number | null): string {
  if (!frequency) return '—'
  if (intervalDays && (frequency === 'CUSTOM' || !FREQUENCY_RU[frequency])) return `Каждые ${intervalDays} дн.`
  return FREQUENCY_RU[frequency] ?? frequency
}

/** Просрочка — только из recurrence-логики бэкенда. Своего расчёта нет. */
export function isServerOverdue(event: WorkCalendarEvent): boolean {
  return event.recurrence?.isOverdue === true
}

export type EventLinks = {
  /** Переход в существующую заявку или план обходов. */
  primary: { label: string; to: string } | null
  location: string | null
}

/**
 * Переходы из карточки — только в существующие страницы.
 *
 * links из ответа не используются как адреса: там может оказаться путь API,
 * а не страницы. Пути строятся каноническими построителями и несут область
 * (linkedClientCompanyId / companyId) тем параметром, которым она пришла.
 */
export function eventLinks(event: WorkCalendarEvent, scope?: ScopeParams | null): EventLinks {
  const cleanScope = {
    ...(scope?.linkedClientCompanyId ? { linkedClientCompanyId: scope.linkedClientCompanyId } : {}),
    ...(scope?.companyId && !scope?.linkedClientCompanyId ? { companyId: scope.companyId } : {}),
  }
  const hasScope = Object.keys(cleanScope).length > 0
  const locationId = (event.locationId || '').trim()

  let primary: EventLinks['primary'] = null
  if (event.kind === 'TICKET') {
    const ticketId = (event.ticketId || (event.source === 'TICKET' ? event.entityId : '') || '').trim()
    if (ticketId) {
      const path = `/tickets/${encodeURIComponent(ticketId)}`
      primary = { label: 'Открыть заявку', to: hasScope ? appendScopeToPath(path, cleanScope) : path }
    }
  } else if (event.kind === 'INSPECTION') {
    // Отдельной страницы графика нет: план обходов, суженный до объекта.
    primary = {
      label: 'Открыть план обходов',
      to: locationSectionLinks({ locationId, scope: cleanScope, canViewAnalytics: false }).rounds,
    }
  }
  return {
    primary,
    location: locationId ? locationCardPath(encodeURIComponent(locationId), cleanScope) : null,
  }
}

// ─── Состояние ответа ───────────────────────────────────────────────────────

/** Предупреждения о частично доступных источниках. Недоступное ≠ пустое. */
export function capabilityNotices(caps: WorkCalendarCapabilities): string[] {
  const notices: string[] = []
  if (!caps.tickets && !caps.inspections) {
    notices.push('Заявки и обходы недоступны вашей роли — календарь пуст не потому, что работ нет.')
  } else if (!caps.tickets) {
    notices.push('Заявки недоступны вашей роли: в календаре только обходы.')
  } else if (!caps.inspections) {
    notices.push('Обходы недоступны вашей роли: в календаре только заявки.')
  }
  if (!caps.resources) {
    notices.push('Списки сотрудников и объектов недоступны: строки построены только по событиям, сотрудники без работ не показаны.')
  }
  return notices
}

/** Сообщение о неполном ответе или null. */
export function truncatedNotice(response: Pick<WorkCalendarResponse, 'meta' | 'events'>): string | null {
  if (!response.meta.truncated) return null
  const shown = response.events.length
  const total = response.meta.total
  const counts = total > shown ? `: показано ${shown} из ${total}` : ''
  return `Показаны не все события${counts}. Сократите период или уточните фильтры.`
}
