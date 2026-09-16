import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Reflector } from '@nestjs/core'
import { CompanyType, UserRole } from '@prisma/client'

import { canAccessManagementSurface } from '../common/management-surface-access'
import { PERMISSIONS } from '../common/permissions.constants'
import { ROLE_GRANTS } from '../common/permissions-matrix'
import { WorkforceController } from './workforce.controller'
import { WorkforceService } from './workforce.service'

/**
 * SMA-CLIENT-ADMIN-WORKFORCE-READ-PARITY-117T.
 *
 * CLIENT_ADMIN получает чтение Workforce своей компании и ничего сверх этого.
 * Доступ к маршруту — пересечение перечня ролей, шлюза управления 111A
 * и права; запись закрыта другими правами, которых у роли нет.
 */

const reflector = new Reflector()

const READ_HANDLERS = {
  'GET /workforce/shifts': WorkforceController.prototype.list,
  'GET /workforce/shifts/:shiftId': WorkforceController.prototype.getShift,
  'GET /workforce/matrix': WorkforceController.prototype.matrix,
} as const

const WRITE_HANDLERS = {
  'POST /workforce/shifts/open': WorkforceController.prototype.openShift,
  'POST /workforce/shifts/close': WorkforceController.prototype.closeShift,
  'POST /workforce/work-logs/tickets/:ticketId/start': WorkforceController.prototype.startTicketWork,
  'POST /workforce/work-logs/tickets/:ticketId/stop': WorkforceController.prototype.stopTicketWork,
  'POST /workforce/shifts/:shiftId/corrections': WorkforceController.prototype.createShiftCorrection,
  'PATCH /workforce/settings': WorkforceController.prototype.updateSettings,
} as const

const rolesOf = (handler: unknown) => reflector.get<UserRole[]>('roles', handler as any) ?? []
const permissionsOf = (handler: unknown) =>
  reflector.get<string[]>('permissions', handler as any) ??
  reflector.get<string[]>('required_permissions', handler as any) ??
  []

function grantedByRole(role: UserRole, companyType: CompanyType, code: string) {
  return ROLE_GRANTS.some(
    (g) =>
      g.role === role &&
      (g.companyType === companyType || g.companyType === null) &&
      g.codes.includes(code),
  )
}

const CLIENT_ADMIN = { role: UserRole.CLIENT_ADMIN, companyType: CompanyType.CLIENT }

describe('117T права роли CLIENT_ADMIN', () => {
  it('в матрице грантов у CLIENT_ADMIN ровно одно право — WORKFORCE_VIEW', () => {
    const rows = ROLE_GRANTS.filter((g) => g.role === UserRole.CLIENT_ADMIN)
    expect(rows).toHaveLength(1)
    expect(rows[0].companyType).toBe(CompanyType.CLIENT)
    expect(rows[0].codes).toEqual([PERMISSIONS.WORKFORCE_VIEW])
  })

  it('CLIENT_ADMIN не получает ни одного права на запись', () => {
    for (const code of [
      PERMISSIONS.WORKFORCE_SHIFT_USE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.COMPANY_SETTINGS_EDIT,
      PERMISSIONS.LOCATIONS_MANAGE,
      PERMISSIONS.TICKETS_EDIT,
    ]) {
      expect(grantedByRole(UserRole.CLIENT_ADMIN, CompanyType.CLIENT, code)).toBe(false)
    }
  })

  it('гранты остальных ролей не изменены этой задачей', () => {
    expect(grantedByRole(UserRole.TECHNICIAN, CompanyType.PROVIDER, PERMISSIONS.WORKFORCE_VIEW)).toBe(false)
    expect(grantedByRole(UserRole.CLIENT, CompanyType.CLIENT, PERMISSIONS.WORKFORCE_VIEW)).toBe(false)
    expect(grantedByRole(UserRole.STAFF, CompanyType.CLIENT, PERMISSIONS.WORKFORCE_VIEW)).toBe(false)
    expect(grantedByRole(UserRole.ADMIN, CompanyType.CLIENT, PERMISSIONS.WORKFORCE_VIEW)).toBe(true)
    expect(grantedByRole(UserRole.MASTER, CompanyType.PROVIDER, PERMISSIONS.WORKFORCE_VIEW)).toBe(true)
  })
})

describe('117T чтение Workforce', () => {
  it('все три чтения пускают CLIENT_ADMIN', () => {
    for (const [route, handler] of Object.entries(READ_HANDLERS)) {
      expect(rolesOf(handler)).toContain(UserRole.CLIENT_ADMIN)
      expect(canAccessManagementSurface(CLIENT_ADMIN)).toBe(true)
      expect(grantedByRole(UserRole.CLIENT_ADMIN, CompanyType.CLIENT, PERMISSIONS.WORKFORCE_VIEW)).toBe(
        true,
      )
      expect(route).toBeTruthy()
    }
  })

  it('чтения по-прежнему требуют шлюз управления и право, guard не ослаблен', () => {
    const source = readFileSync(join(__dirname, 'workforce.controller.ts'), 'utf8')
    for (const marker of ["@Get('shifts')", "@Get('shifts/:shiftId')", "@Get('matrix')"]) {
      const at = source.indexOf(marker)
      expect(at).toBeGreaterThan(-1)
      // Ищем блок декораторов перед самим маршрутом и после него.
      // Окно с запасом: у маршрута табеля между декораторами лежит длинный комментарий.
      const window = source.slice(Math.max(0, at - 400), at + 3200)
      expect(window).toContain('@ManagementSurface()')
      expect(window).toContain('PERMISSIONS.WORKFORCE_VIEW')
    }
  })
})

describe('117T запись Workforce остаётся закрытой для CLIENT_ADMIN', () => {
  it.each(Object.entries(WRITE_HANDLERS))('%s — отказ', (_route, handler) => {
    expect(rolesOf(handler)).not.toContain(UserRole.CLIENT_ADMIN)
  })

  it('ни один маршрут записи не защищён правом WORKFORCE_VIEW', () => {
    const source = readFileSync(join(__dirname, 'workforce.controller.ts'), 'utf8')
    for (const marker of [
      "@Post('shifts/open')",
      "@Post('shifts/close')",
      "@Post('work-logs/tickets/:ticketId/start')",
      "@Post('work-logs/tickets/:ticketId/stop')",
      "@Post('shifts/:shiftId/corrections')",
      "@Patch('settings')",
    ]) {
      const at = source.indexOf(marker)
      expect(at).toBeGreaterThan(-1)
      const block = source.slice(at, at + 900)
      const perm = /PERMISSIONS\.(\w+)/.exec(block)
      expect(perm).not.toBeNull()
      expect(perm![1]).not.toBe('WORKFORCE_VIEW')
    }
  })

  it('право на запись смен у CLIENT_ADMIN отсутствует, поэтому одного перечня ролей мало', () => {
    expect(grantedByRole(UserRole.CLIENT_ADMIN, CompanyType.CLIENT, PERMISSIONS.WORKFORCE_SHIFT_USE)).toBe(false)
    expect(grantedByRole(UserRole.CLIENT_ADMIN, CompanyType.CLIENT, PERMISSIONS.USERS_MANAGE)).toBe(false)
    expect(grantedByRole(UserRole.CLIENT_ADMIN, CompanyType.CLIENT, PERMISSIONS.COMPANY_SETTINGS_EDIT)).toBe(false)
  })
})

describe('117T регрессия прочих ролей', () => {
  it('NETWORK_DIRECTOR и TERRITORIAL_MANAGER закрыты шлюзом 111A, право при этом есть', () => {
    for (const role of [UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER]) {
      expect(grantedByRole(role, CompanyType.CLIENT, PERMISSIONS.WORKFORCE_VIEW)).toBe(true)
      expect(canAccessManagementSurface({ role, companyType: CompanyType.CLIENT })).toBe(false)
    }
  })

  it('TECHNICIAN не допущен к управленческому чтению Workforce', () => {
    for (const handler of Object.values(READ_HANDLERS)) {
      expect(rolesOf(handler)).not.toContain(UserRole.TECHNICIAN)
    }
    expect(canAccessManagementSurface({ role: UserRole.TECHNICIAN, companyType: CompanyType.PROVIDER })).toBe(false)
  })

  it('обычный CLIENT и STAFF закрыты', () => {
    for (const handler of Object.values(READ_HANDLERS)) {
      expect(rolesOf(handler)).not.toContain(UserRole.CLIENT)
      expect(rolesOf(handler)).not.toContain(UserRole.STAFF)
    }
  })

  it('провайдерские ADMIN, DISPATCHER и MASTER сохраняют чтение', () => {
    for (const role of [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MASTER]) {
      expect(canAccessManagementSurface({ role, companyType: CompanyType.PROVIDER })).toBe(true)
      expect(grantedByRole(role, CompanyType.PROVIDER, PERMISSIONS.WORKFORCE_VIEW)).toBe(true)
      for (const handler of Object.values(READ_HANDLERS)) {
        expect(rolesOf(handler)).toContain(role)
      }
    }
  })
})

/* ── арендная изоляция под актором CLIENT_ADMIN ───────────────────────── */

const ACTOR = { id: 'ca-1', companyId: 'client-co-1', role: UserRole.CLIENT_ADMIN }

function makePrisma() {
  return {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: ACTOR.id }),
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
    workShift: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  } as any
}

describe('117T аренда: CLIENT_ADMIN всегда своя компания', () => {
  beforeEach(() => jest.clearAllMocks())

  it('список смен своей компании берётся по своей компании', async () => {
    const prisma = makePrisma()
    await new WorkforceService(prisma, {} as any).listWorkforce({ actor: ACTOR })
    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('client-co-1')
  })

  it('чужой companyId в списке смен игнорируется', async () => {
    const prisma = makePrisma()
    await new WorkforceService(prisma, {} as any).listWorkforce({
      actor: ACTOR,
      observerCompanyId: 'foreign-co-999',
    })
    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('client-co-1')
  })

  it('чужая смена по идентификатору не находится', async () => {
    const prisma = makePrisma()
    await expect(
      new WorkforceService(prisma, {} as any).getShiftWithCorrections(ACTOR, 'foreign-shift-999'),
    ).rejects.toThrow()
    expect(prisma.workShift.findFirst.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ id: 'foreign-shift-999', companyId: 'client-co-1' }),
    )
  })

  it('чужой companyId в табеле игнорируется, а чужой userId ничего не открывает', async () => {
    const prisma = makePrisma()
    const result = await new WorkforceService(prisma, {} as any).getMonthlyMatrix({
      actor: ACTOR,
      month: '2026-09',
      observerCompanyId: 'foreign-co-999',
      userId: 'foreign-user-999',
    })
    expect(result.company.id).toBe('client-co-1')
    expect(result.employees).toEqual([])
    expect(prisma.user.findMany.mock.calls[0][0].where.companyId).toBe('client-co-1')
  })

  it('наблюдение за чужой компанией остаётся только у PLATFORM_ADMIN', async () => {
    const prisma = makePrisma()
    await new WorkforceService(prisma, {} as any).listWorkforce({
      actor: { ...ACTOR, role: UserRole.PLATFORM_ADMIN },
      observerCompanyId: 'foreign-co-999',
    })
    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('foreign-co-999')
  })
})
