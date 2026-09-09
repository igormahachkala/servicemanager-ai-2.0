import {
  isMaxNotificationUserPreferenceControllable,
  MAX_NOTIFICATION_DELIVERY_PATHS,
} from './max-notification-delivery-classification';

describe('MAX notification delivery classification', () => {
  it('classifies current ticket MAX notifications as shared broadcasts', () => {
    expect(MAX_NOTIFICATION_DELIVERY_PATHS).toEqual([
      expect.objectContaining({
        eventType: 'ticket.created',
        notificationsServiceMethod: 'sendMaxTicketCreated',
        maxBotServiceMethod: 'sendTicketCreatedMessage',
        deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
        userPreferenceControllable: false,
      }),
      expect.objectContaining({
        eventType: 'ticket.assigned',
        notificationsServiceMethod: 'sendMaxTicketAssigned',
        maxBotServiceMethod: 'sendTicketAssignedMessage',
        deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
        userPreferenceControllable: false,
      }),
      expect.objectContaining({
        eventType: 'ticket.claimed',
        notificationsServiceMethod: 'sendMaxTicketClaimed',
        maxBotServiceMethod: 'sendTicketClaimedMessage',
        deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
        userPreferenceControllable: false,
      }),
      expect.objectContaining({
        eventType: 'ticket.status_changed',
        notificationsServiceMethod: 'sendMaxTicketStatusChanged',
        maxBotServiceMethod: 'sendTicketStatusChangedMessage',
        deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
        userPreferenceControllable: false,
      }),
    ]);
  });

  it('does not claim user-level MAX preference control for group broadcasts', () => {
    for (const path of MAX_NOTIFICATION_DELIVERY_PATHS) {
      expect(isMaxNotificationUserPreferenceControllable(path.eventType)).toBe(
        false,
      );
    }
    expect(
      isMaxNotificationUserPreferenceControllable('ticket.comment_added'),
    ).toBe(false);
  });
});
