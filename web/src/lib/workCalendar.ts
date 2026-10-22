/**
 * SMA-WORK-CALENDAR-V1 — правила отображения единого календаря работ.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node.
 *
 * Календарь — read-only проекция GET /work-calendar (backend PR #453).
 * Чего здесь нет намеренно:
 *
 * Рабочих слотов. В данных V1 нет ни времени начала, ни длительности:
 * Ticket.plannedDueAt и InspectionSchedule.nextDueAt — сроки. Срок кладётся
 * на дату как отметка «срок …», а не растягивается в блок на шкале часов.
 *
 * Своего расчёта суток. День события — timing.localDate, посчитанный
 * сервером в поясе ответа. Пересчитывать его из dueAt здесь значило бы
 * завести второе правило «полночи по поясу».
 *
 * Своей просрочки. Просрочку плана обхода считает recurrence-логика
 * бэкенда (recurrence.isOverdue), календарь её только показывает.
 *
 * Прав. Что пользователь видит, решает сервер. Фильтры уходят на сервер
 * и повторно применяются к ответу — только сужая его.
 */
import { appendScopeToPath } from './api'
import { locationCardPath, type ScopeParams } from './equipmentCard'
import { locationSectionLinks } from './locationCardSections'
import {
  WORK_CALENDAR_COMPLETED_STATUSES,
  WORK_CALENDAR_INSPECTION_STATUSES,
  WORK_CALENDAR_TICKET_STATUSES,
  type WorkCalendarAssigned,
  type WorkCalendarCapabilities,
  type WorkCalendarEmployee,
  type WorkCalendarEvent,
  type WorkCalendarEventKind,
  type WorkCalendarMeta,
  type WorkCalendarParams,
  type WorkCalendarResponse,
  type WorkCalendarTruncatedSource,
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

/** ?date=YYYY-MM-DD → якорь календаря; иначе null. */
export function anchorFromSearch(value: string | null | undefined): Date | null {
  const raw = (value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const date = parseDayKey(raw)
  return dayKey(date) === raw ? date : null
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

/** Срок события или null. Только timing.mode = DUE. */
export function eventDueAt(event: WorkCalendarEvent): Date | null {
  if (event.timing.mode !== 'DUE' || !event.timing.dueAt) return null
  const date = new Date(event.timing.dueAt)
  return Number.isNaN(date.getTime()) ? null : date
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

/** Полная подпись срока для карточки и списка. Дата — localDate сервера. */
export function dueFullLabel(event: WorkCalendarEvent, timeZone?: string | null): string {
  const due = eventDueAt(event)
  if (!due || !event.timing.localDate) return 'Без плановой даты'
  const date = parseDayKey(event.timing.localDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  return `до ${date}, ${zonedTime(due, timeZone)}`
}

export type TimingSplit = {
  /** День → события со сроком в этот день, по возрастанию срока. */
  byDay: Map<string, WorkCalendarEvent[]>
  /** Без плановой даты — секция «Без назначенного времени». */
  unscheduled: WorkCalendarEvent[]
  /** localDate вне видимых дней. Не теряем молча. */
  outside: WorkCalendarEvent[]
}

/** Раскладка по timing.localDate сервера. */
export function splitByTiming(events: readonly WorkCalendarEvent[], days: readonly string[]): TimingSplit {
  const visible = new Set(days)
  const byDay = new Map<string, WorkCalendarEvent[]>()
  const unscheduled: WorkCalendarEvent[] = []
  const outside: WorkCalendarEvent[] = []
  for (const event of sortEvents(events)) {
    const day = event.timing.mode === 'DUE' ? event.timing.localDate : null
    if (!day) {
      unscheduled.push(event)
      continue
    }
    if (!visible.has(day)) {
      outside.push(event)
      continue
    }
    const list = byDay.get(day)
    if (list) list.push(event)
    else byDay.set(day, [event])
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
  /** DONE и CANCELED. Без флага сервер их не отдаёт даже при явном statuses. */
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

/** Все статусы фильтра — ровно те, что принимает сервер (иначе 400). */
export const STATUS_OPTIONS: string[] = [...new Set<string>([...WORK_CALENDAR_TICKET_STATUSES, ...WORK_CALENDAR_INSPECTION_STATUSES])]
const COMPLETED = new Set<string>(WORK_CALENDAR_COMPLETED_STATUSES)

export function isCompletedStatus(status: string): boolean {
  return COMPLETED.has(status)
}

/**
 * Фильтры → параметры запроса.
 *
 * Завершённые статусы без includeCompleted сервер всё равно не вернёт,
 * поэтому они из statuses убираются: иначе выбор «Завершена» без галки
 * выглядел бы как «таких работ нет», а не как «завершённые выключены».
 */
export function filterParams(
  filters: CalendarFilters,
): Pick<
  WorkCalendarParams,
  'employeeIds' | 'locationIds' | 'eventTypes' | 'statuses' | 'assigned' | 'includeUnscheduled' | 'includeCompleted'
> {
  const statuses = filters.includeCompleted ? filters.statuses : filters.statuses.filter((s) => !isCompletedStatus(s))
  return {
    employeeIds: filters.employeeIds,
    locationIds: filters.locationIds,
    eventTypes: filters.eventTypes,
    statuses: filters.statuses.length ? statuses : undefined,
    assigned: filters.assigned,
    includeUnscheduled: filters.includeUnscheduled,
    includeCompleted: filters.includeCompleted,
  }
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
 * Только сужение. Если сервер параметр не применил, лишнее не покажется;
 * если применил — повтор ничего не меняет.
 */
export function applyFilters(events: readonly WorkCalendarEvent[], filters: CalendarFilters): WorkCalendarEvent[] {
  const employees = new Set(filters.employeeIds)
  const locations = new Set(filters.locationIds)
  const kinds = new Set(filters.eventTypes)
  const statuses = new Set(filters.statuses)
  return events.filter((event) => {
    if (employees.size && !(event.employeeId && employees.has(event.employeeId))) return false
    if (locations.size && !locations.has(event.locationId)) return false
    if (kinds.size && !kinds.has(event.kind)) return false
    if (statuses.size && !statuses.has(event.status)) return false
    if (!filters.includeCompleted && isCompletedStatus(event.status)) return false
    if (filters.assigned === 'assigned' && !event.employeeId) return false
    if (filters.assigned === 'unassigned' && event.employeeId) return false
    if (!filters.includeUnscheduled && event.timing.mode !== 'DUE') return false
    return true
  })
}

// ─── Строки ─────────────────────────────────────────────────────────────────

export type CalendarRowKind = 'employee' | 'location' | 'unassigned' | 'otherEmployees' | 'otherLocations'

export type CalendarRow = {
  key: string
  kind: CalendarRowKind
  label: string
  sublabel: string
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
 * Подпись сотрудника.
 *
 * Своему сотруднику — роль и отметка «неактивен». Исполнителю другой
 * организации — только это: его роль, компания и признаки не выводятся,
 * даже если бы пришли (сервер обещает null, проверка ответа это требует).
 */
export function employeeSublabel(emp: Pick<WorkCalendarEmployee, 'isOwnCompany' | 'role' | 'isActive'>): string {
  if (!emp.isOwnCompany) return 'Другая организация'
  const role = emp.role ? (ROLE_LABEL[emp.role] ?? '') : ''
  return [role, emp.isActive === false ? 'неактивен' : ''].filter(Boolean).join(' · ')
}

/**
 * Строки сотрудников.
 *
 * Список — resources.employees, а не события: сотрудник без работ остаётся
 * строкой с пустыми днями. Порядок — как отдал сервер. Событие исполнителя,
 * которого нет в ресурсах, не теряется — уходит в общую строку без
 * идентификатора.
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

  for (const emp of response.resources.employees) {
    known.add(emp.id)
    if (selected.size && !selected.has(emp.id)) continue
    if (filters.assigned === 'unassigned') continue
    const own = byEmployee.get(emp.id) ?? []
    if (!own.length && !showEmpty) continue
    rows.push({
      key: `employee:${emp.id}`,
      kind: 'employee',
      label: emp.displayName || 'Без имени',
      sublabel: employeeSublabel(emp),
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
      events: others,
    })
  }

  const unassigned = byEmployee.get(null) ?? []
  const unassignedHidden = selected.size > 0 || filters.assigned === 'assigned'
  if (!unassignedHidden && (unassigned.length || showEmpty)) {
    rows.push({ key: 'unassigned', kind: 'unassigned', label: 'Нераспределённые', sublabel: 'Исполнитель не назначен', events: unassigned })
  }
  return rows
}

/** Строки объектов — тот же принцип; объекты без работ приходят из справочника сервера. */
export function buildLocationRows(
  response: Pick<WorkCalendarResponse, 'resources'>,
  events: readonly WorkCalendarEvent[],
  options: { filters: CalendarFilters; showEmpty: boolean },
): CalendarRow[] {
  const { filters, showEmpty } = options
  const byLocation = groupBy(events, (e) => e.locationId)
  const selected = new Set(filters.locationIds)
  const known = new Set<string>()
  const rows: CalendarRow[] = []

  for (const loc of response.resources.locations) {
    known.add(loc.id)
    if (selected.size && !selected.has(loc.id)) continue
    const own = byLocation.get(loc.id) ?? []
    if (!own.length && !showEmpty) continue
    rows.push({
      key: `location:${loc.id}`,
      kind: 'location',
      label: loc.name || 'Без названия',
      sublabel: [loc.city, loc.address]
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .join(' · '),
      events: own,
    })
  }

  const others = events.filter((e) => !known.has(e.locationId))
  if (others.length) {
    rows.push({ key: 'otherLocations', kind: 'otherLocations', label: 'Другие объекты', sublabel: 'Нет в списке объектов', events: others })
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
  SCHEDULED: 'Запланирован',
  OVERDUE: 'Просрочен',
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return STATUS_RU[status] ?? status
}

/** Подпись варианта фильтра: IN_PROGRESS общий у заявок и обходов. */
export function statusOptionLabel(status: string): string {
  if (status === 'SCHEDULED') return 'Обход: запланирован'
  if (status === 'OVERDUE') return 'Обход: просрочен'
  return statusLabel(status)
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
  /** Последний обход плана, если он есть. */
  lastRun: string | null
  location: string | null
}

/**
 * Область для переходов из события.
 *
 * Пришла в адресе — уезжает тем же параметром. Не пришла, а объект события
 * принадлежит другой компании (провайдер смотрит заявку клиента) — уезжает
 * linkedClientCompanyId этого клиента, как в соглашении контуров: без него
 * карточка провайдеру ответит «не найдено».
 */
export function eventScope(
  event: Pick<WorkCalendarEvent, 'clientCompanyId'>,
  urlScope: ScopeParams | null | undefined,
  actorCompanyId: string | null | undefined,
): { linkedClientCompanyId?: string; companyId?: string } {
  if (urlScope?.linkedClientCompanyId) return { linkedClientCompanyId: urlScope.linkedClientCompanyId }
  if (urlScope?.companyId) return { companyId: urlScope.companyId }
  const client = (event.clientCompanyId || '').trim()
  if (client && actorCompanyId && client !== actorCompanyId) return { linkedClientCompanyId: client }
  return {}
}

/** Переходы из карточки — только в существующие страницы. */
export function eventLinks(event: WorkCalendarEvent, urlScope?: ScopeParams | null, actorCompanyId?: string | null): EventLinks {
  const scope = eventScope(event, urlScope, actorCompanyId)
  const withScope = (path: string) => (Object.keys(scope).length ? appendScopeToPath(path, scope) : path)
  const locationId = event.locationId

  let primary: EventLinks['primary'] = null
  let lastRun: string | null = null
  if (event.kind === 'TICKET') {
    const ticketId = event.ticketId ?? event.entityId
    primary = { label: 'Открыть заявку', to: withScope(`/tickets/${encodeURIComponent(ticketId)}`) }
  } else {
    // Отдельной страницы плана нет: план обходов, суженный до объекта.
    primary = { label: 'Открыть план обходов', to: locationSectionLinks({ locationId, scope, canViewAnalytics: false }).rounds }
    const runId = event.inspection?.lastRunId
    if (runId) lastRun = withScope(`/inspection/runs/${encodeURIComponent(runId)}`)
  }
  return { primary, lastRun, location: locationCardPath(encodeURIComponent(locationId), scope) }
}

// ─── Состояние ответа ───────────────────────────────────────────────────────

/** Предупреждения о частично доступных источниках. Недоступное ≠ пустое. */
export function capabilityNotices(caps: WorkCalendarCapabilities): string[] {
  const notices: string[] = []
  if (caps.restrictedEmpty) {
    notices.push('У вас нет доступа ни к одному объекту в этом контуре — календарь пуст не потому, что работ нет.')
  }
  if (!caps.tickets && !caps.inspections) {
    notices.push('Заявки и обходы недоступны вашей роли.')
  } else if (!caps.tickets) {
    notices.push('Заявки недоступны вашей роли: в календаре только обходы.')
  } else if (!caps.inspections) {
    notices.push('Планы обходов недоступны вашей роли: в календаре только заявки.')
  }
  if (!caps.restrictedEmpty && !caps.employeeDirectory) {
    notices.push('Штат недоступен: строки — только исполнители показанных работ, сотрудники без работ не видны.')
  }
  if (!caps.restrictedEmpty && !caps.locationDirectory) {
    notices.push('Справочник объектов недоступен: строки — только объекты с работами.')
  }
  if (!caps.unscheduled) {
    notices.push('Работы без плановой даты сервер не показывает.')
  }
  return notices
}

const TRUNCATED_LABEL: Record<WorkCalendarTruncatedSource, string> = {
  scheduledTickets: 'заявки с плановой датой',
  unscheduledTickets: 'заявки без даты',
  inspections: 'планы обходов',
  employees: 'сотрудники',
  locations: 'объекты',
}

/** Сообщение о неполном ответе или null. Числа, источники и лимиты — из meta сервера. */
export function truncatedNotice(meta: WorkCalendarMeta): string | null {
  if (!meta.truncated) return null
  const parts = meta.truncatedSources.map((source) => {
    const limit = meta.limits[source]
    return `${TRUNCATED_LABEL[source]}${typeof limit === 'number' ? ` — первые ${limit}` : ''}`
  })
  const total = meta.totalIsExact ? `${meta.total}` : `не менее ${meta.total}`
  return `Показаны не все данные: работ в ответе ${meta.returned.total} из ${total}; обрезаны ${parts.join(', ')}. Сократите период или уточните фильтры.`
}
