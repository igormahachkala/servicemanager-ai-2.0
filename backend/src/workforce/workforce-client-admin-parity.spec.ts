import 'reflect-metadata'
import { CompanyType, UserRole } from '@prisma/client'
import { Reflector } from '@nestjs/core'

import { PERMISSIONS } from '../common/permissions.constants'
import { ROLES_KEY } from '../common/roles.decorator'
import { PERMISSIONS_KEY } from '../common/permissions.decorator'
import { ROLE_GRANTS } from '../common/permissions-matrix'
import { ManagementSurfaceGuard, canAccessManagementSurface } from '../common/management-surface-access'

import { WorkforceController } from './workforce.controller'

/**
 * SMA-WORKFORCE-CLIENT-ADMIN-FRESH-RECONCILIATION-122F.
 *
 * CLIENT_ADMIN получает чтение Workforce своей компании — и ничего сверх этого.
 *
 * Проверяется не «видна ли кнопка», а решение бэкенда: доступ к маршруту есть
 * пересечение трёх независимых условий — перечень ролей, шлюз управления
 * и каноническое право. Интерфейс на это решение не влияет, поэтому скрытая
 * в меню ссылка никого не пускает, а показанная — никому не даёт прав.
 */

const reflector = new Reflector()

/**
 * Требования маршрута читаются с самого контроллера, а не переписываются здесь:
 * иначе проверка описывала бы намерение автора теста, а не то, что развёрнуто.
 * Шлюз управления навешен охранником, а не метаданными, поэтому ищется в списке
 * охранников метода.
 */
function routeRequirements(method: keyof WorkforceController) {
  const handler = WorkforceController.prototype[method] as any
  const guards: unknown[] = Reflect.getMetadata('__guards__', handler) ?? []
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

/**
 * Полное решение по маршруту: так его принимают охранники Nest —
 * RolesGuard, ManagementSurfaceGuard и PermissionsGuard, каждый независимо.
 */
function canReachRoute(
  method: keyof WorkforceController,
  actor: { role: UserRole; companyType: CompanyType },
): boolean {
  const route = routeRequirements(method)
  if (route.roles.length > 0 && !route.roles.includes(actor.role)) return false
  if (route.managementSurface && !canAccessManagementSurface({ role: actor.role, companyType: actor.companyType })) {
    return false
  }
  const granted = grantedCodes(actor.role, actor.companyType)
  if (route.permissions.length > 0 && !route.permissions.every((code) => granted.includes(code))) return false
  return true
}

const CLIENT_ADMIN = { role: UserRole.CLIENT_ADMIN, companyType: CompanyType.CLIENT }
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

describe('122F CLIENT_ADMIN: чтение Workforce своей компании', () => {
  it('1. получает ровно одно право и только на чтение', () => {
    expect(grantedCodes(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).toEqual([PERMISSIONS.WORKFORCE_VIEW])
    // Права записи роли не выдаются ни одним грантом.
    for (const write of [PERMISSIONS.WORKFORCE_SHIFT_USE, PERMISSIONS.USERS_MANAGE]) {
      expect(grantedCodes(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).not.toContain(write)
    }
  })

  it('1. читающие маршруты Workforce открыты', () => {
    for (const route of READ_ROUTES) {
      expect({ route, reachable: canReachRoute(route, CLIENT_ADMIN) }).toEqual({ route, reachable: true })
    }
  })

})

describe('122F CLIENT_ADMIN: записи закрыты', () => {
  it.each(WRITE_ROUTES)('3, 11. маршрут записи %s недоступен', (route) => {
    expect(canReachRoute(route, CLIENT_ADMIN)).toBe(false)
  })

  it('9. отказ по записи не зависит от интерфейса', () => {
    /*
     * Ключевое свойство: запрет живёт на маршруте, а не в разметке. Даже если
     * фронтенд покажет кнопку — прямой запрос всё равно не пройдёт, потому что
     * решение принимают охранники, а не страница.
     */
    for (const route of WRITE_ROUTES) {
      const req = routeRequirements(route)
      const granted = grantedCodes(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)
      const blockedByRole = req.roles.length > 0 && !req.roles.includes(UserRole.CLIENT_ADMIN)
      const blockedByPermission =
        req.permissions.length > 0 && !req.permissions.every((code) => granted.includes(code))
      expect({ route, blocked: blockedByRole || blockedByPermission }).toEqual({ route, blocked: true })
    }
  })
})

describe('122F ничьи права не расширены', () => {
  it('4. поставщик клиентского Workforce не получает', () => {
    // Провайдерские роли читают Workforce СВОЕЙ компании и остаются при ней:
    // сервис берёт actor.companyId, а грант провайдера ничего про клиента не знает.
    expect(canReachRoute('list', PROVIDER_ADMIN)).toBe(true)
    expect(grantedCodes(UserRole.ADMIN, CompanyType.PROVIDER)).toContain(PERMISSIONS.WORKFORCE_VIEW)
    // Ни один грант не выдан «поставщику в компании-клиенте».
    expect(ROLE_GRANTS.some((g) => g.role === UserRole.ADMIN && g.companyType === null)).toBe(false)
  })

  it.each([
    ['5. NETWORK_DIRECTOR', NETWORK_DIRECTOR],
    ['6. TERRITORIAL_MANAGER', TERRITORIAL],
  ])('%s остаётся закрыт шлюзом управления', (_label, actor) => {
    // Роль и право у них есть исторически, а шлюз управления — нет.
    // Эта задача ничего из этого не меняет.
    expect(routeRequirements('list').roles).toContain(actor.role)
    expect(grantedCodes(actor.role, actor.companyType)).toContain(PERMISSIONS.WORKFORCE_VIEW)
    expect(canAccessManagementSurface(actor)).toBe(false)
    expect(canReachRoute('list', actor)).toBe(false)
  })

  it('7. TECHNICIAN десктопный Workforce не получает', () => {
    expect(canReachRoute('list', PROVIDER_TECH)).toBe(false)
    expect(canReachRoute('getShift', PROVIDER_TECH)).toBe(false)
    // Своя смена у техника остаётся — это другой маршрут и другое право.
    expect(canReachRoute('getMyState', PROVIDER_TECH)).toBe(true)
  })

  it.each([
    ['8. обычный CLIENT', ORDINARY_CLIENT],
    ['8. STAFF', STAFF],
  ])('%s доступа не получает только из-за компании-клиента', (_label, actor) => {
    expect(canReachRoute('list', actor)).toBe(false)
    expect(grantedCodes(actor.role, actor.companyType)).not.toContain(PERMISSIONS.WORKFORCE_VIEW)
  })

  it('CLIENT_ADMIN не получил доступа шире, чем у ADMIN клиента', () => {
    for (const route of [...READ_ROUTES, ...WRITE_ROUTES]) {
      if (canReachRoute(route, CLIENT_ADMIN)) {
        expect({ route, adminToo: canReachRoute(route, CLIENT_OWN_ADMIN) }).toEqual({ route, adminToo: true })
      }
    }
  })
})

describe('122F изоляция компаний', () => {
  it('2, 9. чужая компания недостижима: параметр запроса не меняет охват', () => {
    /*
     * Сужение уже каноническое: listWorkforce берёт observerCompanyId только
     * у PLATFORM_ADMIN, всем остальным подставляет actor.companyId. Здесь это
     * закрепляется, чтобы правка охвата не прошла незамеченной.
     */
    const source = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'workforce.service.ts'),
      'utf8',
    ) as string
    const scope = source.slice(source.indexOf('async listWorkforce'))
    const decision = scope.slice(0, scope.indexOf('\n\n'))
    expect(decision).toContain('UserRole.PLATFORM_ADMIN')
    expect(decision).toContain('params.actor.companyId')
    // Параметр клиента не может стать охватом сам по себе.
    expect(decision).not.toMatch(/observerCompanyId\s*\?\?\s*params\.actor\.companyId/)
  })
})
