export const PRESENCE_STATUSES = [
  'offline',
  'available',
  'busy',
  'in_discussion',
  'working',
  'waiting_approval',
  'reviewing',
  'learning',
  'break',
] as const

export type PresenceStatus = (typeof PRESENCE_STATUSES)[number]

export type EmployeePresence = {
  employeeId: string
  status: PresenceStatus
  currentProjectId: string | null
  currentWorkspaceId: string | null
  currentTaskId: string | null
  currentRunId: string | null
  activity: string
  startedAt: string
  expectedFinish: string | null
  updatedAt: string
}

export type UpsertPresenceInput = {
  employeeId: string
  status: PresenceStatus
  currentProjectId?: string | null
  currentWorkspaceId?: string | null
  currentTaskId?: string | null
  currentRunId?: string | null
  activity: string
  startedAt?: string
  expectedFinish?: string | null
}

const STORAGE_KEY = 'ai-company-presence'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePresenceStatus(value: unknown): PresenceStatus {
  if (typeof value === 'string' && PRESENCE_STATUSES.includes(value as PresenceStatus)) {
    return value as PresenceStatus
  }
  return 'offline'
}

export function parseEmployeePresence(value: unknown): EmployeePresence | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string') return null

  const startedAt = typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString()
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : startedAt

  return {
    employeeId: value.employeeId,
    status: parsePresenceStatus(value.status),
    currentProjectId: typeof value.currentProjectId === 'string' ? value.currentProjectId : null,
    currentWorkspaceId: typeof value.currentWorkspaceId === 'string' ? value.currentWorkspaceId : null,
    currentTaskId: typeof value.currentTaskId === 'string' ? value.currentTaskId : null,
    currentRunId: typeof value.currentRunId === 'string' ? value.currentRunId : null,
    activity: typeof value.activity === 'string' ? value.activity : '',
    startedAt,
    expectedFinish: typeof value.expectedFinish === 'string' ? value.expectedFinish : null,
    updatedAt,
  }
}

export function loadPresenceRecords(): EmployeePresence[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseEmployeePresence).filter((item): item is EmployeePresence => item !== null)
  } catch {
    return []
  }
}

export function savePresenceRecords(records: EmployeePresence[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* noop */
  }
}

export function getPresenceByEmployeeId(employeeId: string): EmployeePresence | null {
  return loadPresenceRecords().find((item) => item.employeeId === employeeId) ?? null
}

export function upsertPresence(input: UpsertPresenceInput): EmployeePresence {
  const records = loadPresenceRecords()
  const now = new Date().toISOString()
  const index = records.findIndex((item) => item.employeeId === input.employeeId)
  const previous = index >= 0 ? records[index] : null

  const next: EmployeePresence = {
    employeeId: input.employeeId,
    status: input.status,
    currentProjectId: input.currentProjectId ?? null,
    currentWorkspaceId: input.currentWorkspaceId ?? null,
    currentTaskId: input.currentTaskId ?? null,
    currentRunId: input.currentRunId ?? null,
    activity: input.activity,
    startedAt: input.startedAt ?? previous?.startedAt ?? now,
    expectedFinish: input.expectedFinish ?? null,
    updatedAt: now,
  }

  if (previous && previous.status !== next.status) {
    next.startedAt = now
  }

  const updated = [...records]
  if (index >= 0) {
    updated[index] = next
  } else {
    updated.push(next)
  }
  savePresenceRecords(updated)
  return next
}

export { STORAGE_KEY as PRESENCE_STORAGE_KEY }
