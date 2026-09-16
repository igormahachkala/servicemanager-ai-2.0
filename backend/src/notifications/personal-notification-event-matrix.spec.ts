import { NotificationContour, UserRole } from '@prisma/client';

import { getPersonalInAppEventKeys } from './personal-notification-event-matrix';

describe('117O factual personal IN_APP visibility matrix', () => {
  const cases: Array<[NotificationContour, UserRole, string[]]> = [
    [
      NotificationContour.CLIENT,
      UserRole.ADMIN,
      [
        'ticket.created',
        'ticket.assigned',
        'ticket.comment_added',
        'ticket.attachment_uploaded',
        'ticket.in_progress',
        'ticket.done',
        'ticket.sla_warning',
        'ticket.sla_breached',
        'ticket.awaiting_acceptance',
      ],
    ],
    [
      NotificationContour.CLIENT,
      UserRole.NETWORK_DIRECTOR,
      [
        'ticket.created',
        'ticket.assigned',
        'ticket.comment_added',
        'ticket.attachment_uploaded',
        'ticket.in_progress',
        'ticket.done',
        'ticket.sla_warning',
        'ticket.sla_breached',
        'ticket.awaiting_acceptance',
      ],
    ],
    [
      NotificationContour.CLIENT,
      UserRole.TERRITORIAL_MANAGER,
      [
        'ticket.created',
        'ticket.assigned',
        'ticket.comment_added',
        'ticket.attachment_uploaded',
        'ticket.in_progress',
        'ticket.done',
        'ticket.sla_warning',
        'ticket.sla_breached',
        'ticket.awaiting_acceptance',
      ],
    ],
    [
      NotificationContour.CLIENT,
      UserRole.CLIENT,
      [
        'ticket.created',
        'ticket.sla_warning',
        'ticket.sla_breached',
        'ticket.awaiting_acceptance',
      ],
    ],
    [
      NotificationContour.CLIENT,
      UserRole.CLIENT_ADMIN,
      ['ticket.sla_warning', 'ticket.sla_breached'],
    ],
    [
      NotificationContour.CLIENT,
      UserRole.STAFF,
      ['ticket.sla_warning', 'ticket.sla_breached'],
    ],
  ];

  it.each(cases)(
    '%s %s exposes only observed event delivery',
    (contour, role, expected) => {
      expect(getPersonalInAppEventKeys({ contour, role })).toEqual(expected);
    },
  );

  it.each([
    NotificationContour.PRIMARY_PROVIDER,
    NotificationContour.SECONDARY_PROVIDER,
  ])('%s provider role matrix is factual', (contour) => {
    expect(
      getPersonalInAppEventKeys({ contour, role: UserRole.ADMIN }),
    ).toEqual([
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
    ]);
    expect(
      getPersonalInAppEventKeys({ contour, role: UserRole.MASTER }),
    ).not.toContain('ticket.awaiting_acceptance');
    expect(
      getPersonalInAppEventKeys({ contour, role: UserRole.DISPATCHER }),
    ).toEqual(getPersonalInAppEventKeys({ contour, role: UserRole.MASTER }));
    expect(
      getPersonalInAppEventKeys({ contour, role: UserRole.TECHNICIAN }),
    ).not.toContain('ticket.claimed');
    expect(
      getPersonalInAppEventKeys({ contour, role: UserRole.STAFF }),
    ).toEqual([
      'ticket.assignment_requested',
      'ticket.sla_warning',
      'ticket.sla_breached',
    ]);
  });

  it('never gives PLATFORM_ADMIN a company contour', () => {
    for (const contour of Object.values(NotificationContour)) {
      expect(
        getPersonalInAppEventKeys({ contour, role: UserRole.PLATFORM_ADMIN }),
      ).toEqual([]);
    }
  });
});
