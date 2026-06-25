export const NOTIFICATION_CATEGORIES = [
  'approval',
  'runtime',
  'project',
  'employee',
  'knowledge',
  'chat',
  'discussion',
  'task',
  'report',
  'audit',
  'system',
] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const NOTIFICATION_SEVERITIES = ['info', 'success', 'warn', 'error'] as const

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]

export type NotificationAction = {
  href: string
  label?: string
}

export type Notification = {
  id: string
  type: NotificationCategory
  severity: NotificationSeverity
  employeeId: string | null
  projectId: string | null
  workspaceId: string | null
  title: string
  summary: string
  action: NotificationAction | null
  read: boolean
  createdAt: string
  eventId: string | null
}

export type NotificationFilter = {
  type?: NotificationCategory | 'all'
  severity?: NotificationSeverity | 'all'
  read?: 'all' | 'read' | 'unread'
}
