/**
 * Метаданные контроллера: кто допущен к чтению и к ведению.
 * Проверяется то, что Nest реально прочитает, а не текст исходника.
 */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { ManagementSurfaceGuard } from '../common/management-surface-access';
import { ROLES_KEY } from '../common/roles.decorator';
import { ProductUpdatesController } from './product-updates.controller';

const proto = ProductUpdatesController.prototype as any;
const MANAGE = [
  'listManaged',
  'create',
  'update',
  'publish',
  'unpublish',
  'removeDraft',
];
const READ = ['listPublished', 'getPublished'];

describe('ProductUpdatesController — доступ', () => {
  it('весь контроллер за JwtAuthGuard', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProductUpdatesController),
    ).toContain(JwtAuthGuard);
  });

  it.each(MANAGE)(
    '%s: только PLATFORM_ADMIN и ADMIN через ManagementSurfaceGuard',
    (method) => {
      expect(Reflect.getMetadata(ROLES_KEY, proto[method])).toEqual([
        UserRole.PLATFORM_ADMIN,
        UserRole.ADMIN,
      ]);
      expect(Reflect.getMetadata(GUARDS_METADATA, proto[method])).toContain(
        ManagementSurfaceGuard,
      );
    },
  );

  it.each(READ)('%s: любой авторизованный, отбор делает сервис', (method) => {
    expect(Reflect.getMetadata(ROLES_KEY, proto[method])).toBeUndefined();
  });

  it('все методы контроллера учтены в одном из списков', () => {
    const methods = Object.getOwnPropertyNames(proto).filter(
      (m) => m !== 'constructor',
    );
    expect(methods.sort()).toEqual([...MANAGE, ...READ].sort());
  });
});
