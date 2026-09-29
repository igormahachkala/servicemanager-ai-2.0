import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/roles.decorator';
import { NotificationsController } from './notifications.controller';

function roles(method: keyof NotificationsController): UserRole[] {
  return (
    Reflect.getMetadata(ROLES_KEY, NotificationsController.prototype[method]) ??
    []
  );
}

describe('117O notification route roles', () => {
  it.each(['list', 'unreadCount', 'markAllRead', 'markOneRead'] as const)(
    'allows CLIENT_ADMIN to use %s',
    (method) => {
      expect(roles(method)).toContain(UserRole.CLIENT_ADMIN);
    },
  );

  it.each(['getPreferences', 'updatePreference', 'clearPreference'] as const)(
    'keeps %s personal and outside PLATFORM_ADMIN',
    (method) => {
      expect(roles(method)).toContain(UserRole.CLIENT_ADMIN);
      expect(roles(method)).not.toContain(UserRole.PLATFORM_ADMIN);
    },
  );
});
