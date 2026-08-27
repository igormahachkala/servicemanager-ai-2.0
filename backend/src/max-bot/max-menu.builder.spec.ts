import { CompanyType, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import {
  buildMaxStartAppDeepLink,
  buildMenuModel,
  buildMinimalMaxBotCommands,
  buildTicketStartAppPayload,
  buildUnboundMenuModel,
  renderHelpMessage,
  renderMenuKeyboard,
  renderMenuMessage,
  renderMenuText,
  renderTicketNavigationMessage,
  type MaxMenuCapabilities,
} from './max-menu.builder';

const ids = (caps: MaxMenuCapabilities) => buildMenuModel(caps).items.map((i) => i.id);

const CLIENT_ADMIN: MaxMenuCapabilities = {
  role: UserRole.ADMIN,
  companyType: CompanyType.CLIENT,
  permissions: [
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.LOCATIONS_VIEW,
    PERMISSIONS.WORKFORCE_SHIFT_USE,
  ],
};

const PROVIDER_TECHNICIAN: MaxMenuCapabilities = {
  role: UserRole.TECHNICIAN,
  companyType: CompanyType.PROVIDER,
  permissions: [
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_VIEW_AVAILABLE,
    PERMISSIONS.TICKETS_CLAIM,
    PERMISSIONS.WORKFORCE_SHIFT_USE,
  ],
};

describe('buildUnboundMenuModel', () => {
  it('offers only app launch and help', () => {
    const model = buildUnboundMenuModel();
    expect(model.unbound).toBe(true);
    expect(model.items.map((i) => i.id)).toEqual(['open_app', 'help']);
  });

  it('exposes no ticket destination to an unbound viewer', () => {
    const targets = buildUnboundMenuModel().items.map((i) => i.target);
    expect(targets.some((t) => t.startsWith('list_') || t.startsWith('ticket'))).toBe(false);
  });
});

describe('buildMenuModel', () => {
  it('always leads with the application entry point', () => {
    expect(ids(CLIENT_ADMIN)[0]).toBe('open_app');
  });

  it('gives a client admin acceptance but never the provider queue', () => {
    const items = ids(CLIENT_ADMIN);
    expect(items).toContain('awaiting_acceptance');
    expect(items).not.toContain('available_tickets');
  });

  it('gives a provider technician the available queue but never acceptance', () => {
    const items = ids(PROVIDER_TECHNICIAN);
    expect(items).toContain('available_tickets');
    expect(items).not.toContain('awaiting_acceptance');
  });

  it.each([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN])(
    'never offers acceptance to provider role %s',
    (role) => {
      const items = ids({
        role,
        companyType: CompanyType.PROVIDER,
        permissions: [PERMISSIONS.TICKETS_VIEW, PERMISSIONS.TICKETS_ASSIGN],
      });
      expect(items).not.toContain('awaiting_acceptance');
    },
  );

  it.each([UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN, UserRole.CLIENT])(
    'never offers acceptance to non-acceptance client role %s',
    (role) => {
      const items = ids({
        role,
        companyType: CompanyType.CLIENT,
        permissions: [PERMISSIONS.TICKETS_VIEW],
      });
      expect(items).not.toContain('awaiting_acceptance');
    },
  );

  it.each([UserRole.ADMIN, UserRole.TERRITORIAL_MANAGER, UserRole.NETWORK_DIRECTOR])(
    'offers acceptance to client management role %s',
    (role) => {
      const items = ids({
        role,
        companyType: CompanyType.CLIENT,
        permissions: [PERMISSIONS.TICKETS_VIEW],
      });
      expect(items).toContain('awaiting_acceptance');
    },
  );

  it('withholds every permission-gated entry when the user holds no permissions', () => {
    const items = ids({ role: UserRole.STAFF, companyType: CompanyType.CLIENT, permissions: [] });
    expect(items).not.toContain('my_tickets');
    expect(items).not.toContain('available_tickets');
    expect(items).not.toContain('awaiting_acceptance');
    expect(items).not.toContain('shift');
    expect(items).toEqual(['open_app', 'notifications', 'help']);
  });

  it('gates the shift entry on WORKFORCE_SHIFT_USE', () => {
    expect(ids(PROVIDER_TECHNICIAN)).toContain('shift');
    expect(
      ids({ ...PROVIDER_TECHNICIAN, permissions: [PERMISSIONS.TICKETS_VIEW] }),
    ).not.toContain('shift');
  });

  it('carries navigation targets only — no ticket ids or authority', () => {
    for (const item of buildMenuModel(PROVIDER_TECHNICIAN).items) {
      expect(item.target).toMatch(/^(app|list_[a-z]+|notifications|shift|help|link)$/);
    }
  });
});

describe('renderMenuText', () => {
  it('renders the button-first card copy without command instructions', () => {
    const model = buildMenuModel(CLIENT_ADMIN);
    const text = renderMenuText(model);
    expect(text).toContain('Сервис Менеджер');
    expect(text).toContain('Управляйте заявками и сервисными работами прямо из MAX');
    expect(text).not.toContain('/start');
    expect(text).not.toContain('/tickets');
  });

  it('tells an unbound viewer how to link and shows no ticket wording', () => {
    const text = renderMenuText(buildUnboundMenuModel());
    expect(text).toContain('войдите в ServiceManager');
    expect(text).not.toContain('Мои заявки');
  });
});

describe('MAX startapp deep links', () => {
  it('uses the official startapp form for the observed bot username', () => {
    expect(buildMaxStartAppDeepLink('id056001679003_bot')).toBe(
      'https://max.ru/id056001679003_bot?startapp',
    );
    expect(buildMaxStartAppDeepLink('id056001679003_bot', 'ticket_abc-123')).toBe(
      'https://max.ru/id056001679003_bot?startapp=ticket_abc-123',
    );
  });

  it('accepts only official Mini App payload characters', () => {
    expect(buildTicketStartAppPayload('abc-123_DEF')).toBe('ticket_abc-123_DEF');
    expect(buildTicketStartAppPayload('../secret')).toBeNull();
  });
});

describe('renderMenuKeyboard', () => {
  it('serializes the unbound menu as one inline_keyboard attachment', () => {
    const keyboard = renderMenuKeyboard(buildUnboundMenuModel(), 'id056001679003_bot');

    expect(keyboard).toEqual({
      type: 'inline_keyboard',
      payload: {
        buttons: [
          [
            {
              type: 'open_app',
              text: 'Открыть ServiceManager',
              web_app: 'id056001679003_bot',
              payload: 'app',
            },
          ],
          [{ type: 'callback', text: 'Помощь', payload: 'help' }],
        ],
      },
    });
  });

  it('renders future bound menu entries as navigation-only open_app buttons', () => {
    const message = renderMenuMessage(buildMenuModel(CLIENT_ADMIN), 'id056001679003_bot');
    const buttons = message.attachments?.[0]?.payload.buttons.flat() || [];

    expect(buttons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'open_app',
          text: 'Мои заявки',
          web_app: 'id056001679003_bot',
          payload: 'my',
        }),
        expect.objectContaining({
          type: 'open_app',
          text: 'Уведомления',
          web_app: 'id056001679003_bot',
          payload: 'notifications',
        }),
        expect.objectContaining({
          type: 'open_app',
          text: 'Требуют приёмки',
          web_app: 'id056001679003_bot',
          payload: 'acceptance',
        }),
      ]),
    );
    expect(JSON.stringify(buttons)).not.toMatch(/Принять|Отклонить|Взять|Назначить/);
  });
});

describe('renderTicketNavigationMessage', () => {
  it('adds a ticket_<id> open_app button without putting a raw URL into text', () => {
    const message = renderTicketNavigationMessage({
      text: 'Новая заявка\nЗаявка: #123',
      botUsername: 'id056001679003_bot',
      ticketId: 'b89c5c66-3414',
      kind: 'ticket',
    });

    expect(message.text).not.toContain('https://');
    expect(message.attachments?.[0]).toEqual({
      type: 'inline_keyboard',
      payload: {
        buttons: [
          [
            {
              type: 'open_app',
              text: 'Открыть заявку',
              web_app: 'id056001679003_bot',
              payload: 'ticket_b89c5c66-3414',
            },
          ],
        ],
      },
    });
  });

  it('uses section-specific labels but keeps the payload navigation-only', () => {
    const comment = renderTicketNavigationMessage({
      text: 'Новый комментарий',
      botUsername: 'id056001679003_bot',
      ticketId: 'ticket-1',
      kind: 'comment',
    });
    const acceptance = renderTicketNavigationMessage({
      text: 'Требуется приёмка',
      botUsername: 'id056001679003_bot',
      ticketId: 'ticket-1',
      kind: 'acceptance',
    });

    expect(comment.attachments?.[0]?.payload.buttons[0]?.[0]).toMatchObject({
      type: 'open_app',
      text: 'Открыть комментарий',
      web_app: 'id056001679003_bot',
      payload: 'ticket_ticket-1',
    });
    expect(acceptance.attachments?.[0]?.payload.buttons[0]?.[0]).toMatchObject({
      type: 'open_app',
      text: 'Открыть приёмку',
      web_app: 'id056001679003_bot',
      payload: 'ticket_ticket-1',
    });
  });

  it('does not render a button when a ticket id cannot become a safe startapp payload', () => {
    const message = renderTicketNavigationMessage({
      text: 'Новая заявка',
      botUsername: 'id056001679003_bot',
      ticketId: 'bad/id',
      kind: 'ticket',
    });
    expect(message.attachments).toBeUndefined();
  });
});

describe('help and command menu helpers', () => {
  it('keeps help button-first and non-mutating', () => {
    const message = renderHelpMessage('id056001679003_bot');
    const raw = JSON.stringify(message);
    expect(raw).toContain('open_app');
    expect(raw).toContain('"payload":"menu"');
    expect(raw).not.toMatch(/Принять|Отклонить|Взять|Назначить/);
  });

  it('registers only minimal compatibility commands', () => {
    expect(buildMinimalMaxBotCommands()).toEqual([
      { name: 'start', description: 'Открыть меню' },
      { name: 'menu', description: 'Показать меню' },
      { name: 'help', description: 'Помощь' },
    ]);
  });
});
