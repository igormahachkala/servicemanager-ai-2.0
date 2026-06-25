import { ensureSeedEvents, loadEvents } from '../events/eventStorage'
import { ensureSeedAuditEvents, loadAuditEvents } from '../audit/auditStorage'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SEVERITIES,
  type Notification,
  type NotificationCategory,
  type NotificationFilter,
  type NotificationSeverity,
} from './notification'
import { notificationFromAudit, notificationFromEvent } from './notificationFromEvent'

const STORAGE_KEY = 'ai-company-notifications'
const CHANGE_EVENT = 'ai-company-notifications-change'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseCategory(value: unknown): NotificationCategory | null {
  return typeof value === 'string' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value)
    ? (value as NotificationCategory)
    : null
}

function parseSeverity(value: unknown): NotificationSeverity | null {
  return typeof value === 'string' && (NOTIFICATION_SEVERITIES as readonly string[]).includes(value)
    ? (value as NotificationSeverity)
    : null
}

function parseNotification(value: unknown): Notification | null {
  if (!isRecord(value)) return null
  const type = parseCategory(value.type)
  const severity = parseSeverity(value.severity)
  if (
    !type ||
    !severity ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.read !== 'boolean'
  ) {
    return null
  }

  let action: Notification['action'] = null
  if (isRecord(value.action) && typeof value.action.href === 'string') {
    action = {
      href: value.action.href,
      label: typeof value.action.label === 'string' ? value.action.label : undefined,
    }
  }

  return {
    id: value.id,
    type,
    severity,
    employeeId: typeof value.employeeId === 'string' ? value.employeeId : null,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    title: value.title,
    summary: value.summary,
    action,
    read: value.read,
    createdAt: value.createdAt,
    eventId: typeof value.eventId === 'string' ? value.eventId : null,
  }
}

function notifyChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseNotification)
      .filter((item): item is Notification => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveNotifications(notifications: Notification[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
    notifyChange()
  } catch {
    /* noop */
  }
}

export function getUnreadCount(): number {
  return loadNotifications().filter((item) => !item.read).length
}

export function emitNotification(
  input: Omit<Notification, 'id' | 'read' | 'createdAt'> & {
    id?: string
    read?: boolean
    createdAt?: string
  },
): Notification {
  const items = loadNotifications()
  const eventId = input.eventId ?? null
  if (eventId && items.some((item) => item.eventId === eventId)) {
    return items.find((item) => item.eventId === eventId)!
  }

  const created: Notification = {
    id: input.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: input.type,
    severity: input.severity,
    employeeId: input.employeeId ?? null,
    projectId: input.projectId ?? null,
    workspaceId: input.workspaceId ?? null,
    title: input.title,
    summary: input.summary,
    action: input.action ?? null,
    read: input.read ?? false,
    createdAt: input.createdAt ?? new Date().toISOString(),
    eventId,
  }

  saveNotifications([created, ...items])
  return created
}

export function emitNotificationFromEvent(event: Parameters<typeof notificationFromEvent>[0]): Notification {
  return emitNotification(notificationFromEvent(event))
}

export function emitNotificationFromAudit(
  audit: Parameters<typeof notificationFromAudit>[0],
): Notification {
  const items = loadNotifications()
  const id = `notif-audit-${audit.id}`
  if (items.some((item) => item.id === id)) {
    return items.find((item) => item.id === id)!
  }
  return emitNotification(notificationFromAudit(audit))
}

export function markNotificationRead(id: string): Notification | null {
  const items = loadNotifications()
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return null
  const updated = { ...items[index], read: true }
  const next = [...items]
  next[index] = updated
  saveNotifications(next)
  return updated
}

export function markAllNotificationsRead(): void {
  saveNotifications(loadNotifications().map((item) => ({ ...item, read: true })))
}

export function filterNotifications(
  notifications: Notification[],
  filter: NotificationFilter,
): Notification[] {
  return notifications.filter((item) => {
    if (filter.type && filter.type !== 'all' && item.type !== filter.type) return false
    if (filter.severity && filter.severity !== 'all' && item.severity !== filter.severity) {
      return false
    }
    if (filter.read === 'read' && !item.read) return false
    if (filter.read === 'unread' && item.read) return false
    return true
  })
}

export function searchNotifications(notifications: Notification[], query: string): Notification[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return notifications
  return notifications.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      item.type,
      item.severity,
      item.employeeId ?? '',
      item.workspaceId ?? '',
      item.projectId ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })
}

export function ensureSeedNotifications(): void {
  if (loadNotifications().length > 0) return
  ensureSeedEvents()
  ensureSeedAuditEvents()

  const fromEvents = loadEvents().map((event) => notificationFromEvent(event))
  const fromAudit = loadAuditEvents().map((audit) =>
    notificationFromAudit({
      id: audit.id,
      action: audit.action,
      targetType: audit.targetType,
      targetId: audit.targetId,
      actorId: audit.actorId,
      workspaceId: audit.workspaceId,
      metadata: audit.metadata,
      createdAt: audit.createdAt,
    }),
  )

  saveNotifications([...fromEvents, ...fromAudit])
}

export { CHANGE_EVENT, STORAGE_KEY }

export type { Notification, NotificationAction, NotificationCategory, NotificationFilter, NotificationSeverity } from './notification'
export { NOTIFICATION_CATEGORIES, NOTIFICATION_SEVERITIES } from './notification'
