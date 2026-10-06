import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { CompanyType, UserRole } from '@prisma/client'

import { ManagementSurfaceGuard, canAccessManagementSurface } from '../common/management-surface-access'
import { PERMISSIONS_KEY } from '../common/permissions.decorator'
import { PERMISSIONS } from '../common/permissions.constants'
import { ROLE_GRANTS } from '../common/permissions-matrix'
import { ROLES_KEY } from '../common/roles.decorator'
import { WorkforceController } from './workforce.controller'

const reflector = new Reflector()

function routeRequirements(method: keyof WorkforceController) {
  const handler = WorkforceController.prototype[method] as any
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? []
  return {
    roles: (reflector.get<UserRole[]>(ROLES_KEY, handler) ?? []) as UserRole[],
    permissions: (reflector.get<string[]>(PERMISSIONS_KEY, handler) ?? []) as string[],
    managementSurface: guards.includes(ManagementSurfaceGuard as unknown as never),
  }
}

function grantedCodes(role: UserRole, companyType: CompanyType): string[] {
  return ROLE_GRANTS.filter(
    (grant) => grant.role === role && (grant.companyType === null || grant.companyType === companyType),
  ).flatMap((grant) => grant.codes)
}

function canReachRoute(
  method: keyof WorkforceController,
  actor: { role: UserRole; companyType: CompanyType },
): boolean {
  const route = routeRequirements(method)
  if (route.roles.length > 0 && !route.roles.includes(actor.role)) return false
  if (
    route.managementSurface &&
    !canAccessManagementSurface({ role: actor.role, companyType: actor.companyType })
  ) {
    return false
  }
  const granted = grantedCodes(actor.role, actor.companyType)
  if (route.permissions.length > 0 && !route.permissions.some((code) => granted.includes(code))) return false
  return true
}

const CLIENT_ADMIN = { role: UserRole.CLIENT_ADMIN, companyType: CompanyType.CLIENT }
const CLIENT_ADMIN_PROVIDER = { role: UserRole.CLIENT_ADMIN, companyType: CompanyType.PROVIDER }
const CLIENT_OWN_ADMIN = { role: UserRole.ADMIN, companyType: CompanyType.CLIENT }
const PROVIDER_ADMIN = { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER }
const PROVIDER_TECH = { role: UserRole.TECHNICIAN, companyType: CompanyType.PROVIDER }
const NETWORK_DIRECTOR = { role: UserRole.NETWORK_DIRECTOR, companyType: CompanyType.CLIENT }
const TERRITORIAL = { role: UserRole.TERRITORIAL_MANAGER, companyType: CompanyType.CLIENT }
const ORDINARY_CLIENT = { role: UserRole.CLIENT, companyType: CompanyType.CLIENT }
const STAFF = { role: UserRole.STAFF, companyType: CompanyType.CLIENT }

const READ_ROUTES: Array<keyof WorkforceController> = ['list', 'getShift']
const WRITE_ROUTES: Array<keyof WorkforceController> = [
  'openShift',
  'closeShift',
  'startTicketWork',
  'stopTicketWork',
  'createShiftCorrection',
  'updateSettings',
]
const WORKFORCE_ROUTES: Array<keyof WorkforceController> = [
  'getMyState',
  'openShift',
  'closeShift',
  'startTicketWork',
  'stopTicketWork',
  'list',
  'createShiftCorrection',
  'getShift',
  'updateSettings',
]

function routeLabel(method: keyof WorkforceController) {
  const handler = WorkforceController.prototype[method] as any
  const controllerPath = Reflect.getMetadata(PATH_METADATA, WorkforceController) as string
  const routePath = Reflect.getMetadata(PATH_METADATA, handler) as string
  const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
  return {
    controllerMethod: method,
    httpMethod: RequestMethod[requestMethod],
    path: `/${[controllerPath, routePath].filter(Boolean).join('/')}`,
  }
}

describe('CLIENT_ADMIN Workforce read parity', () => {
  it('adds only WORKFORCE_VIEW to the existing CLIENT_ADMIN client grant', () => {
    expect(grantedCodes(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).toEqual([
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.WORKFORCE_VIEW,
    ])
    expect(grantedCodes(UserRole.CLIENT_ADMIN, CompanyType.PROVIDER)).toEqual([])
    expect(
      ROLE_GRANTS.some((grant) => grant.role === UserRole.CLIENT_ADMIN && grant.companyType === null),
    ).toBe(false)

    for (const forbidden of [
      PERMISSIONS.WORKFORCE_SHIFT_USE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.COMPANY_SETTINGS_EDIT,
      PERMISSIONS.LOCATIONS_MANAGE,
      PERMISSIONS.TICKETS_EDIT,
    ]) {
      expect(grantedCodes(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).not.toContain(forbidden)
    }
  })

  it('admits CLIENT_ADMIN only on the two read routes', () => {
    const admitted = WORKFORCE_ROUTES.filter((route) =>
      routeRequirements(route).roles.includes(UserRole.CLIENT_ADMIN),
    ).map(routeLabel)

    expect(admitted).toEqual([
      { controllerMethod: 'list', httpMethod: 'GET', path: '/workforce/shifts' },
      { controllerMethod: 'getShift', httpMethod: 'GET', path: '/workforce/shifts/:shiftId' },
    ])
  })

  it('opens list and detail through existing role, surface and PBAC gates', () => {
    for (const route of READ_ROUTES) {
      expect({ route, reachable: canReachRoute(route, CLIENT_ADMIN) }).toEqual({
        route,
        reachable: true,
      })
    }
  })

  it.each(WRITE_ROUTES)('keeps write route %s closed to CLIENT_ADMIN', (route) => {
    expect(routeRequirements(route).roles).not.toContain(UserRole.CLIENT_ADMIN)
    expect(canReachRoute(route, CLIENT_ADMIN)).toBe(false)
  })

  it('does not create provider CLIENT_ADMIN or provider/client widening', () => {
    expect(canReachRoute('list', CLIENT_ADMIN_PROVIDER)).toBe(false)
    expect(canReachRoute('getShift', CLIENT_ADMIN_PROVIDER)).toBe(false)
    expect(canReachRoute('list', PROVIDER_ADMIN)).toBe(true)
    expect(grantedCodes(UserRole.ADMIN, CompanyType.PROVIDER)).toContain(PERMISSIONS.WORKFORCE_VIEW)
  })

  it.each([
    ['NETWORK_DIRECTOR', NETWORK_DIRECTOR],
    ['TERRITORIAL_MANAGER', TERRITORIAL],
  ])('keeps %s closed by management-surface policy', (_label, actor) => {
    expect(routeRequirements('list').roles).toContain(actor.role)
    expect(grantedCodes(actor.role, actor.companyType)).toContain(PERMISSIONS.WORKFORCE_VIEW)
    expect(canAccessManagementSurface(actor)).toBe(false)
    expect(canReachRoute('list', actor)).toBe(false)
  })

  it('keeps TECHNICIAN on self shift routes only', () => {
    expect(canReachRoute('getMyState', PROVIDER_TECH)).toBe(true)
    expect(canReachRoute('list', PROVIDER_TECH)).toBe(false)
    expect(canReachRoute('getShift', PROVIDER_TECH)).toBe(false)
  })

  it.each([
    ['ordinary CLIENT', ORDINARY_CLIENT],
    ['STAFF', STAFF],
  ])('does not open Workforce to %s', (_label, actor) => {
    expect(canReachRoute('list', actor)).toBe(false)
    expect(grantedCodes(actor.role, actor.companyType)).not.toContain(PERMISSIONS.WORKFORCE_VIEW)
  })

  it('does not give CLIENT_ADMIN a route that client ADMIN lacks', () => {
    for (const route of [...READ_ROUTES, ...WRITE_ROUTES]) {
      if (canReachRoute(route, CLIENT_ADMIN)) {
        expect({ route, adminToo: canReachRoute(route, CLIENT_OWN_ADMIN) }).toEqual({
          route,
          adminToo: true,
        })
      }
    }
  })
})
