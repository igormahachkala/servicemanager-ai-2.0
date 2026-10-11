import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CompanyType, UserRole } from '@prisma/client';

import { MaterialsController } from './materials.controller';
import { MaterialsProviderAccessGuard } from './materials-provider-access';

function contextFor(role: UserRole, companyId = 'actor-company') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { id: 'actor', role, companyId },
        query: { companyId: 'foreign-company' },
      }),
    }),
  } as any;
}

describe('Materials provider access', () => {
  it.each([
    UserRole.ADMIN,
    UserRole.MASTER,
    UserRole.DISPATCHER,
    UserRole.TECHNICIAN,
  ])('allows provider %s without widening its role capabilities', async (role) => {
    const prisma = {
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ type: CompanyType.PROVIDER }),
      },
    } as any;
    const guard = new MaterialsProviderAccessGuard(prisma);

    await expect(guard.canActivate(contextFor(role))).resolves.toBe(true);
    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'actor-company' },
      select: { type: true },
    });
  });

  it.each([
    UserRole.ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.CLIENT,
  ])('denies client-company %s', async (role) => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ type: CompanyType.CLIENT }),
      },
    } as any;
    const guard = new MaterialsProviderAccessGuard(prisma);

    await expect(guard.canActivate(contextFor(role))).rejects.toMatchObject({
      response: {
        code: 'MATERIALS_PROVIDER_ACCESS_DENIED',
      },
    });
  });

  it('fails closed for an unresolved or foreign actor company', async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const guard = new MaterialsProviderAccessGuard(prisma);

    await expect(
      guard.canActivate(contextFor(UserRole.ADMIN, 'foreign-company')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    'list',
    'create',
    'update',
    'getMyBalances',
    'getMyMovements',
    'purchase',
    'consume',
    'getTechnicianBalances',
    'getTechnicianMovements',
    'issue',
    'receiptToCompanyStock',
  ] as const)('enforces the provider contour on %s', (method) => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MaterialsController.prototype[method],
    );

    expect(guards).toContain(MaterialsProviderAccessGuard);
  });

  it('keeps technician access personal and management writes role-gated', () => {
    const personalRoles = Reflect.getMetadata(
      'roles',
      MaterialsController.prototype.getMyBalances,
    );
    const managementRoles = Reflect.getMetadata(
      'roles',
      MaterialsController.prototype.create,
    );

    expect(personalRoles).toEqual([UserRole.TECHNICIAN]);
    expect(managementRoles).toEqual(
      expect.arrayContaining([
        UserRole.ADMIN,
        UserRole.MASTER,
        UserRole.DISPATCHER,
      ]),
    );
    expect(managementRoles).not.toContain(UserRole.TECHNICIAN);
    expect(managementRoles).not.toContain(UserRole.CLIENT_ADMIN);
    expect(managementRoles).not.toContain(UserRole.CLIENT);
  });

  it('leaves ticket material history on the canonical ticket access path', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        MaterialsController.prototype.getTicketConsumptions,
      ) ?? [];

    expect(guards).not.toContain(MaterialsProviderAccessGuard);
  });
});
