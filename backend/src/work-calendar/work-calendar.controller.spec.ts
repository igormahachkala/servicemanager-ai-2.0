import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyType, UserRole } from '@prisma/client';

import { ROLE_GRANTS } from '../common/permissions-matrix';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../common/permissions.constants';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import {
  hasAnyPermission,
  PermissionsGuard,
} from '../common/permissions.guard';
import { ROLES_KEY } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { TicketsController } from '../tickets/tickets.controller';
import { WorkCalendarController } from './work-calendar.controller';

/**
 * SMA-WORK-CALENDAR-V1 — доступ к маршруту GET /work-calendar.
 *
 * Guard'ы настоящие; права решаются матрицей ROLE_GRANTS через тот же расчёт,
 * что у PermissionsGuard, а не списком в тесте.
 */

/** Метод класса как ключ метаданных — без отрыва от this. */
const methodOf = (proto: object, name: string) =>
  Object.getOwnPropertyDescriptor(proto, name)?.value as (
    ...args: unknown[]
  ) => unknown;

const handler = methodOf(WorkCalendarController.prototype, 'getCalendar');
const reflector = new Reflector();

function contextFor(user: { id: string; role: UserRole; companyId: string }) {
  return {
    getHandler: () => handler,
    getClass: () => WorkCalendarController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

/** Фейковая БД прав, наполненная матрицей ROLE_GRANTS. */
function grantsPrisma(companyTypes: Record<string, CompanyType>) {
  const matches = (where: {
    role: UserRole;
    OR: Array<{ companyType: CompanyType | null }>;
    permissionBlock: { code: { in: PermissionCode[] } };
  }) =>
    ROLE_GRANTS.some(
      (grant) =>
        grant.role === where.role &&
        where.OR.some(
          (option) => (grant.companyType ?? null) === option.companyType,
        ) &&
        grant.codes.some((code) =>
          where.permissionBlock.code.in.includes(code),
        ),
    );
  return {
    permissionBlock: { count: () => Promise.resolve(1) },
    company: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          companyTypes[where.id] ? { type: companyTypes[where.id] } : null,
        ),
    },
    rolePermission: {
      findFirst: ({ where }: { where: Parameters<typeof matches>[0] }) =>
        Promise.resolve(matches(where) ? { id: 'grant' } : null),
    },
    userPermission: { findFirst: () => Promise.resolve(null) },
  } as never;
}

describe('SMA-WORK-CALENDAR-V1 роли GET /work-calendar', () => {
  it('роли маршрута — те же, что у GET /tickets/board, включая CLIENT_ADMIN', () => {
    const calendarRoles = reflector.get<UserRole[]>(ROLES_KEY, handler);
    const boardRoles = reflector.get<UserRole[]>(
      ROLES_KEY,
      methodOf(TicketsController.prototype, 'board'),
    );
    expect([...calendarRoles].sort()).toEqual([...boardRoles].sort());
    expect(calendarRoles).toContain(UserRole.CLIENT_ADMIN);
  });

  it('RolesGuard пропускает CLIENT_ADMIN и не пропускает роль вне списка', () => {
    const guard = new RolesGuard(reflector);
    expect(
      guard.canActivate(
        contextFor({ id: 'u', role: UserRole.CLIENT_ADMIN, companyId: 'c' }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        contextFor({ id: 'u', role: UserRole.STAFF, companyId: 'c' }),
      ),
    ).toBe(false);
  });

  it('маршрут требует TICKETS_VIEW, и только его', () => {
    expect(reflector.get<PermissionCode[]>(PERMISSIONS_KEY, handler)).toEqual([
      PERMISSIONS.TICKETS_VIEW,
    ]);
  });
});

describe('SMA-WORK-CALENDAR-V1 права CLIENT_ADMIN', () => {
  const prisma = grantsPrisma({
    'wc-client-co': CompanyType.CLIENT,
    'wc-provider-co': CompanyType.PROVIDER,
  });
  const clientAdmin = {
    id: 'u-ca',
    role: UserRole.CLIENT_ADMIN,
    companyId: 'wc-client-co',
  };

  it('CLIENT_ADMIN клиентской компании проходит PermissionsGuard по TICKETS_VIEW', async () => {
    const guard = new PermissionsGuard(reflector, prisma);
    await expect(guard.canActivate(contextFor(clientAdmin))).resolves.toBe(
      true,
    );
  });

  it('CLIENT_ADMIN в компании-провайдере грантов не имеет: отказ', async () => {
    const guard = new PermissionsGuard(reflector, prisma);
    await expect(
      guard.canActivate(
        contextFor({ ...clientAdmin, companyId: 'wc-provider-co' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('LOCATIONS_VIEW у CLIENT_ADMIN нет: обходы и справочник объектов закрыты', async () => {
    await expect(
      hasAnyPermission(prisma, clientAdmin, [PERMISSIONS.LOCATIONS_VIEW]),
    ).resolves.toBe(false);
    await expect(
      hasAnyPermission(prisma, clientAdmin, [PERMISSIONS.TICKETS_VIEW]),
    ).resolves.toBe(true);
  });
});

describe('SMA-WORK-CALENDAR-V1 контроллер передаёт актора как есть', () => {
  it('роль и компания берутся из токена, а не из запроса', async () => {
    const getCalendar = jest.fn().mockResolvedValue({});
    const controller = new WorkCalendarController({ getCalendar } as never);

    await controller.getCalendar(
      {
        user: {
          id: 'u-ca',
          role: UserRole.CLIENT_ADMIN,
          companyId: 'wc-client-co',
        },
      },
      '2026-10-26',
      '2026-11-02',
      'Europe/Moscow',
      'client-2',
      'client-3',
    );

    expect(getCalendar).toHaveBeenCalledWith(
      {
        companyId: 'wc-client-co',
        id: 'u-ca',
        role: UserRole.CLIENT_ADMIN,
        accessFlags: undefined,
      },
      expect.objectContaining({
        linkedClientCompanyId: 'client-2',
        companyId: 'client-3',
      }),
    );
  });
});
