import { CompanyType, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import {
  buildMenuModel,
  buildUnboundMenuModel,
  renderMenuText,
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
  it('offers only linking and help', () => {
    const model = buildUnboundMenuModel();
    expect(model.unbound).toBe(true);
    expect(model.items.map((i) => i.id)).toEqual(['link_account', 'help']);
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
  it('renders every item as a line', () => {
    const model = buildMenuModel(CLIENT_ADMIN);
    const text = renderMenuText(model);
    for (const item of model.items) expect(text).toContain(item.label);
  });

  it('tells an unbound viewer how to link and shows no ticket wording', () => {
    const text = renderMenuText(buildUnboundMenuModel());
    expect(text).toContain('Привязать аккаунт');
    expect(text).not.toContain('Мои заявки');
  });
});
