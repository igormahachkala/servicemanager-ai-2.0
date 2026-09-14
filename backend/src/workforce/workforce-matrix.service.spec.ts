import { BadRequestException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { canAccessManagementSurface } from '../common/management-surface-access'
import { PERMISSIONS } from '../common/permissions.constants'
import { WorkforceController } from './workforce.controller'
import { WorkforceService } from './workforce.service'

/** SMA-WORKFORCE-MONTHLY-MATRIX-106D — service wiring, scoping and query shape. */

const manager = { id: 'mgr-1', companyId: 'provider-1', role: UserRole.ADMIN }

function makePrisma(timezone: string | null, shifts: any[] = [], roster: any[] = []) {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: manager.id }),
      // Реестр сотрудников месяца: без него в отчёт не попадёт тот, кто не работал.
      findMany: jest.fn().mockResolvedValue(roster),
    },
    company: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        name: 'ООО Подрядчик',
        timezone,
        shiftAutoCloseTime: '19:00',
      })),
    },
    workShift: { findMany: jest.fn().mockResolvedValue(shifts) },
  } as any
  return prisma
}

const service = (prisma: any) => new WorkforceService(prisma, {} as any)

describe('106D getMonthlyMatrix', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects a malformed month', async () => {
    await expect(
      service(makePrisma('UTC')).getMonthlyMatrix({ actor: manager, month: '2026-13' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('queries a half-open range derived from the company timezone', async () => {
    const prisma = makePrisma('Europe/Moscow')

    await service(prisma).getMonthlyMatrix({ actor: manager, month: '2026-09' })

    const where = prisma.workShift.findMany.mock.calls[0][0].where
    expect(where.companyId).toBe('provider-1')
    expect(where.openedAt.gte.toISOString()).toBe('2026-08-31T21:00:00.000Z')
    expect(where.openedAt.lt.toISOString()).toBe('2026-09-30T21:00:00.000Z')
    // Half-open: `lt`, never `lte`, so 1 October local midnight belongs to October.
    expect(where.openedAt.lte).toBeUndefined()
  })

  it('does NOT truncate — the take:500 cap of the old report is gone', async () => {
    const prisma = makePrisma('UTC')

    await service(prisma).getMonthlyMatrix({ actor: manager, month: '2026-09' })

    expect(prisma.workShift.findMany.mock.calls[0][0].take).toBeUndefined()
  })

  it('scopes to the actor company and ignores a companyId from a non-platform actor', async () => {
    const prisma = makePrisma('UTC')

    await service(prisma).getMonthlyMatrix({
      actor: manager,
      month: '2026-09',
      observerCompanyId: 'someone-else',
    })

    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('provider-1')
  })

  it('honours the observer company only for PLATFORM_ADMIN', async () => {
    const prisma = makePrisma('UTC')

    await service(prisma).getMonthlyMatrix({
      actor: { ...manager, role: UserRole.PLATFORM_ADMIN },
      month: '2026-09',
      observerCompanyId: 'observed-company',
    })

    expect(prisma.workShift.findMany.mock.calls[0][0].where.companyId).toBe('observed-company')
  })

  it('can be narrowed to one employee', async () => {
    const prisma = makePrisma('UTC')

    await service(prisma).getMonthlyMatrix({ actor: manager, month: '2026-09', userId: 'tech-9' })

    expect(prisma.workShift.findMany.mock.calls[0][0].where.userId).toBe('tech-9')
  })

  it('returns the month skeleton even when nothing was worked', async () => {
    const result: any = await service(makePrisma('UTC')).getMonthlyMatrix({
      actor: manager,
      month: '2026-09',
    })

    expect(result.month.days).toHaveLength(30)
    expect(result.employees).toEqual([])
    expect(result.company.timezone).toBe('UTC')
  })

  // ── реестр сотрудников ────────────────────────────────────────────────────

  it('asks only for people who can hold a shift, active and not deleted', async () => {
    const prisma = makePrisma('UTC')

    await service(prisma).getMonthlyMatrix({ actor: manager, month: '2026-09' })

    const where = prisma.user.findMany.mock.calls[0][0].where
    expect(where.companyId).toBe('provider-1')
    expect(where.isActive).toBe(true)
    expect(where.deletedAt).toBeNull()
    // Тот же список ролей, что у POST /workforce/shifts/open: второго определения
    // «сотрудника» не заводится.
    expect(where.role.in).toEqual(
      expect.arrayContaining([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.TECHNICIAN]),
    )
    expect(where.role.in).not.toContain(UserRole.CLIENT)
  })

  it('includes an employee who worked nothing this month', async () => {
    const prisma = makePrisma('UTC', [], [
      { id: 'tech-1', firstName: 'И', lastName: 'Петров', email: 'p@x.local', role: UserRole.TECHNICIAN },
    ])

    const result: any = await service(prisma).getMonthlyMatrix({ actor: manager, month: '2026-09' })

    expect(result.employees).toHaveLength(1)
    expect(result.employees[0].user.id).toBe('tech-1')
    expect(result.employees[0].days).toHaveLength(30)
    expect(result.employees[0].totals.closedShiftMinutes).toBe(0)
    expect(result.totals.employees).toBe(1)
  })

  it('narrows the roster too when one employee is requested', async () => {
    const prisma = makePrisma('UTC')

    await service(prisma).getMonthlyMatrix({ actor: manager, month: '2026-09', userId: 'tech-9' })

    expect(prisma.user.findMany.mock.calls[0][0].where.id).toBe('tech-9')
  })
})

describe('106D matrix access', () => {
  it('requires WORKFORCE_VIEW and denies TECHNICIAN', () => {
    const roles = Reflect.getMetadata('roles', WorkforceController.prototype.matrix)
    const permissions = Reflect.getMetadata('permissions', WorkforceController.prototype.matrix)

    expect(permissions).toEqual([PERMISSIONS.WORKFORCE_VIEW])
    expect(roles).toEqual(
      expect.arrayContaining([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER]),
    )
    // A technician has /m/shift for their own shift, not the company timesheet.
    expect(roles).not.toContain(UserRole.TECHNICIAN)
    expect(roles).not.toContain(UserRole.CLIENT)
  })

  /*
   * 111A — канонический шлюз. @Roles матрицы всё ещё шире него и содержит
   * NETWORK_DIRECTOR с TERRITORIAL_MANAGER; управляющую часть 111A им закрыл.
   * Без этого охранника месячный табель остался бы единственным управленческим
   * экраном, который они всё ещё могут открыть. Второго списка ролей здесь не
   * заводится — шлюз сужает существующий.
   */
  it('sits behind the 111A management surface guard', () => {
    const guards = Reflect.getMetadata('__guards__', WorkforceController.prototype.matrix) ?? []
    expect(guards.map((g: any) => g.name)).toContain('ManagementSurfaceGuard')
  })

  it.each([
    [UserRole.ADMIN, CompanyType.CLIENT, true],
    [UserRole.CLIENT_ADMIN, CompanyType.CLIENT, true],
    [UserRole.ADMIN, CompanyType.PROVIDER, true],
    [UserRole.DISPATCHER, CompanyType.PROVIDER, true],
    [UserRole.MASTER, CompanyType.PROVIDER, true],
    [UserRole.NETWORK_DIRECTOR, CompanyType.PROVIDER, false],
    [UserRole.TERRITORIAL_MANAGER, CompanyType.PROVIDER, false],
    [UserRole.TECHNICIAN, CompanyType.PROVIDER, false],
    [UserRole.MASTER, CompanyType.CLIENT, false],
    [UserRole.CLIENT, CompanyType.CLIENT, false],
  ])('%s in %s → %s', (role, companyType, allowed) => {
    expect(canAccessManagementSurface({ role, companyType })).toBe(allowed)
  })
})
