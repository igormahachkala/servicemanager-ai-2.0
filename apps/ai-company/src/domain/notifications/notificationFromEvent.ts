import type { CompanyEvent } from '../events/event'
import type { EventSourceType } from '../events/eventSource'
import type { Notification, NotificationAction, NotificationCategory } from './notification'

function metaString(metadata: CompanyEvent['metadata'], key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}

function resolveCategory(event: CompanyEvent): NotificationCategory {
  const { type, sourceType } = event

  if (type.startsWith('approval.')) return 'approval'
  if (type.startsWith('tool.')) return 'runtime'
  if (type.startsWith('runtime.') || type.startsWith('run.')) return 'runtime'
  if (type.startsWith('report.')) return 'report'
  if (type.startsWith('chat.')) return 'chat'
  if (type.startsWith('collaboration.')) return 'discussion'
  if (type.startsWith('handoff.')) return 'task'
  if (type.startsWith('task_result.')) return 'task'
  if (type.startsWith('conversation.')) return 'discussion'
  if (type.startsWith('knowledge.')) return 'knowledge'
  if (type.startsWith('task.')) return 'task'
  if (type.startsWith('employee.')) return 'employee'
  if (type.startsWith('workspace.')) return 'project'

  return mapSourceToCategory(sourceType)
}

function mapSourceToCategory(sourceType: EventSourceType): NotificationCategory {
  switch (sourceType) {
    case 'approval':
      return 'approval'
    case 'runtime':
    case 'run':
      return 'runtime'
    case 'report':
      return 'report'
    case 'chat':
      return 'chat'
    case 'conversation':
    case 'collaboration':
      return 'discussion'
    case 'handoff':
    case 'task_result':
      return 'task'
    case 'knowledge':
    case 'memory':
      return 'knowledge'
    case 'task':
      return 'task'
    case 'employee':
      return 'employee'
    default:
      return 'system'
  }
}

function resolveTitle(event: CompanyEvent, category: NotificationCategory): string {
  const subject = metaString(event.metadata, 'subject')
  const title = metaString(event.metadata, 'title')
  const preview = metaString(event.metadata, 'preview')
  const name = metaString(event.metadata, 'name')
  const codename = metaString(event.metadata, 'codename')

  if (subject) return subject
  if (title) return title
  if (preview) return preview
  if (name) return name
  if (codename) return `${codename} · ${event.type}`

  return `${categoryLabel(category)} · ${event.type}`
}

function categoryLabel(category: NotificationCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function resolveSummary(event: CompanyEvent): string {
  const message = metaString(event.metadata, 'message')
  if (message) return message

  const parts: string[] = []
  const preview = metaString(event.metadata, 'preview')
  const role = metaString(event.metadata, 'role')
  const integration = metaString(event.metadata, 'integration')
  const note = metaString(event.metadata, 'note')

  if (preview) parts.push(preview)
  if (role) parts.push(`Role: ${role}`)
  if (integration) parts.push(integration)
  if (note) parts.push(note)

  if (parts.length > 0) return parts.join(' · ')
  return `${event.sourceType} · ${event.sourceId}`
}

function resolveAction(event: CompanyEvent, category: NotificationCategory): NotificationAction | null {
  const { sourceId } = event

  switch (category) {
    case 'approval':
      return { href: `/ops/approvals/${encodeURIComponent(sourceId)}` }
    case 'report':
      return event.reportId
        ? { href: `/ops/reports/${encodeURIComponent(event.reportId)}` }
        : { href: '/ops/reports' }
    case 'runtime':
      if (event.type.startsWith('tool.')) {
        return { href: `/ops/tool-executions?focus=${encodeURIComponent(sourceId)}` }
      }
      return { href: `/ops/runtime/runs/${encodeURIComponent(sourceId)}` }
    case 'chat':
      return { href: `/ops/chats/${encodeURIComponent(sourceId)}` }
    case 'discussion':
      if (event.type.startsWith('collaboration.')) {
        return { href: `/ops/collaboration/${encodeURIComponent(sourceId)}` }
      }
      return { href: `/ops/chats/${encodeURIComponent(sourceId)}` }
    case 'employee':
      return event.employeeId
        ? { href: `/ops/employees/${encodeURIComponent(event.employeeId)}` }
        : null
    case 'task':
      if (event.type.startsWith('handoff.')) {
        return { href: `/ops/handoffs/${encodeURIComponent(sourceId)}` }
      }
      if (event.type.startsWith('task_result.')) {
        return { href: `/ops/task-results/${encodeURIComponent(sourceId)}` }
      }
      return { href: '/ops/tasks' }
    case 'knowledge':
      return { href: `/ops/knowledge/${encodeURIComponent(sourceId)}` }
    case 'project':
      return event.workspaceId
        ? { href: `/ops/workspaces/${encodeURIComponent(event.workspaceId)}` }
        : { href: '/ops/projects' }
    case 'audit':
      return { href: '/ops/audit' }
    default:
      return { href: '/ops/timeline' }
  }
}

function resolveProjectId(event: CompanyEvent): string | null {
  const projectId = metaString(event.metadata, 'projectId')
  return projectId
}

export function notificationFromEvent(event: CompanyEvent): Notification {
  const category = resolveCategory(event)

  return {
    id: `notif-${event.id}`,
    type: category,
    severity: event.severity,
    employeeId: event.employeeId,
    projectId: resolveProjectId(event),
    workspaceId: event.workspaceId,
    title: resolveTitle(event, category),
    summary: resolveSummary(event),
    action: resolveAction(event, category),
    read: false,
    createdAt: event.createdAt,
    eventId: event.id,
  }
}

export function notificationFromAudit(input: {
  id: string
  action: string
  targetType: string
  targetId: string
  actorId: string
  workspaceId: string | null
  metadata: Record<string, string | number | boolean | null>
  createdAt: string
}): Notification {
  const title =
    typeof input.metadata.title === 'string'
      ? input.metadata.title
      : `${input.action} · ${input.targetType}`

  const summary =
    typeof input.metadata.notes === 'string'
      ? input.metadata.notes
      : `${input.actorId} → ${input.targetType}:${input.targetId}`

  let href = '/ops/audit'
  if (input.targetType === 'report') {
    href = `/ops/reports/${encodeURIComponent(input.targetId)}`
  } else if (input.targetType === 'approval') {
    href = `/ops/approvals/${encodeURIComponent(input.targetId)}`
  } else if (input.targetType === 'workspace') {
    href = `/ops/workspaces/${encodeURIComponent(input.targetId)}`
  }

  const severity =
    input.action === 'reject' ? 'warn' : input.action === 'approve' ? 'success' : 'info'

  return {
    id: `notif-audit-${input.id}`,
    type: 'audit',
    severity,
    employeeId: input.actorId.startsWith('ag-') ? input.actorId : null,
    projectId: null,
    workspaceId: input.workspaceId,
    title,
    summary,
    action: { href },
    read: false,
    createdAt: input.createdAt,
    eventId: null,
  }
}