import { ExecutionContext } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { UserRole } from '@prisma/client'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { ROLES_KEY } from '../common/roles.decorator'
import { RolesGuard } from '../common/roles.guard'
import { GeoAccuracyController } from './geo-accuracy.controller'

const methodOf = (name: string) =>
  Object.getOwnPropertyDescriptor(GeoAccuracyController.prototype, name)?.value as (
    ...args: unknown[]
  ) => unknown

describe('GET /platform/geo-accuracy/buckets access', () => {
  const reflector = new Reflector()
  const guard = new RolesGuard(reflector)
  const handler = methodOf('buckets')

  function contextFor(role: UserRole): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => GeoAccuracyController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', role, companyId: 'c' } }) }),
    } as unknown as ExecutionContext
  }

  it('keeps JwtAuthGuard and RolesGuard, and only PLATFORM_ADMIN', () => {
    expect(reflector.get(GUARDS_METADATA, GeoAccuracyController)).toEqual([JwtAuthGuard, RolesGuard])
    expect(reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [handler, GeoAccuracyController])).toEqual([
      UserRole.PLATFORM_ADMIN,
    ])
  })

  it('refuses a role other than PLATFORM_ADMIN', () => {
    expect(guard.canActivate(contextFor(UserRole.PLATFORM_ADMIN))).toBe(true)
    for (const role of Object.values(UserRole)) {
      if (role === UserRole.PLATFORM_ADMIN) continue
      expect(guard.canActivate(contextFor(role))).toBe(false)
    }
  })

  it('closes cells, settings read and settings write the same way', () => {
    for (const name of ['cells', 'getSettings', 'patchSettings']) {
      const method = methodOf(name)
      expect(reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [method, GeoAccuracyController])).toEqual([
        UserRole.PLATFORM_ADMIN,
      ])
      const context = {
        getHandler: () => method,
        getClass: () => GeoAccuracyController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'u', role: UserRole.ADMIN, companyId: 'c' } }),
        }),
      } as unknown as ExecutionContext
      expect(guard.canActivate(context)).toBe(false)
    }
  })
})
