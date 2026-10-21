import {
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import type { NotificationTicketSection } from './notification-navigation';

export type LegacyPushPreferenceKey =
  | 'chat'
  | 'ticketNew'
  | 'assignment'
  | 'statusChange'
  | 'acceptance'
  | 'acceptanceReject'
  | 'sla';

export type NotificationEventGroup =
  | 'TICKET'
  | 'ASSIGNMENT'
  | 'CHAT'
  | 'STATUS'
  | 'SLA'
  | 'ACCEPTANCE';

export type NotificationEventDefinition = {
  key: string;
  labelRu: string;
  descriptionRu: string;
  group: NotificationEventGroup;
  defaultSection: NotificationTicketSection;
  legacyPushPreferenceKey: LegacyPushPreferenceKey;
};

export const SUPPORTED_NOTIFICATION_EVENTS = [
  {
    key: 'ticket.created',
    labelRu: 'Новая заявка',
    descriptionRu: 'Заявка создана в доступном контуре.',
    group: 'TICKET',
    defaultSection: 'overview',
    legacyPushPreferenceKey: 'ticketNew',
  },
  {
    key: 'ticket.assigned',
    labelRu: 'Назначен исполнитель',
    descriptionRu: 'Заявка назначена или переназначена исполнителю.',
    group: 'ASSIGNMENT',
    defaultSection: 'actions',
    legacyPushPreferenceKey: 'assignment',
  },
  {
    key: 'ticket.claimed',
    labelRu: 'Заявку взяли в работу',
    descriptionRu: 'Исполнитель сам закрепил за собой заявку.',
    group: 'ASSIGNMENT',
    defaultSection: 'actions',
    legacyPushPreferenceKey: 'assignment',
  },
  {
    key: 'ticket.assignment_requested',
    labelRu: 'Запрос назначения',
    descriptionRu: 'Исполнитель просит назначить его на заявку.',
    group: 'ASSIGNMENT',
    defaultSection: 'actions',
    legacyPushPreferenceKey: 'assignment',
  },
  {
    key: 'ticket.comment_added',
    labelRu: 'Новый комментарий',
    descriptionRu: 'В карточку заявки добавлен комментарий.',
    group: 'CHAT',
    defaultSection: 'comments',
    legacyPushPreferenceKey: 'chat',
  },
  {
    key: 'ticket.attachment_uploaded',
    labelRu: 'Новое фото или видео',
    descriptionRu: 'К заявке добавлен медиафайл.',
    group: 'CHAT',
    defaultSection: 'attachments',
    legacyPushPreferenceKey: 'chat',
  },
  {
    key: 'ticket.status_changed',
    labelRu: 'Статус изменён',
    descriptionRu: 'Статус заявки изменился для назначенного исполнителя.',
    group: 'STATUS',
    defaultSection: 'history',
    legacyPushPreferenceKey: 'statusChange',
  },
  {
    key: 'ticket.in_progress',
    labelRu: 'Работы начаты',
    descriptionRu: 'Исполнитель начал работу по заявке.',
    group: 'STATUS',
    defaultSection: 'history',
    legacyPushPreferenceKey: 'statusChange',
  },
  {
    key: 'ticket.done',
    labelRu: 'Работы завершены',
    descriptionRu: 'Работы по заявке завершены.',
    group: 'STATUS',
    defaultSection: 'history',
    legacyPushPreferenceKey: 'statusChange',
  },
  {
    key: 'ticket.sla_warning',
    labelRu: 'SLA скоро истечёт',
    descriptionRu: 'Заявка приближается к сроку SLA.',
    group: 'SLA',
    defaultSection: 'overview',
    legacyPushPreferenceKey: 'sla',
  },
  {
    key: 'ticket.sla_breached',
    labelRu: 'SLA просрочен',
    descriptionRu: 'Срок SLA по заявке нарушен.',
    group: 'SLA',
    defaultSection: 'history',
    legacyPushPreferenceKey: 'sla',
  },
  {
    key: 'ticket.awaiting_acceptance',
    labelRu: 'Ожидает приёмки',
    descriptionRu: 'Работы готовы и ожидают подтверждения клиента.',
    group: 'ACCEPTANCE',
    defaultSection: 'acceptance',
    legacyPushPreferenceKey: 'acceptance',
  },
  {
    key: 'ticket.accepted',
    labelRu: 'Работа принята',
    descriptionRu: 'Клиент принял результат работ.',
    group: 'ACCEPTANCE',
    defaultSection: 'history',
    legacyPushPreferenceKey: 'acceptance',
  },
  {
    key: 'ticket.rejected',
    labelRu: 'Работа не принята',
    descriptionRu: 'Клиент вернул работу на доработку.',
    group: 'ACCEPTANCE',
    defaultSection: 'history',
    legacyPushPreferenceKey: 'acceptanceReject',
  },
] as const satisfies readonly NotificationEventDefinition[];

export type NotificationEventKey =
  (typeof SUPPORTED_NOTIFICATION_EVENTS)[number]['key'];

export const NOTIFICATION_EVENT_KEYS = SUPPORTED_NOTIFICATION_EVENTS.map(
  (event) => event.key,
) as readonly NotificationEventKey[];

export const NOTIFICATION_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.PUSH,
  NotificationChannel.MAX,
] as const;

export const NOTIFICATION_CONTOURS = [
  NotificationContour.CLIENT,
  NotificationContour.PRIMARY_PROVIDER,
  NotificationContour.SECONDARY_PROVIDER,
] as const;

export const NOTIFICATION_ROLES_BY_CONTOUR: Record<
  NotificationContour,
  readonly UserRole[]
> = {
  [NotificationContour.CLIENT]: [
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.NETWORK_DIRECTOR,
    UserRole.TERRITORIAL_MANAGER,
    UserRole.CLIENT,
    UserRole.STAFF,
  ],
  [NotificationContour.PRIMARY_PROVIDER]: [
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.TECHNICIAN,
    UserRole.STAFF,
  ],
  [NotificationContour.SECONDARY_PROVIDER]: [
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.TECHNICIAN,
    UserRole.STAFF,
  ],
};

const CLIENT_MANAGEMENT_EVENTS = [
  'ticket.created',
  'ticket.done',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const CLIENT_REQUESTER_EVENTS = [
  'ticket.created',
  'ticket.comment_added',
  'ticket.attachment_uploaded',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const PRIMARY_PROVIDER_ADMIN_EVENTS = [
  'ticket.created',
  'ticket.assigned',
  'ticket.assignment_requested',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const PRIMARY_PROVIDER_DISPATCHER_EVENTS = [
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
] as const satisfies readonly NotificationEventKey[];

const PRIMARY_PROVIDER_MASTER_EVENTS = [
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
] as const satisfies readonly NotificationEventKey[];

const PROVIDER_TECHNICIAN_EVENTS = [
  'ticket.assigned',
  'ticket.comment_added',
  'ticket.attachment_uploaded',
  'ticket.status_changed',
  'ticket.sla_warning',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const SECONDARY_PROVIDER_ADMIN_EVENTS = [
  'ticket.assigned',
  'ticket.assignment_requested',
  'ticket.sla_breached',
  'ticket.awaiting_acceptance',
  'ticket.accepted',
  'ticket.rejected',
] as const satisfies readonly NotificationEventKey[];

const SECONDARY_PROVIDER_OPERATOR_EVENTS = [
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
] as const satisfies readonly NotificationEventKey[];

export const SYSTEM_NOTIFICATION_DEFAULTS: Record<
  NotificationContour,
  Partial<Record<UserRole, readonly NotificationEventKey[]>>
> = {
  [NotificationContour.CLIENT]: {
    [UserRole.ADMIN]: CLIENT_MANAGEMENT_EVENTS,
    [UserRole.CLIENT_ADMIN]: [],
    [UserRole.NETWORK_DIRECTOR]: CLIENT_MANAGEMENT_EVENTS,
    [UserRole.TERRITORIAL_MANAGER]: CLIENT_MANAGEMENT_EVENTS,
    [UserRole.CLIENT]: CLIENT_REQUESTER_EVENTS,
    [UserRole.STAFF]: [],
  },
  [NotificationContour.PRIMARY_PROVIDER]: {
    [UserRole.ADMIN]: PRIMARY_PROVIDER_ADMIN_EVENTS,
    [UserRole.MASTER]: PRIMARY_PROVIDER_MASTER_EVENTS,
    [UserRole.DISPATCHER]: PRIMARY_PROVIDER_DISPATCHER_EVENTS,
    [UserRole.TECHNICIAN]: PROVIDER_TECHNICIAN_EVENTS,
    [UserRole.STAFF]: ['ticket.assignment_requested'],
  },
  [NotificationContour.SECONDARY_PROVIDER]: {
    [UserRole.ADMIN]: SECONDARY_PROVIDER_ADMIN_EVENTS,
    [UserRole.MASTER]: SECONDARY_PROVIDER_OPERATOR_EVENTS,
    [UserRole.DISPATCHER]: SECONDARY_PROVIDER_OPERATOR_EVENTS,
    [UserRole.TECHNICIAN]: PROVIDER_TECHNICIAN_EVENTS,
    [UserRole.STAFF]: ['ticket.assignment_requested'],
  },
};

const EVENT_BY_KEY = new Map<string, NotificationEventDefinition>(
  SUPPORTED_NOTIFICATION_EVENTS.map((event) => [event.key, event]),
);

export function getNotificationEventDefinition(
  eventType: string,
): NotificationEventDefinition | null {
  return EVENT_BY_KEY.get(eventType) ?? null;
}

export function isSupportedNotificationEvent(
  eventType: string,
): eventType is NotificationEventKey {
  return EVENT_BY_KEY.has(eventType);
}

export function isSupportedNotificationContour(
  contour: string,
): contour is NotificationContour {
  return (NOTIFICATION_CONTOURS as readonly string[]).includes(contour);
}

export function isSupportedNotificationChannel(
  channel: string,
): channel is NotificationChannel {
  return (NOTIFICATION_CHANNELS as readonly string[]).includes(channel);
}

export function isRoleRepresentableForNotificationContour(params: {
  contour: NotificationContour;
  role: UserRole;
}) {
  return Boolean(
    NOTIFICATION_ROLES_BY_CONTOUR[params.contour]?.includes(params.role),
  );
}

export function getSystemNotificationDefault(params: {
  contour: NotificationContour;
  role: UserRole;
  eventType: string;
  channel: NotificationChannel;
}) {
  if (!isSupportedNotificationEvent(params.eventType)) return false;
  if (!isRoleRepresentableForNotificationContour(params)) return false;
  if (!isSupportedNotificationChannel(params.channel)) return false;

  const roleDefaults =
    SYSTEM_NOTIFICATION_DEFAULTS[params.contour][params.role] ?? [];
  return roleDefaults.includes(params.eventType);
}

export function getLegacyPushPreferenceKey(
  eventType: string,
): LegacyPushPreferenceKey | null {
  return (
    getNotificationEventDefinition(eventType)?.legacyPushPreferenceKey ?? null
  );
}
