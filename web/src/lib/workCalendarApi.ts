/**
 * SMA-WORK-CALENDAR-V1 — клиент GET /work-calendar.
 *
 * Контракт — отчёт Агента 2 «первый этап единого календаря сервисных работ»
 * (22.10.2026), раздел 3. Календарь только читает: других вызовов у модуля нет.
 *
 * Типы намеренно терпимы к отсутствующим полям: бэкенд V1 пишется параллельно,
 * и лишнее или недостающее необязательное поле не должно ронять страницу.
 * Нормализация — в normalizeWorkCalendarResponse.
 */
import { request } from './api'

export type WorkCalendarEventKind = 'TICKET' | 'INSPECTION'
export type WorkCalendarEventSource = 'TICKET' | 'INSPECTION_SCHEDULE'
export type WorkCalendarAssigned = 'all' | 'assigned' | 'unassigned'

export type WorkCalendarTiming = {
  /** DUE — у события есть срок (точка на дате), UNSCHEDULED — даты нет. */
  mode: 'DUE' | 'UNSCHEDULED'
  /** В V1 всегда null: рабочего окна в данных нет. */
  startAt: string | null
  endAt: string | null
  /** Срок: Ticket.plannedDueAt или InspectionSchedule.nextDueAt. Не время начала. */
  dueAt: string | null
  /** В V1 всегда false. */
  hasWindow: boolean
}

export type WorkCalendarRecurrence = {
  frequency: string
  intervalDays: number | null
  nextDueAt: string
  overdueAt: string | null
  isOverdue: boolean
}

export type WorkCalendarEvent = {
  id: string
  kind: WorkCalendarEventKind
  source: WorkCalendarEventSource
  entityId: string
  ticketId?: string | null
  scheduleId?: string | null
  workOrderId?: string | null
  companyId: string
  clientCompanyId?: string | null
  locationId: string | null
  employeeId: string | null
  title: string
  status: string | null
  timing: WorkCalendarTiming
  recurrence?: WorkCalendarRecurrence | null
  links?: {
    ticket?: string
    schedule?: string
    location?: string
  } | null
}

export type WorkCalendarEmployee = {
  id: string
  companyId: string
  displayName: string
  role: string
  isActive: boolean
  isExecutor: boolean
  eventCount: number
}

/** Форма ресурса объекта в отчёте не зафиксирована — берём минимально нужное. */
export type WorkCalendarLocation = {
  id: string
  name: string
  address?: string | null
  city?: string | null
  clientCompanyId?: string | null
  clientName?: string | null
  eventCount?: number
}

export type WorkCalendarCapabilities = {
  tickets: boolean
  inspections: boolean
  resources: boolean
}

export type WorkCalendarResponse = {
  version: number
  range: { from: string; to: string; timezone: string }
  capabilities: WorkCalendarCapabilities
  resources: { employees: WorkCalendarEmployee[]; locations: WorkCalendarLocation[] }
  events: WorkCalendarEvent[]
  meta: { total: number; scheduled: number; unscheduled: number; truncated: boolean }
}

export type WorkCalendarParams = {
  /** ISO 8601 UTC, полуинтервал [from, to). */
  from: string
  to: string
  timezone?: string
  view?: 'day' | 'week' | 'month'
  employeeIds?: string[]
  locationIds?: string[]
  eventTypes?: WorkCalendarEventKind[]
  statuses?: string[]
  assigned?: WorkCalendarAssigned
  linkedClientCompanyId?: string
  companyId?: string
  includeUnscheduled?: boolean
  includeCompleted?: boolean
}

function setList(search: URLSearchParams, key: string, values?: readonly string[]) {
  const clean = (values ?? []).map((v) => v.trim()).filter(Boolean)
  if (clean.length) search.set(key, clean.join(','))
}

/** Строка запроса. Пустые фильтры не отправляются: «не задано» ≠ «пустой список». */
export function buildWorkCalendarQuery(params: WorkCalendarParams): string {
  const search = new URLSearchParams()
  search.set('from', params.from)
  search.set('to', params.to)
  if (params.timezone) search.set('timezone', params.timezone)
  if (params.view) search.set('view', params.view)
  setList(search, 'employeeIds', params.employeeIds)
  setList(search, 'locationIds', params.locationIds)
  setList(search, 'eventTypes', params.eventTypes)
  setList(search, 'statuses', params.statuses)
  if (params.assigned && params.assigned !== 'all') search.set('assigned', params.assigned)
  if (params.linkedClientCompanyId) search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  else if (params.companyId) search.set('companyId', params.companyId)
  if (params.includeUnscheduled !== undefined) search.set('includeUnscheduled', String(params.includeUnscheduled))
  if (params.includeCompleted !== undefined) search.set('includeCompleted', String(params.includeCompleted))
  return search.toString()
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

/**
 * Ответ → предсказуемая форма.
 *
 * Отсутствующий флаг capabilities считается false: источник, про который
 * сервер не сказал «доступен», показывается недоступным, а не пустым.
 */
export function normalizeWorkCalendarResponse(raw: unknown): WorkCalendarResponse {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<WorkCalendarResponse>
  const caps = (data.capabilities ?? {}) as Partial<WorkCalendarCapabilities>
  const meta = (data.meta ?? {}) as Partial<WorkCalendarResponse['meta']>
  const events = asArray<WorkCalendarEvent>(data.events).filter((e) => e && typeof e.id === 'string')
  return {
    version: typeof data.version === 'number' ? data.version : 1,
    range: {
      from: data.range?.from ?? '',
      to: data.range?.to ?? '',
      timezone: data.range?.timezone ?? '',
    },
    capabilities: {
      tickets: caps.tickets === true,
      inspections: caps.inspections === true,
      resources: caps.resources === true,
    },
    resources: {
      employees: asArray<WorkCalendarEmployee>(data.resources?.employees),
      locations: asArray<WorkCalendarLocation>(data.resources?.locations),
    },
    events,
    meta: {
      total: typeof meta.total === 'number' ? meta.total : events.length,
      scheduled: typeof meta.scheduled === 'number' ? meta.scheduled : 0,
      unscheduled: typeof meta.unscheduled === 'number' ? meta.unscheduled : 0,
      truncated: meta.truncated === true,
    },
  }
}

export async function getWorkCalendar(params: WorkCalendarParams): Promise<WorkCalendarResponse> {
  const raw = await request<unknown>(`/work-calendar?${buildWorkCalendarQuery(params)}`)
  return normalizeWorkCalendarResponse(raw)
}
