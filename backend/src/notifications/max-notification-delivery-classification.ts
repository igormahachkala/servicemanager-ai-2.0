export type MaxNotificationDeliveryKind =
  'USER_ADDRESSABLE' | 'SHARED_OPERATIONAL_BROADCAST';

export type MaxNotificationDeliveryPath = {
  eventType:
    | 'ticket.created'
    | 'ticket.assigned'
    | 'ticket.claimed'
    | 'ticket.status_changed';
  notificationsServiceMethod:
    | 'sendMaxTicketCreated'
    | 'sendMaxTicketAssigned'
    | 'sendMaxTicketClaimed'
    | 'sendMaxTicketStatusChanged';
  maxBotServiceMethod:
    | 'sendTicketCreatedMessage'
    | 'sendTicketAssignedMessage'
    | 'sendTicketClaimedMessage'
    | 'sendTicketStatusChangedMessage';
  deliveryKind: MaxNotificationDeliveryKind;
  userPreferenceControllable: boolean;
  reason: string;
};

export const MAX_NOTIFICATION_DELIVERY_PATHS = [
  {
    eventType: 'ticket.created',
    notificationsServiceMethod: 'sendMaxTicketCreated',
    maxBotServiceMethod: 'sendTicketCreatedMessage',
    deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
    userPreferenceControllable: false,
    reason:
      'MaxBotService sends the ticket-created message to a location thread or operational group chat, not to a per-user address.',
  },
  {
    eventType: 'ticket.assigned',
    notificationsServiceMethod: 'sendMaxTicketAssigned',
    maxBotServiceMethod: 'sendTicketAssignedMessage',
    deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
    userPreferenceControllable: false,
    reason:
      'MaxBotService sends the ticket-assigned message to a location thread or operational group chat, not to a per-user address.',
  },
  {
    eventType: 'ticket.claimed',
    notificationsServiceMethod: 'sendMaxTicketClaimed',
    maxBotServiceMethod: 'sendTicketClaimedMessage',
    deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
    userPreferenceControllable: false,
    reason:
      'MaxBotService sends the ticket-claimed message to a location thread or operational group chat, not to a per-user address.',
  },
  {
    eventType: 'ticket.status_changed',
    notificationsServiceMethod: 'sendMaxTicketStatusChanged',
    maxBotServiceMethod: 'sendTicketStatusChangedMessage',
    deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
    userPreferenceControllable: false,
    reason:
      'MaxBotService sends the ticket-status message to a location thread or operational group chat, not to a per-user address.',
  },
] as const satisfies readonly MaxNotificationDeliveryPath[];

export function isMaxNotificationUserPreferenceControllable(eventType: string) {
  return (
    MAX_NOTIFICATION_DELIVERY_PATHS.find((path) => path.eventType === eventType)
      ?.userPreferenceControllable ?? false
  );
}
