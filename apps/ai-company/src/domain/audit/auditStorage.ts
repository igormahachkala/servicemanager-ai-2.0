import { DEFAULT_COMPANY_ID } from '../company/company'
import { emitNotificationFromAudit } from '../notifications/notificationStorage'
import {
  AUDIT_ACTIONS,
  AUDIT_ACTOR_TYPES,
  AUDIT_TARGET_TYPES,
} from './auditTypes'
import type { AuditAction, AuditActorType, AuditTargetType } from './auditTypes'
import type { AuditEvent, AuditFilter, AuditMetadata } from './auditEvent'

const STORAGE_KEY = 'ai-company-audit-events'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseActorType(value: unknown): AuditActorType | null {
  return typeof value === 'string' && (AUDIT_ACTOR_TYPES as readonly string[]).includes(value)
    ? (value as AuditActorType)
    : null
}

function parseAction(value: unknown): AuditAction | null {
  return typeof value === 'string' && (AUDIT_ACTIONS as readonly string[]).includes(value)
    ? (value as AuditAction)
    : null
}

function parseTargetType(value: unknown): AuditTargetType | null {
  return typeof value === 'string' && (AUDIT_TARGET_TYPES as readonly string[]).includes(value)
    ? (value as AuditTargetType)
    : null
}

function parseMetadata(value: unknown): AuditMetadata {
  if (!isRecord(value)) return {}
  const result: AuditMetadata = {}
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

function parseAuditEvent(value: unknown): AuditEvent | null {
  if (!isRecord(value)) return null
  const actorType = parseActorType(value.actorType)
  const action = parseAction(value.action)
  const targetType = parseTargetType(value.targetType)
  if (
    !actorType ||
    !action ||
    !targetType ||
    typeof value.id !== 'string' ||
    typeof value.actorId !== 'string' ||
    typeof value.targetId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    companyId: typeof value.companyId === 'string' ? value.companyId : '',
    actorType,
    actorId: value.actorId,
    action,
    targetType,
    targetId: value.targetId,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    metadata: parseMetadata(value.metadata),
    createdAt: value.createdAt,
  }
}

export function loadAuditEvents(): AuditEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseAuditEvent)
      .filter((item): item is AuditEvent => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveAuditEvents(events: AuditEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    /* noop */
  }
}

export function appendAuditEvent(
  event: Omit<AuditEvent, 'id' | 'createdAt' | 'companyId'> & {
    id?: string
    createdAt?: string
    companyId?: string
  },
): AuditEvent {
  const created: AuditEvent = {
    id: event.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    companyId: event.companyId ?? DEFAULT_COMPANY_ID,
    actorType: event.actorType,
    actorId: event.actorId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    workspaceId: event.workspaceId ?? null,
    metadata: event.metadata ?? {},
    createdAt: event.createdAt ?? new Date().toISOString(),
  }
  saveAuditEvents([created, ...loadAuditEvents()])
  emitNotificationFromAudit({
    id: created.id,
    action: created.action,
    targetType: created.targetType,
    targetId: created.targetId,
    actorId: created.actorId,
    workspaceId: created.workspaceId,
    metadata: created.metadata,
    createdAt: created.createdAt,
  })
  return created
}

export function filterAuditEvents(events: AuditEvent[], filter: AuditFilter): AuditEvent[] {
  return events.filter((event) => {
    if (filter.companyId && filter.companyId !== 'all' && event.companyId !== filter.companyId) {
      return false
    }
    if (filter.actorType && filter.actorType !== 'all' && event.actorType !== filter.actorType) {
      return false
    }
    if (filter.action && filter.action !== 'all' && event.action !== filter.action) return false
    if (filter.targetType && filter.targetType !== 'all' && event.targetType !== filter.targetType) {
      return false
    }
    if (filter.workspaceId && filter.workspaceId !== 'all') {
      if (filter.workspaceId === 'none' && event.workspaceId !== null) return false
      if (filter.workspaceId !== 'none' && event.workspaceId !== filter.workspaceId) return false
    }
    return true
  })
}

export function searchAuditEvents(events: AuditEvent[], query: string): AuditEvent[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return events
  return events.filter((event) => {
    const haystack = [
      event.actorType,
      event.actorId,
      event.action,
      event.targetType,
      event.targetId,
      event.workspaceId ?? '',
      JSON.stringify(event.metadata),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

export function ensureSeedAuditEvents(): void {
  if (loadAuditEvents().length > 0) return

  const seeds: AuditEvent[] = [
    {
      id: 'audit-001',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'employee',
      actorId: 'ag-cto',
      action: 'review',
      targetType: 'report',
      targetId: 'report-arch-v1',
      workspaceId: null,
      metadata: { outcome: 'approved', notes: 'Architecture boundaries confirmed' },
      createdAt: hoursAgo(96),
    },
    {
      id: 'audit-002',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'owner',
      actorId: 'owner',
      action: 'create',
      targetType: 'workspace',
      targetId: 'workspace-seed',
      workspaceId: null,
      metadata: { name: 'ServiceManager V1' },
      createdAt: hoursAgo(72),
    },
    {
      id: 'audit-003',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'employee',
      actorId: 'ag-max',
      action: 'assign',
      targetType: 'assignment',
      targetId: 'assignment-seed-1',
      workspaceId: null,
      metadata: { role: 'Lead Developer', loadPercent: 50 },
      createdAt: hoursAgo(48),
    },
    {
      id: 'audit-004',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'employee',
      actorId: 'ag-cto',
      action: 'invoke',
      targetType: 'tool',
      targetId: 'tool-github',
      workspaceId: null,
      metadata: { capability: 'review', mock: true },
      createdAt: hoursAgo(36),
    },
    {
      id: 'audit-005',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'system',
      actorId: 'platform',
      action: 'publish',
      targetType: 'report',
      targetId: 'report-qa-build',
      workspaceId: null,
      metadata: { trigger: 'build-success' },
      createdAt: hoursAgo(24),
    },
    {
      id: 'audit-006',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'employee',
      actorId: 'ag-qa',
      action: 'configure',
      targetType: 'permission',
      targetId: 'perm-github-read',
      workspaceId: null,
      metadata: { integration: 'github', level: 'read' },
      createdAt: hoursAgo(18),
    },
    {
      id: 'audit-007',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'owner',
      actorId: 'owner',
      action: 'approve',
      targetType: 'discussion',
      targetId: 'discussion-seed',
      workspaceId: null,
      metadata: { decision: 'proceed-v1' },
      createdAt: hoursAgo(12),
    },
    {
      id: 'audit-008',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'employee',
      actorId: 'ag-cto',
      action: 'create',
      targetType: 'memory',
      targetId: 'memory-seed-ag-cto-0',
      workspaceId: null,
      metadata: { type: 'decision', importance: 'critical' },
      createdAt: hoursAgo(6),
    },
    {
      id: 'audit-009',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'system',
      actorId: 'platform',
      action: 'create',
      targetType: 'report',
      targetId: 'report-system-foundation',
      workspaceId: null,
      metadata: { version: 'V1', module: 'reports-audit' },
      createdAt: hoursAgo(1),
    },
    {
      id: 'audit-010',
      companyId: DEFAULT_COMPANY_ID,
      actorType: 'owner',
      actorId: 'owner',
      action: 'review',
      targetType: 'system',
      targetId: 'audit-foundation',
      workspaceId: null,
      metadata: { principle: 'audit-everything' },
      createdAt: hoursAgo(0),
    },
  ]

  saveAuditEvents(seeds)
}

export type { AuditEvent, AuditFilter, AuditMetadata } from './auditEvent'
export type { AuditAction, AuditActorType, AuditTargetType } from './auditTypes'
export { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES, AUDIT_TARGET_TYPES } from './auditTypes'
