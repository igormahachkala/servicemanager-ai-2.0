export const NOTIFICATION_TICKET_SECTIONS = [
  'overview',
  'comments',
  'attachments',
  'history',
  'actions',
  'acceptance',
] as const

export type NotificationTicketSection = (typeof NOTIFICATION_TICKET_SECTIONS)[number]
export type NotificationSurface = 'desktop' | 'mobile' | 'max'

export type TicketNotificationNavigationTarget = {
  kind: 'ticket'
  ticketId: string
  section: NotificationTicketSection
  linkedClientCompanyId?: string | null
  sourceEventId?: string | null
}

export type NotificationNavigationTarget = TicketNotificationNavigationTarget

export type NotificationNavigationSource = {
  navigationTarget?: unknown
  type?: string | null
  entityType?: string | null
  entityId?: string | null
  linkedClientCompanyId?: string | null
}

export type NotificationNavigationScope = {
  linkedClientCompanyId?: string | null
  companyId?: string | null
}

const SECTION_BY_TYPE: Record<string, NotificationTicketSection> = {
  'ticket.created': 'overview',
  'ticket.assigned': 'actions',
  'ticket.claimed': 'actions',
  'ticket.assignment_requested': 'actions',
  'ticket.status_changed': 'history',
  'ticket.in_progress': 'history',
  'ticket.done': 'history',
  'ticket.awaiting_acceptance': 'acceptance',
  'ticket.accepted': 'history',
  'ticket.rejected': 'history',
  'ticket.comment_added': 'comments',
  'ticket.attachment_uploaded': 'attachments',
  'ticket.sla_warning': 'overview',
  'ticket.sla_breached': 'history',
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function notificationSectionForType(type?: string | null): NotificationTicketSection {
  const normalized = cleanString(type)
  return normalized ? SECTION_BY_TYPE[normalized] ?? 'overview' : 'overview'
}

export function normalizeNotificationNavigationTarget(value: unknown): NotificationNavigationTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const kind = cleanString(raw.kind)
  if (kind !== 'ticket') return null

  const ticketId = cleanString(raw.ticketId)
  if (!ticketId) return null

  const sectionRaw = cleanString(raw.section)
  const section = (NOTIFICATION_TICKET_SECTIONS as readonly string[]).includes(sectionRaw)
    ? (sectionRaw as NotificationTicketSection)
    : 'overview'

  const target: TicketNotificationNavigationTarget = {
    kind: 'ticket',
    ticketId,
    section,
  }

  const linkedClientCompanyId = cleanString(raw.linkedClientCompanyId)
  if (linkedClientCompanyId) target.linkedClientCompanyId = linkedClientCompanyId

  const sourceEventId = cleanString(raw.sourceEventId)
  if (sourceEventId) target.sourceEventId = sourceEventId

  return target
}

export function legacyNotificationNavigationTarget(source: NotificationNavigationSource): NotificationNavigationTarget | null {
  if (cleanString(source.entityType) !== 'Ticket') return null
  const ticketId = cleanString(source.entityId)
  if (!ticketId) return null
  const target: TicketNotificationNavigationTarget = {
    kind: 'ticket',
    ticketId,
    section: notificationSectionForType(source.type),
  }
  const linkedClientCompanyId = cleanString(source.linkedClientCompanyId)
  if (linkedClientCompanyId) target.linkedClientCompanyId = linkedClientCompanyId
  return target
}

export function notificationTargetFromSource(source: NotificationNavigationSource): NotificationNavigationTarget | null {
  return normalizeNotificationNavigationTarget(source.navigationTarget) ?? legacyNotificationNavigationTarget(source)
}

function appendTicketTargetQuery(
  base: string,
  target: TicketNotificationNavigationTarget,
  fallbackScope?: NotificationNavigationScope,
) {
  const url = new URL(base, 'https://servicemanager.local')
  if (target.section && target.section !== 'overview') {
    url.searchParams.set('section', target.section)
  }
  if (target.section === 'comments') {
    url.searchParams.set('tab', 'chat')
  }

  const linkedClientCompanyId = cleanString(target.linkedClientCompanyId) || cleanString(fallbackScope?.linkedClientCompanyId)
  if (linkedClientCompanyId) url.searchParams.set('linkedClientCompanyId', linkedClientCompanyId)

  const companyId = cleanString(fallbackScope?.companyId)
  if (companyId) url.searchParams.set('companyId', companyId)

  if (target.sourceEventId) url.searchParams.set('sourceEventId', target.sourceEventId)

  return `${url.pathname}${url.search}${url.hash}`
}

export function resolveNotificationNavigationTargetPath(
  target: NotificationNavigationTarget | null | undefined,
  surface: NotificationSurface,
  fallbackScope?: NotificationNavigationScope,
): string | null {
  if (!target) return null
  if (target.kind === 'ticket') {
    const root = surface === 'desktop' ? '/tickets' : surface === 'max' ? '/max/tickets' : '/m/tickets'
    return appendTicketTargetQuery(`${root}/${encodeURIComponent(target.ticketId)}`, target, fallbackScope)
  }
  return null
}

export function resolveNotificationSourcePath(
  source: NotificationNavigationSource,
  surface: NotificationSurface,
  fallbackScope?: NotificationNavigationScope,
): string | null {
  return resolveNotificationNavigationTargetPath(notificationTargetFromSource(source), surface, fallbackScope)
}
