import {
  buildLegacyNotificationNavigationTarget,
  buildTicketNotificationNavigationTarget,
  ticketNotificationSectionForType,
} from './notification-navigation';

describe('notification navigation target builder', () => {
  it.each([
    ['ticket.created', 'overview'],
    ['ticket.assigned', 'actions'],
    ['ticket.claimed', 'actions'],
    ['ticket.assignment_requested', 'actions'],
    ['ticket.status_changed', 'history'],
    ['ticket.in_progress', 'history'],
    ['ticket.done', 'history'],
    ['ticket.awaiting_acceptance', 'acceptance'],
    ['ticket.accepted', 'history'],
    ['ticket.rejected', 'history'],
    ['ticket.comment_added', 'comments'],
    ['ticket.attachment_uploaded', 'attachments'],
    ['ticket.sla_warning', 'overview'],
    ['ticket.sla_breached', 'history'],
  ])('maps %s to %s', (type, section) => {
    expect(ticketNotificationSectionForType(type)).toBe(section);
    expect(buildTicketNotificationNavigationTarget({ ticketId: 'ticket-1', type })).toEqual({
      kind: 'ticket',
      ticketId: 'ticket-1',
      section,
    });
  });

  it('includes only current useful optional fields', () => {
    expect(
      buildTicketNotificationNavigationTarget({
        ticketId: ' ticket-1 ',
        type: 'ticket.comment_added',
        linkedClientCompanyId: ' client-1 ',
        sourceEventId: ' event-1 ',
      }),
    ).toEqual({
      kind: 'ticket',
      ticketId: 'ticket-1',
      section: 'comments',
      linkedClientCompanyId: 'client-1',
      sourceEventId: 'event-1',
    });
  });

  it('falls back from legacy notification entity fields', () => {
    expect(
      buildLegacyNotificationNavigationTarget({
        entityType: 'Ticket',
        entityId: 'ticket-1',
        type: 'ticket.attachment_uploaded',
        linkedClientCompanyId: 'client-1',
      }),
    ).toEqual({
      kind: 'ticket',
      ticketId: 'ticket-1',
      section: 'attachments',
      linkedClientCompanyId: 'client-1',
    });
  });

  it('does not build targets for unknown legacy entities', () => {
    expect(
      buildLegacyNotificationNavigationTarget({
        entityType: 'User',
        entityId: 'user-1',
        type: 'user.created',
      }),
    ).toBeNull();
  });
});
