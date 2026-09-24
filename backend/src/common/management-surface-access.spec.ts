import { ForbiddenException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { ManagementSurfaceGuard, canAccessManagementSurface } from './management-surface-access'

describe('management surface access', () => {
  it.each([
    [UserRole.ADMIN, CompanyType.CLIENT],
    [UserRole.CLIENT_ADMIN, CompanyType.CLIENT],
    [UserRole.ADMIN, CompanyType.PROVIDER],
    [UserRole.DISPATCHER, CompanyType.PROVIDER],
    [UserRole.MASTER, CompanyType.PROVIDER],
    [UserRole.PLATFORM_ADMIN, null],
  ])('allows %s in %s', (role, companyType) => {
    expect(canAccessManagementSurface({ role, companyType })).toBe(true)
  })

  it.each([
    [UserRole.NETWORK_DIRECTOR, CompanyType.CLIENT],
    [UserRole.TERRITORIAL_MANAGER, CompanyType.CLIENT],
    [UserRole.TECHNICIAN, CompanyType.PROVIDER],
    [UserRole.STAFF, CompanyType.PROVIDER],
    [UserRole.CLIENT, CompanyType.CLIENT],
    [UserRole.MASTER, CompanyType.CLIENT],
    [UserRole.ADMIN, null],
  ])('denies %s in %s', (role, companyType) => {
    expect(canAccessManagementSurface({ role, companyType })).toBe(false)
  })

  it('fails closed when the actor company cannot be resolved', async () => {
    const prisma = { company: { findUnique: jest.fn().mockResolvedValue(null) } } as any
    const guard = new ManagementSurfaceGuard(prisma)
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: UserRole.ADMIN, companyId: 'missing' } }),
      }),
    } as any

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it.each([
    [UserRole.ADMIN, CompanyType.CLIENT, true],
    [UserRole.CLIENT_ADMIN, CompanyType.CLIENT, true],
    [UserRole.ADMIN, CompanyType.PROVIDER, true],
    [UserRole.DISPATCHER, CompanyType.PROVIDER, true],
    [UserRole.MASTER, CompanyType.PROVIDER, true],
    [UserRole.NETWORK_DIRECTOR, CompanyType.CLIENT, false],
    [UserRole.TERRITORIAL_MANAGER, CompanyType.CLIENT, false],
    [UserRole.TECHNICIAN, CompanyType.PROVIDER, false],
    [UserRole.STAFF, CompanyType.PROVIDER, false],
    [UserRole.CLIENT, CompanyType.CLIENT, false],
  ])('enforces the API gate for %s in %s', async (role, companyType, allowed) => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ type: companyType }) },
    } as any
    const guard = new ManagementSurfaceGuard(prisma)
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role, companyId: 'company-1' } }),
      }),
    } as any

    if (allowed) {
      await expect(guard.canActivate(context)).resolves.toBe(true)
    } else {
      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: {
          code: 'MANAGEMENT_SURFACE_ACCESS_DENIED',
          message: 'Управленческая часть недоступна для вашей роли.',
        },
      })
    }
  })
})
