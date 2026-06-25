export const WORKDAY_EVENT_TYPES = [
  'work_started',
  'work_finished',
  'discussion',
  'approval_wait',
  'review',
  'learning',
  'break',
] as const

export type WorkdayEventType = (typeof WORKDAY_EVENT_TYPES)[number]

export type WorkdayEvent = {
  id: string
  employeeId: string
  type: WorkdayEventType
  label: string
  startedAt: string
  finishedAt: string | null
  currentProjectId: string | null
  currentTaskId: string | null
}

const STORAGE_KEY = 'ai-company-workday-events'
const MAX_EVENTS = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseWorkdayEventType(value: unknown): WorkdayEventType {
  if (typeof value === 'string' && WORKDAY_EVENT_TYPES.includes(value as WorkdayEventType)) {
    return value as WorkdayEventType
  }
  return 'work_started'
}

export function parseWorkdayEvent(value: unknown): WorkdayEvent | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.employeeId !== 'string') return null

  return {
    id: value.id,
    employeeId: value.employeeId,
    type: parseWorkdayEventType(value.type),
    label: typeof value.label === 'string' ? value.label : '',
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    currentProjectId: typeof value.currentProjectId === 'string' ? value.currentProjectId : null,
    currentTaskId: typeof value.currentTaskId === 'string' ? value.currentTaskId : null,
  }
}

export function loadWorkdayEvents(): WorkdayEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseWorkdayEvent).filter((item): item is WorkdayEvent => item !== null)
  } catch {
    return []
  }
}

export function saveWorkdayEvents(events: WorkdayEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)))
  } catch {
    /* noop */
  }
}

export function appendWorkdayEvent(
  input: Omit<WorkdayEvent, 'id' | 'finishedAt'> & { finishedAt?: string | null },
): WorkdayEvent {
  const event: WorkdayEvent = {
    id: `workday-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    finishedAt: input.finishedAt ?? null,
    ...input,
  }
  saveWorkdayEvents([event, ...loadWorkdayEvents()])
  return event
}

export function getWorkdayEventsForEmployee(employeeId: string): WorkdayEvent[] {
  return loadWorkdayEvents().filter((item) => item.employeeId === employeeId)
}

export function getTodayWorkdayEvents(): WorkdayEvent[] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return loadWorkdayEvents().filter((item) => new Date(item.startedAt) >= start)
}

export { STORAGE_KEY as WORKDAY_STORAGE_KEY }
