import { UserRole } from '@prisma/client'

import { PERMISSIONS_KEY } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'
import { ROLES_KEY } from '../common/roles.decorator'
import { FailureCausesController } from './failure-causes.controller'

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
})
