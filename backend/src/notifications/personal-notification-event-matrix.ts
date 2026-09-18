import { NotificationContour, UserRole } from '@prisma/client';

import type { NotificationEventKey } from './notification-event-catalog';

const CLIENT_MANAGEMENT_EVENTS = [
  'ticket.created',
  'ticket.assigned',
  'ticket.comment_added',
  'ticket.attachment_uploaded',
  'ticket.in_progress',
  'ticket.done',
  'ticket.sla_warning',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
] as const satisfies readonly NotificationEventKey[];

const CLIENT_USER_EVENTS = [
  'ticket.created',
  'ticket.sla_warning',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
] as const satisfies readonly NotificationEventKey[];

const CLIENT_SLA_EVENTS = [
  'ticket.sla_warning',
  'ticket.sla_breached',
] as const satisfies readonly NotificationEventKey[];

const PROVIDER_ADMIN_EVENTS = [
  'ticket.created',
  'ticket.assigned',
  'ticket.claimed',
  'ticket.assignment_requested',
  'ticket.comment_added',
  'ticket.attachment_uploaded',
  'ticket.status_changed',
  'ticket.sla_warning',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const PROVIDER_MANAGEMENT_EVENTS = [
  'ticket.created',
  'ticket.assigned',
  'ticket.claimed',
  'ticket.assignment_requested',
  'ticket.comment_added',
  'ticket.attachment_uploaded',
  'ticket.status_changed',
  'ticket.sla_warning',
  'ticket.sla_breached',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const PROVIDER_TECHNICIAN_EVENTS = [
  'ticket.created',
  'ticket.assigned',
  'ticket.comment_added',
  'ticket.attachment_uploaded',
  'ticket.status_changed',
  'ticket.sla_warning',
  'ticket.sla_breached',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const PROVIDER_STAFF_EVENTS = [
  'ticket.assignment_requested',
  'ticket.sla_warning',
  'ticket.sla_breached',
] as const satisfies readonly NotificationEventKey[];

const PROVIDER_EVENTS_BY_ROLE: Partial<
  Record<UserRole, readonly NotificationEventKey[]>
> = {
  [UserRole.ADMIN]: PROVIDER_ADMIN_EVENTS,
  [UserRole.MASTER]: PROVIDER_MANAGEMENT_EVENTS,
  [UserRole.DISPATCHER]: PROVIDER_MANAGEMENT_EVENTS,
  [UserRole.TECHNICIAN]: PROVIDER_TECHNICIAN_EVENTS,
  [UserRole.STAFF]: PROVIDER_STAFF_EVENTS,
};

/**
 * Events that current Production delivery may legitimately address to a role.
 * This is visibility for an opt-out control, not a recipient or access resolver.
 */
export const PERSONAL_IN_APP_EVENTS_BY_CONTOUR: Record<
  NotificationContour,
  Partial<Record<UserRole, readonly NotificationEventKey[]>>
> = {
  [NotificationContour.CLIENT]: {
    [UserRole.ADMIN]: CLIENT_MANAGEMENT_EVENTS,
    [UserRole.CLIENT_ADMIN]: CLIENT_SLA_EVENTS,
    [UserRole.NETWORK_DIRECTOR]: CLIENT_MANAGEMENT_EVENTS,
    [UserRole.TERRITORIAL_MANAGER]: CLIENT_MANAGEMENT_EVENTS,
    [UserRole.CLIENT]: CLIENT_USER_EVENTS,
    [UserRole.STAFF]: CLIENT_SLA_EVENTS,
  },
  [NotificationContour.PRIMARY_PROVIDER]: PROVIDER_EVENTS_BY_ROLE,
  [NotificationContour.SECONDARY_PROVIDER]: PROVIDER_EVENTS_BY_ROLE,
};

export function getPersonalInAppEventKeys(params: {
  contour: NotificationContour;
  role: UserRole;
}): readonly NotificationEventKey[] {
  return PERSONAL_IN_APP_EVENTS_BY_CONTOUR[params.contour][params.role] ?? [];
}
