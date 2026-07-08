import {
  parseAutonomousSchedulerQueueItem,
  parseAutonomousSchedulerSession,
  type AutonomousSchedulerQueueItem,
  type AutonomousSchedulerSession,
} from './autonomousScheduler'

export const AUTONOMOUS_SCHEDULER_QUEUE_STORAGE_KEY = 'ai-company-autonomous-scheduler-queue'
export const AUTONOMOUS_SCHEDULER_SESSION_STORAGE_KEY = 'ai-company-autonomous-scheduler-sessions'
export const AUTONOMOUS_SCHEDULER_SYNC_EVENT = 'ai-company-autonomous-scheduler-sync'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(AUTONOMOUS_SCHEDULER_SYNC_EVENT))
}

function readArray<T>(key: string, parse: (value: unknown) => T | null): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parse).filter((item): item is T => item !== null)
  } catch {
    return []
  }
}

function writeArray<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(items))
}

export function loadAutonomousSchedulerQueue(): AutonomousSchedulerQueueItem[] {
  return readArray(AUTONOMOUS_SCHEDULER_QUEUE_STORAGE_KEY, parseAutonomousSchedulerQueueItem).sort(
    (a, b) => compareQueueItems(a, b),
  )
}

export function saveAutonomousSchedulerQueue(items: AutonomousSchedulerQueueItem[]): void {
  writeArray(AUTONOMOUS_SCHEDULER_QUEUE_STORAGE_KEY, items)
  emitSync()
}

export function upsertAutonomousSchedulerQueueItem(
  item: AutonomousSchedulerQueueItem,
): AutonomousSchedulerQueueItem {
  const next = [
    item,
    ...loadAutonomousSchedulerQueue().filter((entry) => entry.id !== item.id),
  ]
  saveAutonomousSchedulerQueue(next)
  return item
}

export function getAutonomousSchedulerQueueItemById(
  id: string,
): AutonomousSchedulerQueueItem | null {
  return loadAutonomousSchedulerQueue().find((item) => item.id === id) ?? null
}

export function listAutonomousSchedulerQueueForEmployee(
  employeeId: string,
  options?: { statuses?: AutonomousSchedulerQueueItem['status'][]; sessionId?: string },
): AutonomousSchedulerQueueItem[] {
  return loadAutonomousSchedulerQueue().filter((item) => {
    if (item.employeeId !== employeeId) return false
    if (options?.sessionId && item.sessionId !== options.sessionId) return false
    if (options?.statuses && !options.statuses.includes(item.status)) return false
    return true
  })
}

export function loadAutonomousSchedulerSessions(): AutonomousSchedulerSession[] {
  return readArray(AUTONOMOUS_SCHEDULER_SESSION_STORAGE_KEY, parseAutonomousSchedulerSession).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function saveAutonomousSchedulerSessions(sessions: AutonomousSchedulerSession[]): void {
  writeArray(AUTONOMOUS_SCHEDULER_SESSION_STORAGE_KEY, sessions)
  emitSync()
}

export function upsertAutonomousSchedulerSession(
  session: AutonomousSchedulerSession,
): AutonomousSchedulerSession {
  const next = [
    session,
    ...loadAutonomousSchedulerSessions().filter((entry) => entry.id !== session.id),
  ]
  saveAutonomousSchedulerSessions(next)
  return session
}

export function getAutonomousSchedulerSessionById(id: string): AutonomousSchedulerSession | null {
  return loadAutonomousSchedulerSessions().find((item) => item.id === id) ?? null
}

export function getRunningAutonomousSchedulerSession(
  employeeId: string,
): AutonomousSchedulerSession | null {
  return (
    loadAutonomousSchedulerSessions().find(
      (session) => session.employeeId === employeeId && session.status === 'running',
    ) ?? null
  )
}

function compareQueueItems(
  a: AutonomousSchedulerQueueItem,
  b: AutonomousSchedulerQueueItem,
): number {
  return new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime()
}
