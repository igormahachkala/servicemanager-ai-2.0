/**
 * SMA-WORK-CALENDAR-V1 — клиент GET /work-calendar.
 *
 * Контракт — backend PR #453 (backend/src/work-calendar, коммит a301a981):
 * work-calendar.controller.ts (параметры), work-calendar.service.ts (ответ),
 * work-calendar-events.ts (события и resources). Календарь только читает:
 * других вызовов у модуля нет.
 *
 * Ответ проверяется строго. Несовместимый ответ — ошибка с перечнем
 * расхождений, а не подстановка значений по умолчанию: иначе сменившийся
 * контракт выглядел бы как «работ нет» или «источник недоступен».
 * Лишние поля допускаются — их добавление контракт не ломает.
 */
import { request } from './api'

export const WORK_CALENDAR_EVENT_TYPES = ['TICKET', 'INSPECTION'] as const
export type WorkCalendarEventType = (typeof WORK_CALENDAR_EVENT_TYPES)[number]

/** Статусы, которые принимает фильтр statuses (TicketStatus + состояния визита плана). */
export const WORK_CALENDAR_TICKET_STATUSES = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAITING_ACCEPTANCE',
  'FIELD_COMPLETE',
  'DONE',
  'CANCELED',
] as const
export const WORK_CALENDAR_INSPECTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'OVERDUE'] as const

export const WORK_CALENDAR_TRUNCATED_SOURCES = ['scheduledTickets', 'unscheduledTickets', 'inspections', 'employees'] as const
export type WorkCalendarTruncatedSource = (typeof WORK_CALENDAR_TRUNCATED_SOURCES)[number]

export type WorkCalendarEvent = {
  id: string
  type: WorkCalendarEventType
  /** id заявки или плана обхода. */
  sourceId: string
  title: string
  status: string
  scheduling: 'SCHEDULED' | 'UNSCHEDULED'
  /** Плановый срок (Ticket.plannedDueAt / InspectionSchedule.nextDueAt). Не время начала. */
  dueAt: string | null
  /** Местные сутки срока в поясе ответа, YYYY-MM-DD. По ним событие ложится на день. */
  localDate: string | null
  startAt: null
  endAt: null
  hasWindow: false
  employeeId: string | null
  locationId: string
  clientCompanyId: string
  ticket?: {
    ticketNumber: number
    urgency: string
    priority: string
    slaDueAt: string | null
    parentId: string | null
  }
  inspection?: {
    frequency: string
    intervalDays: number | null
    templateName: string | null
    overdueAt: string
    isOverdue: boolean
    followingDueAt: string | null
    lastRunId: string | null
  }
}

export type WorkCalendarEmployee = {
  id: string
  firstName: string | null
  lastName: string | null
  displayName: string
  /** Сотрудник компании пользователя. Иначе — исполнитель видимой ему заявки. */
  isOwnCompany: boolean
}

export type WorkCalendarLocation = {
  id: string
  name: string
  city: string | null
  address: string | null
  clientCompanyId: string
}

export type WorkCalendarCapabilities = {
  readOnly: true
  eventTypes: Record<WorkCalendarEventType, boolean>
  unscheduled: boolean
  timeWindows: false
  recurrenceProjection: boolean
  employeeRoster: boolean
  restrictedEmpty: boolean
}

export type WorkCalendarResponse = {
  range: { from: string; to: string; timezone: string }
  resources: { employees: WorkCalendarEmployee[]; locations: WorkCalendarLocation[] }
  events: WorkCalendarEvent[]
  capabilities: WorkCalendarCapabilities
  meta: {
    truncated: boolean
    truncatedSources: WorkCalendarTruncatedSource[]
    limits: Record<string, number>
    counts: { scheduledTickets: number; unscheduledTickets: number; inspections: number }
    generatedAt: string
  }
}

export type WorkCalendarParams = {
  /** Первые сутки, YYYY-MM-DD — полночь в поясе timezone. */
  from: string
  /** Сутки после последних, YYYY-MM-DD: диапазон [from, to). */
  to: string
  timezone: string
  employeeIds?: string[]
  locationIds?: string[]
  types?: WorkCalendarEventType[]
  statuses?: string[]
  includeUnscheduled?: boolean
  linkedClientCompanyId?: string
  companyId?: string
}

function setList(search: URLSearchParams, key: string, values?: readonly string[]) {
  const clean = (values ?? []).map((v) => v.trim()).filter(Boolean)
  if (clean.length) search.set(key, clean.join(','))
}

/**
 * Строка запроса — только параметры, которые читает контроллер.
 * Пустой список не отправляется: для сервера пустой список — «без фильтра».
 */
export function buildWorkCalendarQuery(params: WorkCalendarParams): string {
  const search = new URLSearchParams()
  search.set('from', params.from)
  search.set('to', params.to)
  search.set('timezone', params.timezone)
  setList(search, 'employeeIds', params.employeeIds)
  setList(search, 'locationIds', params.locationIds)
  setList(search, 'types', params.types)
  setList(search, 'statuses', params.statuses)
  if (params.includeUnscheduled !== undefined) search.set('includeUnscheduled', String(params.includeUnscheduled))
  if (params.linkedClientCompanyId) search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  else if (params.companyId) search.set('companyId', params.companyId)
  return search.toString()
}

// ─── Проверка ответа ────────────────────────────────────────────────────────

export class WorkCalendarContractError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(
      `Ответ GET /work-calendar не совпадает с контрактом: ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? ` (и ещё ${problems.length - 3})` : ''}`,
    )
    this.name = 'WorkCalendarContractError'
    this.problems = problems
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrOrNull = (v: unknown) => v === null || isStr(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isInstant = (v: unknown) => isStr(v) && !Number.isNaN(new Date(v).getTime()) && /T.*(Z|[+-]\d{2}:\d{2})$/.test(v)
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

function checkEvent(e: unknown, at: string, problems: string[]) {
  if (!isObj(e)) return void problems.push(`${at}: не объект`)
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(`${at}.${what}`)
  }
  need(isStr(e.id) && e.id !== '', 'id')
  need((WORK_CALENDAR_EVENT_TYPES as readonly unknown[]).includes(e.type), 'type ∈ TICKET|INSPECTION')
  need(isStr(e.sourceId) && e.sourceId !== '', 'sourceId')
  need(isStr(e.title), 'title')
  need(isStr(e.status), 'status')
  need(e.scheduling === 'SCHEDULED' || e.scheduling === 'UNSCHEDULED', 'scheduling ∈ SCHEDULED|UNSCHEDULED')
  if (e.scheduling === 'SCHEDULED') {
    need(isInstant(e.dueAt), 'dueAt — момент со смещением у SCHEDULED')
    need(isStr(e.localDate) && LOCAL_DATE.test(e.localDate), 'localDate YYYY-MM-DD у SCHEDULED')
  } else if (e.scheduling === 'UNSCHEDULED') {
    need(e.dueAt === null && e.localDate === null, 'dueAt и localDate = null у UNSCHEDULED')
  }
  // Окно времени эта версия интерфейса не показывает. Пришло окно — контракт
  // сменился, и молча нарисовать срок вместо окна было бы неправдой.
  need(e.startAt === null && e.endAt === null && e.hasWindow === false, 'startAt/endAt = null, hasWindow = false')
  need(isStrOrNull(e.employeeId), 'employeeId')
  need(isStr(e.locationId) && e.locationId !== '', 'locationId')
  need(isStr(e.clientCompanyId), 'clientCompanyId')
  if (e.type === 'TICKET') {
    need(isObj(e.ticket) && isNum(e.ticket.ticketNumber), 'ticket.ticketNumber')
  }
  if (e.type === 'INSPECTION') {
    const insp = e.inspection
    need(
      isObj(insp) && isStr(insp.frequency) && isBool(insp.isOverdue) && isStr(insp.overdueAt) && isStrOrNull(insp.lastRunId ?? null),
      'inspection{frequency, isOverdue, overdueAt, lastRunId}',
    )
  }
}

/** Ответ → WorkCalendarResponse или WorkCalendarContractError со списком расхождений. */
export function parseWorkCalendarResponse(raw: unknown): WorkCalendarResponse {
  const problems: string[] = []
  if (!isObj(raw)) throw new WorkCalendarContractError(['ответ не объект'])
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }

  const range = raw.range
  need(
    isObj(range) && isInstant(range.from) && isInstant(range.to) && isStr(range.timezone) && range.timezone !== '',
    'range{from, to, timezone}',
  )

  const caps = raw.capabilities
  if (!isObj(caps)) problems.push('capabilities')
  else {
    need(caps.readOnly === true, 'capabilities.readOnly = true')
    need(
      isObj(caps.eventTypes) && isBool(caps.eventTypes.TICKET) && isBool(caps.eventTypes.INSPECTION),
      'capabilities.eventTypes{TICKET, INSPECTION}',
    )
    need(isBool(caps.unscheduled), 'capabilities.unscheduled')
    need(caps.timeWindows === false, 'capabilities.timeWindows = false')
    need(isBool(caps.recurrenceProjection), 'capabilities.recurrenceProjection')
    need(isBool(caps.employeeRoster), 'capabilities.employeeRoster')
    need(isBool(caps.restrictedEmpty), 'capabilities.restrictedEmpty')
  }

  const meta = raw.meta
  if (!isObj(meta)) problems.push('meta')
  else {
    need(isBool(meta.truncated), 'meta.truncated')
    need(
      Array.isArray(meta.truncatedSources) &&
        meta.truncatedSources.every((s) => (WORK_CALENDAR_TRUNCATED_SOURCES as readonly unknown[]).includes(s)),
      'meta.truncatedSources ⊆ scheduledTickets|unscheduledTickets|inspections|employees',
    )
    need(isObj(meta.limits) && Object.values(meta.limits).every(isNum), 'meta.limits')
    need(
      isObj(meta.counts) && isNum(meta.counts.scheduledTickets) && isNum(meta.counts.unscheduledTickets) && isNum(meta.counts.inspections),
      'meta.counts{scheduledTickets, unscheduledTickets, inspections}',
    )
    need(
      meta.truncated === (Array.isArray(meta.truncatedSources) && meta.truncatedSources.length > 0),
      'meta.truncated ⇔ непустой truncatedSources',
    )
  }

  const resources = raw.resources
  if (!isObj(resources) || !Array.isArray(resources.employees) || !Array.isArray(resources.locations)) {
    problems.push('resources{employees[], locations[]}')
  } else {
    resources.employees.forEach((emp, i) => {
      if (!isObj(emp) || !isStr(emp.id) || !isStr(emp.displayName) || !isBool(emp.isOwnCompany)) {
        problems.push(`resources.employees[${i}]{id, displayName, isOwnCompany}`)
      }
    })
    resources.locations.forEach((loc, i) => {
      if (!isObj(loc) || !isStr(loc.id) || !isStr(loc.name) || !isStrOrNull(loc.city) || !isStrOrNull(loc.address)) {
        problems.push(`resources.locations[${i}]{id, name, city, address}`)
      }
    })
  }

  if (!Array.isArray(raw.events)) problems.push('events[]')
  else raw.events.forEach((e, i) => checkEvent(e, `events[${i}]`, problems))

  if (problems.length) throw new WorkCalendarContractError(problems)
  return raw as unknown as WorkCalendarResponse
}

/**
 * Пояс ответа должен совпасть с запрошенным: дни сетки считаются в поясе
 * браузера, а localDate — в поясе ответа. Разойдись они — события молча
 * легли бы в соседние сутки.
 */
export function assertResponseMatchesRequest(response: WorkCalendarResponse, params: WorkCalendarParams, expectedFromIso: string) {
  const problems: string[] = []
  if (response.range.timezone !== params.timezone) {
    problems.push(`range.timezone ${response.range.timezone} ≠ запрошенному ${params.timezone}`)
  }
  if (new Date(response.range.from).getTime() !== new Date(expectedFromIso).getTime()) {
    problems.push(`range.from ${response.range.from} ≠ полуночи ${params.from}`)
  }
  if (problems.length) throw new WorkCalendarContractError(problems)
}

export async function getWorkCalendar(params: WorkCalendarParams, expectedFromIso: string): Promise<WorkCalendarResponse> {
  const raw = await request<unknown>(`/work-calendar?${buildWorkCalendarQuery(params)}`)
  const response = parseWorkCalendarResponse(raw)
  assertResponseMatchesRequest(response, params, expectedFromIso)
  return response
}
