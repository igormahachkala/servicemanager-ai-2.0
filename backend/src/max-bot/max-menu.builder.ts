import { CompanyType, UserRole } from '@prisma/client';

import { PERMISSIONS, type PermissionCode } from '../common/permissions.constants';
import {
  type MaxBotCommandResponse,
  type MaxBotInlineKeyboardAttachment,
  type MaxBotInlineKeyboardButton,
  type MaxBotMessageBody,
} from './max-bot.types';

/**
 * SMA-MAX-BOT-V2-FOUNDATION-037.
 *
 * One menu model, two renderings. The model says *what* the user may do; a renderer says
 * how it looks. The MAX renderer emits the official `inline_keyboard` attachment shape
 * and keeps launch payloads as navigation hints only.
 *
 * The builder is a pure function on purpose. It performs no database access and owns no
 * permission logic of its own — it receives already-resolved capabilities and only decides
 * layout. That is what keeps it from becoming a second access resolver: if the canonical
 * matrix changes, this file does not.
 */

export type MaxMenuItemId =
  | 'open_app'
  | 'my_tickets'
  | 'available_tickets'
  | 'awaiting_acceptance'
  | 'notifications'
  | 'shift'
  | 'help'
  | 'link_account';

export type MaxMenuItem = {
  id: MaxMenuItemId;
  /** Russian label shown to the user. */
  label: string;
  /**
   * Canonical deep-link target consumed by the Mini App. Navigation only — a menu item
   * never carries authority, it only names a destination that is re-checked on arrival.
   */
  target: string;
};

export type MaxMenuModel = {
  title: string;
  subtitle: string;
  items: MaxMenuItem[];
  /** True when the viewer has no usable ServiceManager identity. */
  unbound: boolean;
};

/**
 * Capabilities the menu needs. Supplied by the caller from the canonical permission and
 * access services — this module never derives them. Modelled as an explicit interface so
 * the boundary is visible and testable.
 */
export type MaxMenuCapabilities = {
  role: UserRole;
  companyType: CompanyType;
  /** Effective permission codes from the canonical PBAC matrix. */
  permissions: readonly string[];
};

const MENU_TITLE = 'Сервис Менеджер';
const MENU_SUBTITLE = 'Управляйте заявками и сервисными работами прямо из MAX.';
export const DEFAULT_MAX_BOT_USERNAME = 'id056001679003_bot';

const MAX_BOT_USERNAME_RE = /^[A-Za-z0-9_]{1,64}$/;
const MAX_STARTAPP_PAYLOAD_RE = /^[A-Za-z0-9_-]{1,512}$/;
const MAX_MENU_CALLBACKS = new Set(['menu', 'help']);

const TARGET_PAYLOAD: Record<string, string> = {
  app: 'app',
  list_my: 'my',
  list_available: 'available',
  list_acceptance: 'acceptance',
  notifications: 'notifications',
  shift: 'shift',
};

export type MaxTicketNotificationButtonKind = 'ticket' | 'comment' | 'acceptance' | 'assignment';

const TICKET_NOTIFICATION_LABELS: Record<MaxTicketNotificationButtonKind, string> = {
  ticket: 'Открыть заявку',
  comment: 'Открыть комментарий',
  acceptance: 'Открыть приёмку',
  assignment: 'Открыть заявку',
};

/** Roles allowed to accept or reject completed work. Mirrors ticket-acceptance-access.ts. */
const CLIENT_ACCEPTANCE_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
];

function has(capabilities: MaxMenuCapabilities, code: PermissionCode): boolean {
  return capabilities.permissions.includes(code);
}

/**
 * Menu for a viewer we could not resolve to a ServiceManager user.
 *
 * Shows what the bot is and how to link — and nothing else. No counts, no ticket
 * numbers, no company names: an unbound viewer must not be able to learn anything
 * about the tenant from the bot's replies.
 */
export function buildUnboundMenuModel(): MaxMenuModel {
  return {
    title: MENU_TITLE,
    subtitle: MENU_SUBTITLE,
    unbound: true,
    items: [
      { id: 'open_app', label: 'Открыть ServiceManager', target: 'app' },
      { id: 'help', label: 'Помощь', target: 'help' },
    ],
  };
}

/**
 * Menu for a resolved user. An entry appears only when the viewer actually holds the
 * permission its destination requires, so the menu cannot advertise an action that the
 * API would then refuse.
 */
export function buildMenuModel(capabilities: MaxMenuCapabilities): MaxMenuModel {
  const items: MaxMenuItem[] = [
    { id: 'open_app', label: 'Открыть ServiceManager', target: 'app' },
  ];

  if (has(capabilities, PERMISSIONS.TICKETS_VIEW)) {
    items.push({ id: 'my_tickets', label: 'Мои заявки', target: 'list_my' });
  }

  // Provider-side only: the "available to take" queue is meaningless for a client tenant.
  if (has(capabilities, PERMISSIONS.TICKETS_VIEW_AVAILABLE)) {
    items.push({ id: 'available_tickets', label: 'Доступные заявки', target: 'list_available' });
  }

  items.push({ id: 'notifications', label: 'Уведомления', target: 'notifications' });

  // Acceptance is client-management only. A provider company can never accept its own
  // work, so the entry is withheld from every provider role regardless of permissions.
  const canAccept =
    capabilities.companyType === CompanyType.CLIENT &&
    CLIENT_ACCEPTANCE_ROLES.includes(capabilities.role) &&
    has(capabilities, PERMISSIONS.TICKETS_VIEW);
  if (canAccept) {
    items.push({ id: 'awaiting_acceptance', label: 'Требуют приёмки', target: 'list_acceptance' });
  }

  if (has(capabilities, PERMISSIONS.WORKFORCE_SHIFT_USE)) {
    items.push({ id: 'shift', label: 'Моя смена', target: 'shift' });
  }

  items.push({ id: 'help', label: 'Помощь', target: 'help' });

  return { title: MENU_TITLE, subtitle: MENU_SUBTITLE, items, unbound: false };
}

/**
 * Text rendering — the only rendering the current MAX integration can send, because
 * `sendRawMessage` posts `{ text }`. Replaced, not rewritten, once buttons ship.
 */
export function renderMenuText(model: MaxMenuModel): string {
  const lines = [model.title, '', model.subtitle];
  lines.push(
    model.unbound
      ? 'Откройте приложение и войдите в ServiceManager. Бот не показывает данные заявок без входа.'
      : 'Подробности заявок открываются в приложении.',
  );
  return lines.join('\n');
}

export function normalizeMaxBotUsername(value?: string | null) {
  const candidate = (value || '').trim() || DEFAULT_MAX_BOT_USERNAME;
  return MAX_BOT_USERNAME_RE.test(candidate) ? candidate : DEFAULT_MAX_BOT_USERNAME;
}

export function isValidMaxStartAppPayload(payload: string) {
  return MAX_STARTAPP_PAYLOAD_RE.test(payload);
}

export function buildMaxStartAppDeepLink(botUsername: string, payload?: string | null) {
  const username = normalizeMaxBotUsername(botUsername);
  const normalizedPayload = (payload || '').trim();
  if (!normalizedPayload) return `https://max.ru/${username}?startapp`;
  if (!isValidMaxStartAppPayload(normalizedPayload)) return null;
  return `https://max.ru/${username}?startapp=${normalizedPayload}`;
}

export function buildTicketStartAppPayload(ticketId: string) {
  const normalizedTicketId = ticketId.trim();
  if (!normalizedTicketId) return null;
  const payload = `ticket_${normalizedTicketId}`;
  return isValidMaxStartAppPayload(payload) ? payload : null;
}

export function renderInlineKeyboard(
  rows: MaxBotInlineKeyboardButton[][],
): MaxBotInlineKeyboardAttachment | null {
  const buttons = rows
    .map((row) => row.filter(Boolean))
    .filter((row) => row.length > 0);

  if (!buttons.length) return null;
  return {
    type: 'inline_keyboard',
    payload: { buttons },
  };
}

function openAppButton(text: string, botUsername: string, payload?: string | null): MaxBotInlineKeyboardButton {
  const normalizedPayload = (payload || '').trim();
  const safePayload = normalizedPayload && isValidMaxStartAppPayload(normalizedPayload)
    ? normalizedPayload
    : null;
  return {
    type: 'open_app',
    text,
    web_app: normalizeMaxBotUsername(botUsername),
    ...(safePayload ? { payload: safePayload } : {}),
  };
}

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

function menuItemToButton(item: MaxMenuItem, botUsername: string): MaxBotInlineKeyboardButton | null {
  if (item.target === 'help') return callbackButton(item.label, 'help');
  if (item.target === 'link') return null;

  const payload = TARGET_PAYLOAD[item.target];
  if (!payload) return null;
  return openAppButton(item.label, botUsername, payload);
}

export function renderMenuKeyboard(model: MaxMenuModel, botUsername: string) {
  return renderInlineKeyboard(
    model.items
      .map((item) => menuItemToButton(item, botUsername))
      .filter((button): button is MaxBotInlineKeyboardButton => !!button)
      .map((button) => [button]),
  );
}

export function renderMenuMessage(model: MaxMenuModel, botUsername: string): MaxBotCommandResponse {
  const keyboard = renderMenuKeyboard(model, botUsername);
  return {
    text: renderMenuText(model),
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderHelpMessage(botUsername: string): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard([
    [openAppButton('Открыть ServiceManager', botUsername, 'app')],
    [callbackButton('Меню', 'menu')],
  ]);
  return {
    text: [
      'Помощь',
      '',
      'Нажмите кнопку, чтобы открыть ServiceManager. Заявки и уведомления доступны только после входа в приложение.',
    ].join('\n'),
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderLegacyNavigationMessage(botUsername: string): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard([
    [openAppButton('Открыть ServiceManager', botUsername, 'app')],
    [callbackButton('Меню', 'menu')],
  ]);
  return {
    text: [
      'Заявки теперь открываются в приложении.',
      '',
      'Откройте ServiceManager: там доступны только ваши заявки.',
    ].join('\n'),
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderOpenAppMessage(text: string, botUsername: string): MaxBotMessageBody {
  const keyboard = renderInlineKeyboard([[openAppButton('Открыть ServiceManager', botUsername, 'app')]]);
  return {
    text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderTicketNavigationMessage(params: {
  text: string;
  botUsername: string;
  ticketId: string;
  kind: MaxTicketNotificationButtonKind;
}): MaxBotMessageBody {
  const payload = buildTicketStartAppPayload(params.ticketId);
  const keyboard = payload
    ? renderInlineKeyboard([
        [openAppButton(TICKET_NOTIFICATION_LABELS[params.kind], params.botUsername, payload)],
      ])
    : null;

  return {
    text: params.text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function isSafeMaxCallbackPayload(payload: string) {
  return MAX_MENU_CALLBACKS.has(payload);
}

export function buildMinimalMaxBotCommands() {
  return [
    { name: 'start', description: 'Открыть меню' },
    { name: 'menu', description: 'Показать меню' },
    { name: 'help', description: 'Помощь' },
  ];
}
