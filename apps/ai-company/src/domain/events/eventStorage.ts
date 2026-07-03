import type {
  CompanyEvent,
  EventDateGroup,
  EventFilter,
  EventMetadata,
  EventScope,
  EventSeverity,
} from './event'
import { EVENT_SEVERITIES } from './event'
import { emitNotificationFromEvent } from '../notifications/notificationStorage'
import { EVENT_SOURCE_TYPES, type EventSourceType } from './eventSource'
import { EVENT_TYPES, type EventType } from './eventType'
import { shouldSeedTimelineEvents } from '../runtime/runtimeDataSources'

const STORAGE_KEY = 'ai-company-events'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEventType(value: unknown): EventType | null {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value)
    ? (value as EventType)
    : null
}

function parseSourceType(value: unknown): EventSourceType | null {
  return typeof value === 'string' && (EVENT_SOURCE_TYPES as readonly string[]).includes(value)
    ? (value as EventSourceType)
    : null
}

function parseSeverity(value: unknown): EventSeverity | null {
  return typeof value === 'string' && (EVENT_SEVERITIES as readonly string[]).includes(value)
    ? (value as EventSeverity)
    : null
}

function parseMetadata(value: unknown): EventMetadata {
  if (!isRecord(value)) return {}
  const result: EventMetadata = {}
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean' ||
      item === null
    ) {
      result[key] = item
    }
  }
  return result
}

function parseCompanyEvent(value: unknown): CompanyEvent | null {
  if (!isRecord(value)) return null
  const type = parseEventType(value.type)
  const sourceType = parseSourceType(value.sourceType)
  const severity = parseSeverity(value.severity)
  if (
    !type ||
    !sourceType ||
    !severity ||
    typeof value.id !== 'string' ||
    typeof value.sourceId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    type,
    sourceType,
    sourceId: value.sourceId,
    employeeId: typeof value.employeeId === 'string' ? value.employeeId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    metadata: parseMetadata(value.metadata),
    severity,
    createdAt: value.createdAt,
  }
}

export function loadEvents(): CompanyEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseCompanyEvent)
      .filter((item): item is CompanyEvent => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveEvents(events: CompanyEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    /* noop */
  }
}

export function appendEvent(
  event: Omit<CompanyEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): CompanyEvent {
  const created: CompanyEvent = {
    id: event.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: event.type,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    employeeId: event.employeeId ?? null,
    workspaceId: event.workspaceId ?? null,
    reportId: event.reportId ?? null,
    metadata: event.metadata ?? {},
    severity: event.severity,
    createdAt: event.createdAt ?? new Date().toISOString(),
  }
  saveEvents([created, ...loadEvents()])
  return created
}

/** Public event bus API — future modules emit through this instead of direct coupling. */
export function emitEvent(
  event: Omit<CompanyEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): CompanyEvent {
  const created = appendEvent(event)
  emitNotificationFromEvent(created)
  return created
}

export function filterEvents(events: CompanyEvent[], filter: EventFilter): CompanyEvent[] {
  return events.filter((event) => {
    if (filter.employeeId && filter.employeeId !== 'all' && event.employeeId !== filter.employeeId) {
      return false
    }
    if (filter.workspaceId && filter.workspaceId !== 'all') {
      if (filter.workspaceId === 'none' && event.workspaceId !== null) return false
      if (filter.workspaceId !== 'none' && event.workspaceId !== filter.workspaceId) return false
    }
    if (filter.severity && filter.severity !== 'all' && event.severity !== filter.severity) {
      return false
    }
    if (filter.type && filter.type !== 'all' && event.type !== filter.type) return false
    if (filter.dateFrom) {
      const from = new Date(filter.dateFrom).getTime()
      if (new Date(event.createdAt).getTime() < from) return false
    }
    if (filter.dateTo) {
      const to = new Date(filter.dateTo).getTime()
      if (new Date(event.createdAt).getTime() > to) return false
    }
    return true
  })
}

export function scopeEvents(
  events: CompanyEvent[],
  scope: EventScope,
  scopeId?: string | null,
): CompanyEvent[] {
  if (scope === 'company') return events
  if (scope === 'workspace' && scopeId) {
    return events.filter((event) => event.workspaceId === scopeId)
  }
  if (scope === 'employee' && scopeId) {
    return events.filter((event) => event.employeeId === scopeId)
  }
  return events
}

export function searchEvents(events: CompanyEvent[], query: string): CompanyEvent[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return events
  return events.filter((event) => {
    const haystack = [
      event.type,
      event.sourceType,
      event.sourceId,
      event.employeeId ?? '',
      event.workspaceId ?? '',
      event.reportId ?? '',
      event.severity,
      JSON.stringify(event.metadata),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function groupEventsByDate(
  events: CompanyEvent[],
  locale = 'en',
): EventDateGroup[] {
  const groups = new Map<string, CompanyEvent[]>()
  for (const event of events) {
    const dateKey = event.createdAt.slice(0, 10)
    const bucket = groups.get(dateKey)
    if (bucket) bucket.push(event)
    else groups.set(dateKey, [event])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, bucket]) => ({
      dateKey,
      dateLabel: new Date(`${dateKey}T12:00:00`).toLocaleDateString(locale, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      events: bucket,
    }))
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

export function ensureSeedEvents(): void {
  if (!shouldSeedTimelineEvents()) return

  const seeds: CompanyEvent[] = [
    {
      id: 'evt-001',
      type: 'employee.created',
      sourceType: 'employee',
      sourceId: 'ag-max',
      employeeId: 'ag-max',
      workspaceId: null,
      reportId: null,
      metadata: { codename: 'MAX', role: 'Senior Developer' },
      severity: 'success',
      createdAt: hoursAgo(168),
    },
    {
      id: 'evt-002',
      type: 'workspace.created',
      sourceType: 'workspace',
      sourceId: 'workspace-seed',
      employeeId: null,
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { name: 'ServiceManager V1' },
      severity: 'success',
      createdAt: hoursAgo(144),
    },
    {
      id: 'evt-003',
      type: 'workspace.assigned',
      sourceType: 'workspace',
      sourceId: 'assignment-seed-1',
      employeeId: 'ag-max',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { role: 'Lead Developer', loadPercent: 50 },
      severity: 'info',
      createdAt: hoursAgo(120),
    },
    {
      id: 'evt-004',
      type: 'conversation.started',
      sourceType: 'conversation',
      sourceId: 'conv:ag-cto',
      employeeId: 'ag-cto',
      workspaceId: null,
      reportId: null,
      metadata: { channel: 'direct' },
      severity: 'info',
      createdAt: hoursAgo(96),
    },
    {
      id: 'evt-005',
      type: 'chat.message',
      sourceType: 'chat',
      sourceId: 'msg-seed-001',
      employeeId: 'ag-cto',
      workspaceId: null,
      reportId: null,
      metadata: { preview: 'Review V1 architecture boundaries', direction: 'outbound' },
      severity: 'info',
      createdAt: hoursAgo(90),
    },
    {
      id: 'evt-006',
      type: 'memory.added',
      sourceType: 'memory',
      sourceId: 'memory-seed-ag-cto-0',
      employeeId: 'ag-cto',
      workspaceId: null,
      reportId: null,
      metadata: { type: 'decision', importance: 'critical' },
      severity: 'info',
      createdAt: hoursAgo(72),
    },
    {
      id: 'evt-007',
      type: 'knowledge.updated',
      sourceType: 'knowledge',
      sourceId: 'kb-architecture',
      employeeId: 'ag-cto',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { section: 'domain-model', version: 2 },
      severity: 'info',
      createdAt: hoursAgo(60),
    },
    {
      id: 'evt-008',
      type: 'report.created',
      sourceType: 'report',
      sourceId: 'report-arch-v1',
      employeeId: 'ag-cto',
      workspaceId: null,
      reportId: 'report-arch-v1',
      metadata: { title: 'V1 Architecture Review', status: 'published' },
      severity: 'success',
      createdAt: hoursAgo(48),
    },
    {
      id: 'evt-009',
      type: 'approval.requested',
      sourceType: 'approval',
      sourceId: 'approval-seed-1',
      employeeId: 'ag-cto',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { subject: 'Deploy staging build' },
      severity: 'warn',
      createdAt: hoursAgo(36),
    },
    {
      id: 'evt-010',
      type: 'approval.granted',
      sourceType: 'approval',
      sourceId: 'approval-seed-1',
      employeeId: null,
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { decidedBy: 'owner', decision: 'granted' },
      severity: 'success',
      createdAt: hoursAgo(30),
    },
    {
      id: 'evt-011',
      type: 'approval.rejected',
      sourceType: 'approval',
      sourceId: 'approval-seed-2',
      employeeId: 'ag-qa',
      workspaceId: null,
      reportId: null,
      metadata: { subject: 'Skip regression suite', reason: 'Policy violation' },
      severity: 'warn',
      createdAt: hoursAgo(24),
    },
    {
      id: 'evt-012',
      type: 'tool.connected',
      sourceType: 'tool',
      sourceId: 'tool-github',
      employeeId: 'ag-cto',
      workspaceId: null,
      reportId: null,
      metadata: { integration: 'GitHub', capability: 'review' },
      severity: 'success',
      createdAt: hoursAgo(18),
    },
    {
      id: 'evt-013',
      type: 'task.created',
      sourceType: 'task',
      sourceId: 'TSK-V1-001',
      employeeId: 'ag-max',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { title: 'Implement employee roster V1' },
      severity: 'info',
      createdAt: hoursAgo(12),
    },
    {
      id: 'evt-014',
      type: 'task.completed',
      sourceType: 'task',
      sourceId: 'TSK-V1-001',
      employeeId: 'ag-max',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { outcome: 'done', durationHours: 4 },
      severity: 'success',
      createdAt: hoursAgo(8),
    },
    {
      id: 'evt-015',
      type: 'employee.updated',
      sourceType: 'employee',
      sourceId: 'ag-qa',
      employeeId: 'ag-qa',
      workspaceId: null,
      reportId: null,
      metadata: { field: 'loadPct', from: 40, to: 55 },
      severity: 'info',
      createdAt: hoursAgo(4),
    },
    {
      id: 'evt-016',
      type: 'runtime.started',
      sourceType: 'runtime',
      sourceId: 'runtime-future',
      employeeId: 'ag-cto',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { future: true, note: 'Placeholder — Runtime not connected in V1' },
      severity: 'info',
      createdAt: hoursAgo(2),
    },
    {
      id: 'evt-017',
      type: 'run.completed',
      sourceType: 'run',
      sourceId: 'run-future',
      employeeId: 'ag-max',
      workspaceId: 'workspace-seed',
      reportId: null,
      metadata: { future: true, status: 'succeeded' },
      severity: 'success',
      createdAt: hoursAgo(1),
    },
    {
      id: 'evt-018',
      type: 'report.created',
      sourceType: 'system',
      sourceId: 'event-foundation',
      employeeId: null,
      workspaceId: null,
      reportId: 'report-system-foundation',
      metadata: { module: 'events', principle: 'everything-important-is-an-event' },
      severity: 'info',
      createdAt: hoursAgo(0),
    },
  ]

  saveEvents(seeds)
}

export type {
  CompanyEvent,
  EventDateGroup,
  EventFilter,
  EventMetadata,
  EventScope,
  EventSeverity,
} from './event'
export type { EventSourceType } from './eventSource'
export type { EventType } from './eventType'
export { EVENT_SEVERITIES } from './event'
export { EVENT_SOURCE_TYPES } from './eventSource'
export { EVENT_TYPES, FUTURE_EVENT_TYPES, isFutureEventType } from './eventType'
