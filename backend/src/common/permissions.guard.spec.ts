import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CompanyType, UserRole } from '@prisma/client';

import { PERMISSIONS } from './permissions.constants';
import { PermissionsGuard } from './permissions.guard';

function makeContext(user: { id?: string; role?: UserRole | string; companyId?: string } | undefined): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function makePrisma(params?: {
  blocksCount?: number;
  companyType?: CompanyType | null;
  roleHit?: { id: string } | null;
  userHit?: { id: string } | null;
}) {
  return {
    permissionBlock: {
      count: jest.fn().mockResolvedValue(params?.blocksCount ?? 1),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue(
        params?.companyType === null
          ? null
          : {
              type: params?.companyType ?? CompanyType.PROVIDER,
            },
      ),
    },
    rolePermission: {
      findFirst: jest.fn().mockResolvedValue(params?.roleHit ?? null),
    },
    userPermission: {
      findFirst: jest.fn().mockResolvedValue(params?.userHit ?? null),
    },
  };
}

describe('PermissionsGuard', () => {
  it('allows routes without required permissions without reading PBAC tables', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const prisma = makePrisma();
    const guard = new PermissionsGuard(reflector, prisma as any);

    await expect(guard.canActivate(makeContext({ id: 'user-1', role: UserRole.ADMIN, companyId: 'company-1' }))).resolves.toBe(true);
    expect(prisma.permissionBlock.count).not.toHaveBeenCalled();
  });

  it('fails closed for a protected endpoint when PermissionBlock catalog is empty', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.TICKETS_VIEW]),
    } as unknown as Reflector;
    const prisma = makePrisma({ blocksCount: 0 });
    const guard = new PermissionsGuard(reflector, prisma as any);

    await expect(
      guard.canActivate(makeContext({ id: 'user-1', role: UserRole.ADMIN, companyId: 'company-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);

    try {
      await guard.canActivate(makeContext({ id: 'user-1', role: UserRole.ADMIN, companyId: 'company-1' }));
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: 'PBAC_NOT_INITIALIZED',
        message: 'PBAC permission blocks are not initialized.',
      });
    }

    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled();
    expect(prisma.userPermission.findFirst).not.toHaveBeenCalled();
  });

  it('allows a protected endpoint when a matching role grant exists', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.TICKETS_VIEW]),
    } as unknown as Reflector;
    const prisma = makePrisma({ roleHit: { id: 'role-grant-1' } });
    const guard = new PermissionsGuard(reflector, prisma as any);

    await expect(guard.canActivate(makeContext({ id: 'user-1', role: UserRole.ADMIN, companyId: 'company-1' }))).resolves.toBe(true);
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'company-1' },
      select: { type: true },
    });
  });

  it('denies a protected endpoint when PBAC is initialized but no grant matches', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([PERMISSIONS.TICKETS_ASSIGN]),
    } as unknown as Reflector;
    const prisma = makePrisma();
    const guard = new PermissionsGuard(reflector, prisma as any);

    await expect(
      guard.canActivate(makeContext({ id: 'user-1', role: UserRole.TECHNICIAN, companyId: 'company-1' })),
    ).rejects.toMatchObject({
      response: {
        code: 'PERMISSION_DENIED',
        message: `Missing permission: ${PERMISSIONS.TICKETS_ASSIGN}`,
      },
    });
  });
});
