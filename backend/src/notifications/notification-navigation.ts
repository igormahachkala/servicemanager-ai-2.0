export const NOTIFICATION_TICKET_SECTIONS = [
  'overview',
  'comments',
  'attachments',
  'history',
  'actions',
  'acceptance',
] as const;

export type NotificationTicketSection = (typeof NOTIFICATION_TICKET_SECTIONS)[number];

export type TicketNotificationNavigationTarget = {
  kind: 'ticket';
  ticketId: string;
  section: NotificationTicketSection;
  linkedClientCompanyId?: string;
  sourceEventId?: string;
};

export type NotificationNavigationTarget = TicketNotificationNavigationTarget;

const TICKET_SECTION_BY_NOTIFICATION_TYPE: Record<string, NotificationTicketSection> = {
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
};

function nonEmpty(value?: string | null) {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

export function ticketNotificationSectionForType(type?: string | null): NotificationTicketSection {
  const normalized = nonEmpty(type);
  return normalized ? TICKET_SECTION_BY_NOTIFICATION_TYPE[normalized] ?? 'overview' : 'overview';
}

export function buildTicketNotificationNavigationTarget(params: {
  ticketId?: string | null;
  type?: string | null;
  section?: NotificationTicketSection | null;
  linkedClientCompanyId?: string | null;
  sourceEventId?: string | null;
}): TicketNotificationNavigationTarget | null {
  const ticketId = nonEmpty(params.ticketId);
  if (!ticketId) return null;

  const target: TicketNotificationNavigationTarget = {
    kind: 'ticket',
    ticketId,
    section: params.section ?? ticketNotificationSectionForType(params.type),
  };

  const linkedClientCompanyId = nonEmpty(params.linkedClientCompanyId);
  if (linkedClientCompanyId) target.linkedClientCompanyId = linkedClientCompanyId;

  const sourceEventId = nonEmpty(params.sourceEventId);
  if (sourceEventId) target.sourceEventId = sourceEventId;

  return target;
}

export function buildLegacyNotificationNavigationTarget(params: {
  entityType?: string | null;
  entityId?: string | null;
  type?: string | null;
  linkedClientCompanyId?: string | null;
}): NotificationNavigationTarget | null {
  if ((params.entityType || '').trim() !== 'Ticket') return null;
  return buildTicketNotificationNavigationTarget({
    ticketId: params.entityId,
    type: params.type,
    linkedClientCompanyId: params.linkedClientCompanyId,
  });
}
