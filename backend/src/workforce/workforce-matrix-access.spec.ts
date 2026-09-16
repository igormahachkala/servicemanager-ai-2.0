import { Reflector } from '@nestjs/core'
import { CompanyType, UserRole } from '@prisma/client'

import { canAccessManagementSurface } from '../common/management-surface-access'
import { PERMISSIONS } from '../common/permissions.constants'
import { ROLE_GRANTS } from '../common/permissions-matrix'
import { WorkforceController } from './workforce.controller'

/**
 * SMA-WORKFORCE-MATRIX-CLIENT-ADMIN-RECONCILIATION-117P.
 *
 * Доступ к месячному табелю — пересечение трёх условий: перечень ролей,
 * канонический шлюз управления 111A и право WORKFORCE_VIEW. Тесты держат
 * именно пересечение: пройти должен только тот, кто проходит все три.
 */

const reflector = new Reflector()

function endpointRoles(): UserRole[] {
  return reflector.get<UserRole[]>('roles', WorkforceController.prototype.matrix) ?? []
}

/** Право по роли из канонической матрицы грантов (без персональных UserPermission). */
function roleGrantsWorkforceView(role: UserRole, companyType: CompanyType): boolean {
  return ROLE_GRANTS.some(
    (grant) =>
      grant.role === role &&
      (grant.companyType === companyType || grant.companyType === null) &&
      grant.codes.includes(PERMISSIONS.WORKFORCE_VIEW),
  )
}

/** Итоговый вердикт без персональных прав: так отвечает Stage на канонических аккаунтах. */
function allowedByRoleGrantsOnly(role: UserRole, companyType: CompanyType): boolean {
  return (
    endpointRoles().includes(role) &&
    canAccessManagementSurface({ role, companyType }) &&
    roleGrantsWorkforceView(role, companyType)
  )
}

describe('117P перечень ролей месячного табеля', () => {
  it('CLIENT_ADMIN больше не отсекается перечнем ролей', () => {
    expect(endpointRoles()).toContain(UserRole.CLIENT_ADMIN)
  })

  it('перечень не расширен ни одной ролью сверх решения', () => {
    expect([...endpointRoles()].sort()).toEqual(
      [
        UserRole.PLATFORM_ADMIN,
        UserRole.ADMIN,
        UserRole.CLIENT_ADMIN,
        UserRole.MASTER,
        UserRole.DISPATCHER,
        UserRole.NETWORK_DIRECTOR,
        UserRole.TERRITORIAL_MANAGER,
      ].sort(),
    )
    expect(endpointRoles()).not.toContain(UserRole.TECHNICIAN)
    expect(endpointRoles()).not.toContain(UserRole.CLIENT)
    expect(endpointRoles()).not.toContain(UserRole.STAFF)
  })
})

describe('117P шлюз управления 111A не тронут', () => {
  it('в компании-клиенте допущены только ADMIN и CLIENT_ADMIN', () => {
    expect(canAccessManagementSurface({ role: UserRole.ADMIN, companyType: CompanyType.CLIENT })).toBe(true)
    expect(canAccessManagementSurface({ role: UserRole.CLIENT_ADMIN, companyType: CompanyType.CLIENT })).toBe(true)
    for (const role of [UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER, UserRole.CLIENT, UserRole.STAFF]) {
      expect(canAccessManagementSurface({ role, companyType: CompanyType.CLIENT })).toBe(false)
    }
  })

  it('у провайдера допущены ADMIN, DISPATCHER и MASTER', () => {
    for (const role of [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MASTER]) {
      expect(canAccessManagementSurface({ role, companyType: CompanyType.PROVIDER })).toBe(true)
    }
    expect(canAccessManagementSurface({ role: UserRole.TECHNICIAN, companyType: CompanyType.PROVIDER })).toBe(false)
  })
})

describe('117P итоговый доступ на канонических ролях', () => {
  it('CLIENT ADMIN проходит', () => {
    expect(allowedByRoleGrantsOnly(UserRole.ADMIN, CompanyType.CLIENT)).toBe(true)
  })

  it('PROVIDER ADMIN, DISPATCHER и MASTER проходят', () => {
    for (const role of [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MASTER]) {
      expect(allowedByRoleGrantsOnly(role, CompanyType.PROVIDER)).toBe(true)
    }
  })

  it('NETWORK_DIRECTOR и TERRITORIAL_MANAGER закрыты шлюзом, хотя право у них есть', () => {
    for (const role of [UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER]) {
      // Право есть — значит отказ даёт именно шлюз 111A, а не отсутствие гранта.
      expect(roleGrantsWorkforceView(role, CompanyType.CLIENT)).toBe(true)
      expect(canAccessManagementSurface({ role, companyType: CompanyType.CLIENT })).toBe(false)
      expect(allowedByRoleGrantsOnly(role, CompanyType.CLIENT)).toBe(false)
    }
  })

  it('TECHNICIAN, CLIENT и STAFF закрыты', () => {
    expect(allowedByRoleGrantsOnly(UserRole.TECHNICIAN, CompanyType.PROVIDER)).toBe(false)
    expect(allowedByRoleGrantsOnly(UserRole.CLIENT, CompanyType.CLIENT)).toBe(false)
    expect(allowedByRoleGrantsOnly(UserRole.STAFF, CompanyType.CLIENT)).toBe(false)
  })

  it('CLIENT_ADMIN проходит все три условия после 117T', () => {
    expect(endpointRoles()).toContain(UserRole.CLIENT_ADMIN)
    expect(canAccessManagementSurface({ role: UserRole.CLIENT_ADMIN, companyType: CompanyType.CLIENT })).toBe(true)
    // 117T выдал роли ролевой грант, поэтому персональное право больше не требуется.
    expect(roleGrantsWorkforceView(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).toBe(true)
    expect(allowedByRoleGrantsOnly(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).toBe(true)
  })

  it('гранты ролей без доступа остались нетронутыми', () => {
    expect(roleGrantsWorkforceView(UserRole.TECHNICIAN, CompanyType.PROVIDER)).toBe(false)
    expect(roleGrantsWorkforceView(UserRole.CLIENT, CompanyType.CLIENT)).toBe(false)
    expect(roleGrantsWorkforceView(UserRole.STAFF, CompanyType.CLIENT)).toBe(false)
    // 117T выдал CLIENT_ADMIN право на чтение Workforce — решение владельца.
    // Детали гранта закреплены в workforce-client-admin-parity.spec.ts.
    expect(roleGrantsWorkforceView(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).toBe(true)
  })
})

/* ── Арендная изоляция под актором CLIENT_ADMIN ───────────────────────── */

import { WorkforceService } from './workforce.service'

const CLIENT_ADMIN_ACTOR = {
  id: 'client-admin-1',
  companyId: 'client-co-1',
  role: UserRole.CLIENT_ADMIN,
}

function makeTenantPrisma() {
  return {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: CLIENT_ADMIN_ACTOR.id }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    company: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        name: 'Клиент',
        timezone: 'Asia/Yekaterinburg',
        shiftAutoCloseTime: '19:00',
      })),
    },
    workShift: { findMany: jest.fn().mockResolvedValue([]) },
  } as any
}

describe('117P аренда под CLIENT_ADMIN', () => {
  beforeEach(() => jest.clearAllMocks())

  it('чужой companyId не выводит из своей компании', async () => {
    const prisma = makeTenantPrisma()
    const result = await new WorkforceService(prisma, {} as any).getMonthlyMatrix({
      actor: CLIENT_ADMIN_ACTOR,
      month: '2026-09',
      observerCompanyId: 'foreign-co-999',
    })

    // Компания ответа — своя, а не запрошенная.
    expect(result.company.id).toBe('client-co-1')
    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'client-co-1' } }),
    )
    // И выборка смен тоже идёт по своей компании.
    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('client-co-1')
  })

  it('наблюдение за чужой компанией остаётся только у PLATFORM_ADMIN', async () => {
    const prisma = makeTenantPrisma()
    await new WorkforceService(prisma, {} as any).getMonthlyMatrix({
      actor: { ...CLIENT_ADMIN_ACTOR, role: UserRole.PLATFORM_ADMIN },
      month: '2026-09',
      observerCompanyId: 'foreign-co-999',
    })

    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'foreign-co-999' } }),
    )
  })

  it('чужой userId не открывает сотрудника другой компании', async () => {
    const prisma = makeTenantPrisma()
    await new WorkforceService(prisma, {} as any).getMonthlyMatrix({
      actor: CLIENT_ADMIN_ACTOR,
      month: '2026-09',
      userId: 'foreign-user-999',
    })

    // Реестр сужен и компанией, и идентификатором — чужой пользователь не совпадёт.
    const rosterWhere = prisma.user.findMany.mock.calls[0][0].where
    expect(rosterWhere.companyId).toBe('client-co-1')
    expect(rosterWhere.id).toBe('foreign-user-999')
    // Смены — тоже в границах своей компании.
    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('client-co-1')
  })

  it('чужой userId вместе с чужим companyId по-прежнему остаётся в своей компании', async () => {
    const prisma = makeTenantPrisma()
    const result = await new WorkforceService(prisma, {} as any).getMonthlyMatrix({
      actor: CLIENT_ADMIN_ACTOR,
      month: '2026-09',
      observerCompanyId: 'foreign-co-999',
      userId: 'foreign-user-999',
    })

    expect(result.company.id).toBe('client-co-1')
    expect(result.employees).toEqual([])
  })
})
