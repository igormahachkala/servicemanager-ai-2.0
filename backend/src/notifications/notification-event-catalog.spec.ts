import {
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import { ROLE_GRANTS } from '../common/permissions-matrix';
import {
  getSystemNotificationDefault,
  isRoleRepresentableForNotificationContour,
  NOTIFICATION_EVENT_KEYS,
  SUPPORTED_NOTIFICATION_EVENTS,
} from './notification-event-catalog';

describe('notification event catalog', () => {
  it('contains exactly the currently supported notification events', () => {
    expect(NOTIFICATION_EVENT_KEYS).toEqual([
      'ticket.created',
      'ticket.assigned',
      'ticket.claimed',
      'ticket.assignment_requested',
      'ticket.comment_added',
      'ticket.attachment_uploaded',
      'ticket.status_changed',
      'ticket.in_progress',
      'ticket.done',
      'ticket.sla_warning',
      'ticket.sla_breached',
      'ticket.awaiting_acceptance',
      'ticket.accepted',
      'ticket.rejected',
    ]);
  });

  it('does not invent mention, round, shift or standalone critical events', () => {
    expect(NOTIFICATION_EVENT_KEYS).not.toContain('ticket.mentioned');
    expect(NOTIFICATION_EVENT_KEYS).not.toContain('round.created');
    expect(NOTIFICATION_EVENT_KEYS).not.toContain('shift.started');
    expect(NOTIFICATION_EVENT_KEYS).not.toContain('ticket.critical');
  });

  it('provides Russian presentation metadata for every event', () => {
    for (const event of SUPPORTED_NOTIFICATION_EVENTS) {
      expect(event.labelRu.trim()).toBeTruthy();
      expect(event.descriptionRu.trim()).toBeTruthy();
      expect(event.defaultSection.trim()).toBeTruthy();
      expect(event.legacyPushPreferenceKey.trim()).toBeTruthy();
    }
  });

  it('defines conservative system defaults per contour', () => {
    expect(
      getSystemNotificationDefault({
        contour: NotificationContour.CLIENT,
        role: UserRole.TERRITORIAL_MANAGER,
        eventType: 'ticket.created',
        channel: NotificationChannel.IN_APP,
      }),
    ).toBe(true);

    expect(
      getSystemNotificationDefault({
        contour: NotificationContour.PRIMARY_PROVIDER,
        role: UserRole.DISPATCHER,
        eventType: 'ticket.sla_warning',
        channel: NotificationChannel.PUSH,
      }),
    ).toBe(true);

    expect(
      getSystemNotificationDefault({
        contour: NotificationContour.SECONDARY_PROVIDER,
        role: UserRole.ADMIN,
        eventType: 'ticket.created',
        channel: NotificationChannel.MAX,
      }),
    ).toBe(false);
  });

  it('represents CLIENT_ADMIN without adding permission grants', () => {
    expect(
      isRoleRepresentableForNotificationContour({
        contour: NotificationContour.CLIENT,
        role: UserRole.CLIENT_ADMIN,
      }),
    ).toBe(true);
    expect(
      ROLE_GRANTS.some((grant) => grant.role === UserRole.CLIENT_ADMIN),
    ).toBe(false);
    expect(
      getSystemNotificationDefault({
        contour: NotificationContour.CLIENT,
        role: UserRole.CLIENT_ADMIN,
        eventType: 'ticket.created',
        channel: NotificationChannel.IN_APP,
      }),
    ).toBe(false);
  });
});
