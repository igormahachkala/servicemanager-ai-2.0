/**
 * SMA-WORK-CALENDAR-V1 — клиент GET /work-calendar.
 *
 * Контракт — backend PR #453, коммит 4ba0e242 (version 1):
 * work-calendar.controller.ts (параметры), work-calendar.service.ts (ответ),
 * work-calendar-events.ts (события и resources). Эталон ответа —
 * backend/src/work-calendar/__fixtures__/work-calendar.response.v1.json,
 * его копия лежит в web/src/lib/__fixtures__.
 *
 * Календарь только читает: других вызовов у модуля нет.
 *
 * Ответ проверяется строго. Несовместимый ответ — ошибка с перечнем
 * расхождений, а не подстановка значений по умолчанию: иначе сменившийся
 * контракт выглядел бы как «работ нет» или «источник недоступен».
 * Лишние поля допускаются — их добавление контракт не ломает.
 */
import { request } from './api'

export const WORK_CALENDAR_VERSION = 1

export const WORK_CALENDAR_EVENT_KINDS = ['TICKET', 'INSPECTION'] as const
export type WorkCalendarEventKind = (typeof WORK_CALENDAR_EVENT_KINDS)[number]

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
export const WORK_CALENDAR_INSPECTION_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'OVERDUE'] as const
/** Сервер возвращает их только при includeCompleted=true — даже если они явно указаны в statuses. */
export const WORK_CALENDAR_COMPLETED_STATUSES = ['DONE', 'CANCELED'] as const

export const WORK_CALENDAR_TRUNCATED_SOURCES = ['scheduledTickets', 'unscheduledTickets', 'inspections', 'employees', 'locations'] as const
export type WorkCalendarTruncatedSource = (typeof WORK_CALENDAR_TRUNCATED_SOURCES)[number]

export type WorkCalendarTiming = {
  mode: 'DUE' | 'UNSCHEDULED'
  /** Плановый срок (Ticket.plannedDueAt / InspectionSchedule.nextDueAt). Не время начала. */
  dueAt: string | null
  /** Местные сутки срока в поясе ответа, YYYY-MM-DD. По ним событие ложится на день. */
  localDate: string | null
  startAt: null
  endAt: null
  hasWindow: false
}

export type WorkCalendarRecurrence = {
  frequency: string
  intervalDays: number | null
  nextDueAt: string
  overdueAt: string
  isOverdue: boolean
  followingDueAt: string | null
}

export type WorkCalendarEvent = {
  id: string
  kind: WorkCalendarEventKind
  source: 'TICKET' | 'INSPECTION_SCHEDULE'
  /** id заявки или плана обхода. */
  entityId: string
  ticketId: string | null
  scheduleId: string | null
  /** Владелец записи: компания заявки либо компания, составившая план. */
  companyId: string
  clientCompanyId: string
  locationId: string
  employeeId: string | null
  title: string
  status: string
  timing: WorkCalendarTiming
  recurrence: WorkCalendarRecurrence | null
  ticket: {
    ticketNumber: number
    urgency: string
    priority: string
    slaDueAt: string | null
    parentId: string | null
  } | null
  inspection: {
    templateName: string | null
    lastRunId: string | null
  } | null
}

/**
 * Строка сотрудника. companyId, role, isActive, isExecutor — только у
 * сотрудников компании пользователя; у исполнителя другой компании они null.
 */
export type WorkCalendarEmployee = {
  id: string
  displayName: string
  companyId: string | null
  role: string | null
  isActive: boolean | null
  isExecutor: boolean | null
  isOwnCompany: boolean
  eventCount: number
}

export type WorkCalendarLocation = {
  id: string
  name: string
  city: string | null
  address: string | null
  clientCompanyId: string
  eventCount: number
}

export type WorkCalendarCapabilities = {
  tickets: boolean
  inspections: boolean
  /** Полные справочники: и штат, и объекты, а не только строки по событиям. */
  resources: boolean
  employeeDirectory: boolean
  locationDirectory: boolean
  readOnly: true
  unscheduled: boolean
  timeWindows: false
  recurrenceProjection: boolean
  restrictedEmpty: boolean
}

export type WorkCalendarMeta = {
  /** Сколько событий подходит под запрос во всём периоде, а не в ответе. */
  total: number
  scheduled: number
  unscheduled: number
  truncated: boolean
  /** false — total нижняя граница. */
  totalIsExact: boolean
  /** Сколько событий в этом ответе. */
  returned: { total: number; scheduled: number; unscheduled: number }
  truncatedSources: WorkCalendarTruncatedSource[]
  limits: Record<string, number>
  generatedAt: string
}

export type WorkCalendarResponse = {
  version: typeof WORK_CALENDAR_VERSION
  range: { from: string; to: string; timezone: string }
  capabilities: WorkCalendarCapabilities
  resources: { employees: WorkCalendarEmployee[]; locations: WorkCalendarLocation[] }
  events: WorkCalendarEvent[]
  meta: WorkCalendarMeta
}

export type WorkCalendarAssigned = 'all' | 'assigned' | 'unassigned'

export type WorkCalendarParams = {
  /** Первые сутки, YYYY-MM-DD — полночь в поясе timezone. */
  from: string
  /** Сутки после последних, YYYY-MM-DD: диапазон [from, to). */
  to: string
  timezone: string
  employeeIds?: string[]
  locationIds?: string[]
  eventTypes?: WorkCalendarEventKind[]
  statuses?: string[]
  assigned?: WorkCalendarAssigned
  includeUnscheduled?: boolean
  includeCompleted?: boolean
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
  setList(search, 'eventTypes', params.eventTypes)
  setList(search, 'statuses', params.statuses)
  if (params.assigned && params.assigned !== 'all') search.set('assigned', params.assigned)
  if (params.includeUnscheduled !== undefined) search.set('includeUnscheduled', String(params.includeUnscheduled))
  if (params.includeCompleted !== undefined) search.set('includeCompleted', String(params.includeCompleted))
  if (params.linkedClientCompanyId) search.set('linkedClientCompanyId', params.linkedClientCompanyId)
  else if (params.companyId) search.set('companyId', params.companyId)
  return search.toString()
}

// ─── Проверка ответа ────────────────────────────────────────────────────────

export class WorkCalendarContractError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    const head = problems.slice(0, 3).join('; ')
    const more = problems.length > 3 ? ` (и ещё ${problems.length - 3})` : ''
    super(`Ответ GET /work-calendar не совпадает с контрактом: ${head}${more}`)
    this.name = 'WorkCalendarContractError'
    this.problems = problems
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNonEmpty = (v: unknown): v is string => isStr(v) && v !== ''
const isStrOrNull = (v: unknown) => v === null || isStr(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isBoolOrNull = (v: unknown) => v === null || isBool(v)
const isInstant = (v: unknown) => isStr(v) && !Number.isNaN(new Date(v).getTime()) && /T.*(Z|[+-]\d{2}:\d{2})$/.test(v)
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

function checkEvent(e: unknown, at: string, problems: string[]) {
  if (!isObj(e)) return void problems.push(`${at}: не объект`)
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(`${at}.${what}`)
  }
  need(isNonEmpty(e.id), 'id')
  need((WORK_CALENDAR_EVENT_KINDS as readonly unknown[]).includes(e.kind), 'kind ∈ TICKET|INSPECTION')
  need(isNonEmpty(e.entityId), 'entityId')
  need(isStr(e.companyId), 'companyId')
  need(isStr(e.clientCompanyId), 'clientCompanyId')
  need(isNonEmpty(e.locationId), 'locationId')
  need(isStrOrNull(e.employeeId), 'employeeId')
  need(isStr(e.title), 'title')
  need(isStr(e.status), 'status')

  if (e.kind === 'TICKET') {
    need(e.source === 'TICKET', 'source = TICKET у заявки')
    need(e.ticketId === e.entityId && e.scheduleId === null, 'ticketId = entityId, scheduleId = null у заявки')
    need(isObj(e.ticket) && isNum(e.ticket.ticketNumber), 'ticket.ticketNumber')
    need(e.recurrence === null && e.inspection === null, 'recurrence и inspection = null у заявки')
  } else if (e.kind === 'INSPECTION') {
    need(e.source === 'INSPECTION_SCHEDULE', 'source = INSPECTION_SCHEDULE у обхода')
    need(e.scheduleId === e.entityId && e.ticketId === null, 'scheduleId = entityId, ticketId = null у обхода')
    const r = e.recurrence
    need(
      isObj(r) &&
        isStr(r.frequency) &&
        isInstant(r.nextDueAt) &&
        isInstant(r.overdueAt) &&
        isBool(r.isOverdue) &&
        isStrOrNull(r.followingDueAt),
      'recurrence{frequency, nextDueAt, overdueAt, isOverdue, followingDueAt}',
    )
    need(
      isObj(e.inspection) && isStrOrNull(e.inspection.templateName) && isStrOrNull(e.inspection.lastRunId),
      'inspection{templateName, lastRunId}',
    )
    need(e.ticket === null, 'ticket = null у обхода')
  }

  const t = e.timing
  if (!isObj(t)) return void problems.push(`${at}.timing`)
  if (t.mode === 'DUE') {
    need(isInstant(t.dueAt), 'timing.dueAt — момент со смещением у DUE')
    need(isStr(t.localDate) && LOCAL_DATE.test(t.localDate), 'timing.localDate YYYY-MM-DD у DUE')
  } else if (t.mode === 'UNSCHEDULED') {
    need(t.dueAt === null && t.localDate === null, 'timing.dueAt и localDate = null у UNSCHEDULED')
  } else {
    problems.push(`${at}.timing.mode ∈ DUE|UNSCHEDULED`)
  }
  // Окно времени эта версия интерфейса не показывает. Пришло окно — контракт
  // сменился, и молча нарисовать срок вместо окна было бы неправдой.
  need(t.startAt === null && t.endAt === null && t.hasWindow === false, 'timing: startAt/endAt = null, hasWindow = false')
}

function checkEmployee(emp: unknown, at: string, problems: string[]) {
  if (!isObj(emp) || !isNonEmpty(emp.id) || !isStr(emp.displayName) || !isBool(emp.isOwnCompany) || !isNum(emp.eventCount)) {
    return void problems.push(`${at}{id, displayName, isOwnCompany, eventCount}`)
  }
  if (!isStrOrNull(emp.companyId) || !isStrOrNull(emp.role) || !isBoolOrNull(emp.isActive) || !isBoolOrNull(emp.isExecutor)) {
    problems.push(`${at}{companyId, role, isActive, isExecutor}`)
  }
  // Сервер обещает не раскрывать чужой штат. Пришли внутренние поля
  // исполнителя другой компании — это нарушение контракта, а не данные.
  if (!emp.isOwnCompany && (emp.companyId !== null || emp.role !== null || emp.isActive !== null || emp.isExecutor !== null)) {
    problems.push(`${at}: у сотрудника другой компании companyId/role/isActive/isExecutor должны быть null`)
  }
}

/** Ответ → WorkCalendarResponse или WorkCalendarContractError со списком расхождений. */
export function parseWorkCalendarResponse(raw: unknown): WorkCalendarResponse {
  const problems: string[] = []
  if (!isObj(raw)) throw new WorkCalendarContractError(['ответ не объект'])
  const need = (ok: boolean, what: string) => {
    if (!ok) problems.push(what)
  }

  need(raw.version === WORK_CALENDAR_VERSION, `version = ${WORK_CALENDAR_VERSION}`)
  const range = raw.range
  need(isObj(range) && isInstant(range.from) && isInstant(range.to) && isNonEmpty(range.timezone), 'range{from, to, timezone}')

  const caps = raw.capabilities
  if (!isObj(caps)) problems.push('capabilities')
  else {
    const flags = [
      'tickets',
      'inspections',
      'resources',
      'employeeDirectory',
      'locationDirectory',
      'unscheduled',
      'recurrenceProjection',
      'restrictedEmpty',
    ]
    for (const key of flags) need(isBool(caps[key]), `capabilities.${key}`)
    need(caps.readOnly === true, 'capabilities.readOnly = true')
    need(caps.timeWindows === false, 'capabilities.timeWindows = false')
  }

  const meta = raw.meta
  if (!isObj(meta)) problems.push('meta')
  else {
    need(isNum(meta.total) && isNum(meta.scheduled) && isNum(meta.unscheduled), 'meta{total, scheduled, unscheduled}')
    need(isBool(meta.truncated) && isBool(meta.totalIsExact), 'meta{truncated, totalIsExact}')
    const ret = meta.returned
    need(isObj(ret) && isNum(ret.total) && isNum(ret.scheduled) && isNum(ret.unscheduled), 'meta.returned{total, scheduled, unscheduled}')
    const sources = meta.truncatedSources
    need(
      Array.isArray(sources) && sources.every((s) => (WORK_CALENDAR_TRUNCATED_SOURCES as readonly unknown[]).includes(s)),
      'meta.truncatedSources ⊆ scheduledTickets|unscheduledTickets|inspections|employees|locations',
    )
    need(meta.truncated === (Array.isArray(sources) && sources.length > 0), 'meta.truncated ⇔ непустой truncatedSources')
    need(isObj(meta.limits) && Object.values(meta.limits).every(isNum), 'meta.limits')
    need(isStr(meta.generatedAt), 'meta.generatedAt')
    if (isObj(ret) && Array.isArray(raw.events)) need(ret.total === raw.events.length, 'meta.returned.total = числу events')
  }

  const resources = raw.resources
  if (!isObj(resources) || !Array.isArray(resources.employees) || !Array.isArray(resources.locations)) {
    problems.push('resources{employees[], locations[]}')
  } else {
    resources.employees.forEach((emp, i) => checkEmployee(emp, `resources.employees[${i}]`, problems))
    resources.locations.forEach((loc, i) => {
      const ok =
        isObj(loc) &&
        isNonEmpty(loc.id) &&
        isStr(loc.name) &&
        isStrOrNull(loc.city) &&
        isStrOrNull(loc.address) &&
        isStr(loc.clientCompanyId) &&
        isNum(loc.eventCount)
      if (!ok) problems.push(`resources.locations[${i}]{id, name, city, address, clientCompanyId, eventCount}`)
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
