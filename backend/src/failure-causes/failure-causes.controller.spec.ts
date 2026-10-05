import { type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CompanyType, UserRole } from '@prisma/client'

import { PERMISSIONS_KEY } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'
import { ROLE_GRANTS } from '../common/permissions-matrix'
import { PermissionsGuard } from '../common/permissions.guard'
import { ROLES_KEY } from '../common/roles.decorator'
import { FailureCausesController } from './failure-causes.controller'

function permissionContext(method: keyof FailureCausesController): ExecutionContext {
  return {
    getHandler: () => FailureCausesController.prototype[method],
    getClass: () => FailureCausesController,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: 'client-admin-1',
          role: UserRole.CLIENT_ADMIN,
          companyId: 'failure-causes-client-company',
        },
      }),
    }),
  } as unknown as ExecutionContext
}

function effectivePbacPrisma() {
  return {
    permissionBlock: { count: jest.fn().mockResolvedValue(15) },
    company: {
      findUnique: jest.fn().mockResolvedValue({ type: CompanyType.CLIENT }),
    },
    rolePermission: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const grant = ROLE_GRANTS.find(
          (entry) =>
            entry.role === where.role &&
            (entry.companyType === CompanyType.CLIENT || entry.companyType === null) &&
            entry.codes.some((code) => where.permissionBlock.code.in.includes(code)),
        )
        return Promise.resolve(grant ? { id: 'effective-role-grant' } : null)
      }),
    },
    userPermission: { findFirst: jest.fn().mockResolvedValue(null) },
  }
}

describe('FailureCausesController management admission', () => {
  const managementMethods = ['create', 'update', 'setStatus'] as const

  it('admits CLIENT_ADMIN on dictionary read while keeping TICKETS_VIEW PBAC', () => {
    const handler = FailureCausesController.prototype.listOwn

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.ADMIN,
      UserRole.CLIENT_ADMIN,
      UserRole.MASTER,
      UserRole.DISPATCHER,
      UserRole.NETWORK_DIRECTOR,
      UserRole.TECHNICIAN,
      UserRole.CLIENT,
      UserRole.TERRITORIAL_MANAGER,
    ])
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      PERMISSIONS.TICKETS_VIEW,
    ])
  })

  it.each(managementMethods)('%s admits only canonical client management roles and keeps PBAC required', (method) => {
    const handler = FailureCausesController.prototype[method]

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
      UserRole.ADMIN,
      UserRole.CLIENT_ADMIN,
    ])
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      PERMISSIONS.COMPANY_SETTINGS_EDIT,
    ])
  })

  it('does not expose dictionary mutations to non-management roles through @Roles', () => {
    const forbiddenRoles = [
      UserRole.CLIENT,
      UserRole.TECHNICIAN,
      UserRole.MASTER,
      UserRole.DISPATCHER,
      UserRole.NETWORK_DIRECTOR,
      UserRole.TERRITORIAL_MANAGER,
      UserRole.PLATFORM_ADMIN,
    ]

    for (const method of managementMethods) {
      const roles = Reflect.getMetadata(ROLES_KEY, FailureCausesController.prototype[method]) ?? []
      for (const role of forbiddenRoles) {
        expect(roles).not.toContain(role)
      }
    }
  })

  it('allows CLIENT_ADMIN to read through effective PBAC without granting dictionary writes', async () => {
    const prisma = effectivePbacPrisma()
    const guard = new PermissionsGuard(new Reflector(), prisma as any)

    await expect(guard.canActivate(permissionContext('listOwn'))).resolves.toBe(true)

    for (const method of managementMethods) {
      await expect(guard.canActivate(permissionContext(method))).rejects.toMatchObject({
        response: {
          code: 'PERMISSION_DENIED',
          message: `Missing permission: ${PERMISSIONS.COMPANY_SETTINGS_EDIT}`,
        },
      })
    }
  })
})
