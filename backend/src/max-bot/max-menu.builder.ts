import { CompanyType, UserRole } from '@prisma/client';

import { PERMISSIONS, type PermissionCode } from '../common/permissions.constants';

/**
 * SMA-MAX-BOT-V2-FOUNDATION-037.
 *
 * One menu model, two renderings. The model says *what* the user may do; a renderer says
 * how it looks. Today only the text renderer exists because the bot sends `{ text }`;
 * when the button renderer lands (MAX supports `inline_keyboard`, see the capability
 * proof) it consumes this same model and no menu semantics move.
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
const MENU_SUBTITLE = 'Управление заявками и сервисными работами.';

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
    subtitle: 'Заявки, работы и уведомления — в одном месте.',
    unbound: true,
    items: [
      { id: 'link_account', label: 'Привязать аккаунт', target: 'link' },
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
    { id: 'open_app', label: 'Открыть Сервис Менеджер', target: 'app' },
  ];

  if (has(capabilities, PERMISSIONS.TICKETS_VIEW)) {
    items.push({ id: 'my_tickets', label: 'Мои заявки', target: 'list_my' });
  }

  // Provider-side only: the "available to take" queue is meaningless for a client tenant.
  if (has(capabilities, PERMISSIONS.TICKETS_VIEW_AVAILABLE)) {
    items.push({ id: 'available_tickets', label: 'Доступные заявки', target: 'list_available' });
  }

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
    items.push({ id: 'shift', label: 'Смена', target: 'shift' });
  }

  items.push({ id: 'notifications', label: 'Уведомления', target: 'notifications' });
  items.push({ id: 'help', label: 'Помощь', target: 'help' });

  return { title: MENU_TITLE, subtitle: MENU_SUBTITLE, items, unbound: false };
}

/**
 * Text rendering — the only rendering the current MAX integration can send, because
 * `sendRawMessage` posts `{ text }`. Replaced, not rewritten, once buttons ship.
 */
export function renderMenuText(model: MaxMenuModel): string {
  const lines = [model.title, model.subtitle, ''];
  for (const item of model.items) {
    lines.push(`• ${item.label}`);
  }
  lines.push('');
  lines.push(
    model.unbound
      ? 'Откройте приложение, чтобы связать MAX с вашей учётной записью.'
      : 'Подробности заявок открываются в приложении.',
  );
  return lines.join('\n');
}
