import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import {
  InspectionFrequency,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client'

import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { InspectionScheduleService } from './inspection-schedule.service'

/**
 * SMA-ROUNDS-V1-SCHEDULE-CRUD-098.
 *
 * As in 097, the real ServiceContractsService is driven with a fake prisma rather than a
 * stubbed access object: the point is that schedules inherit contract semantics, not that the
 * glue passes objects around.
 */

const PROVIDER_ID = 'provider-1'
const OTHER_PROVIDER_ID = 'provider-2'
const CLIENT_A = 'client-a'
const CLIENT_B = 'client-b'

const LOC_A = { id: 'loc-a1', clientCompanyId: CLIENT_A, name: 'Фудзияма — Уфа' }
const LOC_B = { id: 'loc-b1', clientCompanyId: CLIENT_B, name: 'Другой клиент' }
const LOC_UNCONTRACTED = { id: 'loc-x1', clientCompanyId: 'client-x', name: 'Чужой клиент' }

const admin = { id: 'u-admin', companyId: PROVIDER_ID, role: UserRole.ADMIN }
const master = { id: 'u-master', companyId: PROVIDER_ID, role: UserRole.MASTER }
const dispatcher = { id: 'u-disp', companyId: PROVIDER_ID, role: UserRole.DISPATCHER }
const technician = { id: 'u-tech', companyId: PROVIDER_ID, role: UserRole.TECHNICIAN }
const otherTechnician = { id: 'u-tech-2', companyId: PROVIDER_ID, role: UserRole.TECHNICIAN }

const VALID_START = '2026-10-01T09:30:00.000Z'

function makeContract(overrides: any = {}) {
  return {
    id: 'sc-1',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    clientCompanyId: CLIENT_A,
    providerCompanyId: PROVIDER_ID,
    startsAt: null,
    endsAt: null,
    locations: [],
    ...overrides,
  }
}

const LOCATIONS = [LOC_A, LOC_B, LOC_UNCONTRACTED]

const USERS: any[] = [
  { id: technician.id, companyId: PROVIDER_ID, role: UserRole.TECHNICIAN, isExecutor: true, isActive: true, deletedAt: null },
  { id: otherTechnician.id, companyId: PROVIDER_ID, role: UserRole.TECHNICIAN, isExecutor: true, isActive: true, deletedAt: null },
  { id: 'u-not-executor', companyId: PROVIDER_ID, role: UserRole.TECHNICIAN, isExecutor: false, isActive: true, deletedAt: null },
  { id: 'u-foreign-tech', companyId: OTHER_PROVIDER_ID, role: UserRole.TECHNICIAN, isExecutor: true, isActive: true, deletedAt: null },
]

function makeSuite(options: { contracts?: any[]; schedules?: any[] } = {}) {
  const contracts = options.contracts ?? [makeContract(), makeContract({ id: 'sc-b', clientCompanyId: CLIENT_B })]

  const contractsPrisma = {
    serviceContract: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.clientCompanyId_providerCompanyId
        return (
          contracts.find(
            (c) => c.clientCompanyId === key.clientCompanyId && c.providerCompanyId === key.providerCompanyId,
          ) ?? null
        )
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any
  const serviceContracts = new ServiceContractsService(contractsPrisma)

  const scheduleRows: any[] = options.schedules ?? []

  const prisma = {
    inspectionTemplate: {
      // Templates are provider-owned: a lookup scoped to another company must miss.
      findFirst: jest.fn(async ({ where }: any) =>
        where.companyId === PROVIDER_ID ? { id: where.id, name: 'ТО ежемесячное' } : null,
      ),
    },
    location: {
      findFirst: jest.fn(async ({ where }: any) => LOCATIONS.find((l) => l.id === where.id) ?? null),
    },
    equipment: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.companyId === CLIENT_A && where.locationId === LOC_A.id ? { id: where.id } : null,
      ),
    },
    user: {
      findFirst: jest.fn(async ({ where }: any) =>
        USERS.find(
          (u) => u.id === where.id && u.companyId === where.companyId && u.isActive && u.deletedAt === null,
        ) ?? null,
      ),
    },
    inspectionSchedule: {
      create: jest.fn(async ({ data }: any) => ({ id: 'sched-new', ...data })),
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
      findMany: jest.fn(async () => scheduleRows),
      findFirst: jest.fn(async ({ where }: any) =>
        scheduleRows.find((s) => s.id === where.id && s.companyId === where.companyId) ?? null,
      ),
    },
  } as any

  return { svc: new InspectionScheduleService(prisma, serviceContracts), prisma, contractsPrisma }
}

function scheduleRow(overrides: any = {}) {
  return {
    id: 'sched-1',
    companyId: PROVIDER_ID,
    name: 'ТО ежемесячное',
    frequency: InspectionFrequency.MONTHLY,
    intervalDays: null,
    lastGeneratedAt: null,
    isActive: true,
    location: { id: LOC_A.id, clientCompanyId: CLIENT_A },
    assignedTo: { id: technician.id, email: 't@x', firstName: null, lastName: null },
    _count: { runs: 0 },
    ...overrides,
  }
}

// ── CREATE ───────────────────────────────────────────────────────────────────

describe('098 schedule CREATE', () => {
  it('ALLOWS a provider ADMIN to plan a round at a contracted client location', async () => {
    const { svc, prisma } = makeSuite()

    const created: any = await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      assignedToUserId: technician.id,
      frequency: InspectionFrequency.MONTHLY,
      startDate: VALID_START,
    } as any)

    expect(prisma.inspectionSchedule.create).toHaveBeenCalledTimes(1)
    expect(created.companyId).toBe(PROVIDER_ID)
    expect(created.locationId).toBe(LOC_A.id)
    expect(created.assignedToUserId).toBe(technician.id)
    expect(created.createdByUserId).toBe(admin.id)
    // No generator in 098: the first due moment is exactly the planned moment.
    expect(created.nextDueAt).toEqual(new Date(VALID_START))
    expect(created.startDate).toEqual(new Date(VALID_START))
  })

  it('falls back to the template name when the manager gives none', async () => {
    const { svc } = makeSuite()

    const created: any = await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      frequency: InspectionFrequency.ONCE,
      startDate: VALID_START,
    } as any)

    expect(created.name).toBe('ТО ежемесячное')
  })

  it.each([
    ['MASTER', master],
    ['DISPATCHER', dispatcher],
  ])('ALLOWS a provider %s to plan — same LOCATIONS_MANAGE grant as template management', async (_l, actor) => {
    const { svc, prisma } = makeSuite()

    await svc.create(actor, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      frequency: InspectionFrequency.WEEKLY,
      startDate: VALID_START,
    } as any)

    expect(prisma.inspectionSchedule.create).toHaveBeenCalled()
  })

  it('DENIES a TECHNICIAN planning a round — execution is not management', async () => {
    const { svc, prisma } = makeSuite()

    await expect(
      svc.create(technician, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.WEEKLY,
        startDate: VALID_START,
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.inspectionSchedule.create).not.toHaveBeenCalled()
  })

  it('DENIES a location the provider has no contract for', async () => {
    const { svc, prisma } = makeSuite()

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_UNCONTRACTED.id,
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
    expect(prisma.inspectionSchedule.create).not.toHaveBeenCalled()
  })

  it.each([
    ['DRAFT', ServiceContractStatus.DRAFT],
    ['INACTIVE', ServiceContractStatus.INACTIVE],
    ['ENDED', ServiceContractStatus.ENDED],
  ])('DENIES a %s contract', async (_label, status) => {
    const { svc } = makeSuite({ contracts: [makeContract({ status })] })

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
  })

  it('DENIES an ACTIVE contract whose endsAt is in the past', async () => {
    const { svc } = makeSuite({
      contracts: [makeContract({ endsAt: new Date(Date.now() - 86_400_000) })],
    })

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
  })

  it('DENIES an ACTIVE contract whose startsAt is in the future', async () => {
    const { svc } = makeSuite({
      contracts: [makeContract({ startsAt: new Date(Date.now() + 86_400_000) })],
    })

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
  })

  it('ALLOWS a listed location under a SELECTED_LOCATIONS contract', async () => {
    const { svc, prisma } = makeSuite({
      contracts: [
        makeContract({
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          locations: [{ locationId: LOC_A.id }],
        }),
      ],
    })

    await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      frequency: InspectionFrequency.ONCE,
      startDate: VALID_START,
    } as any)

    expect(prisma.inspectionSchedule.create).toHaveBeenCalled()
  })

  it('DENIES a location outside a SELECTED_LOCATIONS contract', async () => {
    const { svc } = makeSuite({
      contracts: [
        makeContract({
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          locations: [{ locationId: 'another-location' }],
        }),
      ],
    })

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
  })

  it("DENIES another provider's template", async () => {
    const { svc, prisma } = makeSuite({ contracts: [makeContract({ providerCompanyId: OTHER_PROVIDER_ID })] })

    await expect(
      svc.create(
        { ...admin, companyId: OTHER_PROVIDER_ID },
        {
          templateId: 'tpl-1',
          locationId: LOC_A.id,
          frequency: InspectionFrequency.ONCE,
          startDate: VALID_START,
        } as any,
      ),
    ).rejects.toThrow(new NotFoundException('Inspection template not found'))
    expect(prisma.inspectionSchedule.create).not.toHaveBeenCalled()
  })

  it("DENIES assigning another provider's technician", async () => {
    const { svc, prisma } = makeSuite()

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        assignedToUserId: 'u-foreign-tech',
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Assignee not found'))
    expect(prisma.inspectionSchedule.create).not.toHaveBeenCalled()
  })

  it('DENIES an assignee who is not executor-eligible', async () => {
    const { svc } = makeSuite()

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        assignedToUserId: 'u-not-executor',
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('DENIES an unparseable startDate', async () => {
    const { svc } = makeSuite()

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.ONCE,
        startDate: 'not-a-date',
      } as any),
    ).rejects.toThrow(new BadRequestException('Invalid startDate'))
  })

  it('scopes equipment to the site owner and rejects equipment from elsewhere', async () => {
    const { svc, prisma } = makeSuite()

    await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      equipmentId: 'eq-1',
      frequency: InspectionFrequency.ONCE,
      startDate: VALID_START,
    } as any)

    expect(prisma.equipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: CLIENT_A, locationId: LOC_A.id }),
      }),
    )

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_B.id,
        equipmentId: 'eq-1',
        frequency: InspectionFrequency.ONCE,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new NotFoundException('Equipment not found'))
  })

  // ── frequency persistence ──────────────────────────────────────────────────
  it.each([
    InspectionFrequency.ONCE,
    InspectionFrequency.DAILY,
    InspectionFrequency.WEEKLY,
    InspectionFrequency.BIWEEKLY,
    InspectionFrequency.MONTHLY,
    InspectionFrequency.QUARTERLY,
    InspectionFrequency.SEMIANNUAL,
    InspectionFrequency.ANNUAL,
  ])('persists frequency %s with a null intervalDays', async (frequency) => {
    const { svc } = makeSuite()

    const created: any = await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      frequency,
      startDate: VALID_START,
    } as any)

    expect(created.frequency).toBe(frequency)
    expect(created.intervalDays).toBeNull()
  })

  it('persists CUSTOM together with its intervalDays', async () => {
    const { svc } = makeSuite()

    const created: any = await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      frequency: InspectionFrequency.CUSTOM,
      intervalDays: 45,
      startDate: VALID_START,
    } as any)

    expect(created.frequency).toBe(InspectionFrequency.CUSTOM)
    expect(created.intervalDays).toBe(45)
  })

  it('DENIES CUSTOM without intervalDays', async () => {
    const { svc } = makeSuite()

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.CUSTOM,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new BadRequestException('intervalDays is required for CUSTOM frequency'))
  })

  it('DENIES intervalDays on a fixed frequency instead of silently dropping it', async () => {
    const { svc } = makeSuite()

    await expect(
      svc.create(admin, {
        templateId: 'tpl-1',
        locationId: LOC_A.id,
        frequency: InspectionFrequency.MONTHLY,
        intervalDays: 45,
        startDate: VALID_START,
      } as any),
    ).rejects.toThrow(new BadRequestException('intervalDays is allowed only for CUSTOM frequency'))
  })

  // ── template reuse ─────────────────────────────────────────────────────────
  it('reuses one provider template across two authorised clients without duplicating it', async () => {
    const { svc, prisma } = makeSuite()

    const first: any = await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_A.id,
      frequency: InspectionFrequency.MONTHLY,
      startDate: VALID_START,
    } as any)
    const second: any = await svc.create(admin, {
      templateId: 'tpl-1',
      locationId: LOC_B.id,
      frequency: InspectionFrequency.MONTHLY,
      startDate: VALID_START,
    } as any)

    expect(first.templateId).toBe('tpl-1')
    expect(second.templateId).toBe('tpl-1')
    expect(first.locationId).toBe(LOC_A.id)
    expect(second.locationId).toBe(LOC_B.id)
    expect(prisma.inspectionTemplate.findFirst).toHaveBeenCalledTimes(2)
    // Both schedules point at the same template row; nothing was copied into a client company.
    expect((prisma.inspectionTemplate as any).create).toBeUndefined()
  })
})

// ── READ / LIST ──────────────────────────────────────────────────────────────

describe('098 schedule READ and LIST', () => {
  it('ALLOWS a manager to read any schedule of their company', async () => {
    const { svc } = makeSuite({ schedules: [scheduleRow()] })

    await expect(svc.get(admin, 'sched-1')).resolves.toMatchObject({ id: 'sched-1' })
  })

  it('ALLOWS a technician to read their own assigned schedule', async () => {
    const { svc } = makeSuite({ schedules: [scheduleRow()] })

    await expect(svc.get(technician, 'sched-1')).resolves.toMatchObject({ id: 'sched-1' })
  })

  it("DENIES a technician reading another technician's schedule", async () => {
    const { svc } = makeSuite({ schedules: [scheduleRow()] })

    await expect(svc.get(otherTechnician, 'sched-1')).rejects.toThrow(
      new NotFoundException('Inspection schedule not found'),
    )
  })

  it('narrows a technician list to their own assignments and ignores a widening filter', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await svc.list(technician, { assignedToUserId: otherTechnician.id } as any)

    expect(prisma.inspectionSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: PROVIDER_ID, assignedToUserId: technician.id }),
      }),
    )
  })

  it('lets a manager filter by technician, location, frequency, active and a due window', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await svc.list(admin, {
      assignedToUserId: technician.id,
      locationId: LOC_A.id,
      frequency: InspectionFrequency.MONTHLY,
      active: 'true',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T23:59:59.000Z',
    } as any)

    const where = prisma.inspectionSchedule.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({
      companyId: PROVIDER_ID,
      assignedToUserId: technician.id,
      locationId: LOC_A.id,
      frequency: InspectionFrequency.MONTHLY,
      isActive: true,
    })
    expect(where.nextDueAt).toEqual({
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lte: new Date('2026-10-31T23:59:59.000Z'),
    })
  })

  it('drops schedules whose contract lapsed after they were planned', async () => {
    const { svc } = makeSuite({
      contracts: [makeContract({ id: 'sc-b', clientCompanyId: CLIENT_B })],
      schedules: [
        scheduleRow({ id: 'sched-out', location: { id: LOC_A.id, clientCompanyId: CLIENT_A } }),
        scheduleRow({ id: 'sched-in', location: { id: LOC_B.id, clientCompanyId: CLIENT_B } }),
      ],
    })

    const rows: any[] = await svc.list(admin)

    expect(rows.map((r) => r.id)).toEqual(['sched-in'])
  })

  it('DENIES reading a schedule whose contract lapsed', async () => {
    const { svc } = makeSuite({
      contracts: [makeContract({ status: ServiceContractStatus.INACTIVE })],
      schedules: [scheduleRow()],
    })

    await expect(svc.get(admin, 'sched-1')).rejects.toThrow(
      new NotFoundException('Inspection schedule not found'),
    )
  })
})

// ── UPDATE ───────────────────────────────────────────────────────────────────

describe('098 schedule UPDATE', () => {
  it('ALLOWS a manager to move the planned moment and follows nextDueAt along', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await svc.update(admin, 'sched-1', { startDate: '2026-11-05T08:00:00.000Z' } as any)

    const data = prisma.inspectionSchedule.update.mock.calls[0][0].data
    expect(data.startDate).toEqual(new Date('2026-11-05T08:00:00.000Z'))
    expect(data.nextDueAt).toEqual(new Date('2026-11-05T08:00:00.000Z'))
  })

  it('does NOT rewind nextDueAt once a generator has produced runs', async () => {
    const { svc, prisma } = makeSuite({
      schedules: [scheduleRow({ lastGeneratedAt: new Date('2026-09-01T00:00:00.000Z') })],
    })

    await svc.update(admin, 'sched-1', { startDate: '2026-11-05T08:00:00.000Z' } as any)

    const data = prisma.inspectionSchedule.update.mock.calls[0][0].data
    expect(data.startDate).toBeDefined()
    expect(data.nextDueAt).toBeUndefined()
  })

  it('DENIES moving a schedule to an out-of-scope location', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await expect(
      svc.update(admin, 'sched-1', { locationId: LOC_UNCONTRACTED.id } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('clears the equipment link when the round moves to another site', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await svc.update(admin, 'sched-1', { locationId: LOC_B.id } as any)

    const data = prisma.inspectionSchedule.update.mock.calls[0][0].data
    expect(data.location).toEqual({ connect: { id: LOC_B.id } })
    expect(data.equipment).toEqual({ disconnect: true })
  })

  it('lets a manager clear the assignee', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await svc.update(admin, 'sched-1', { assignedToUserId: null } as any)

    expect(prisma.inspectionSchedule.update.mock.calls[0][0].data.assignedTo).toEqual({ disconnect: true })
  })

  it('DENIES reassigning to another provider’s technician', async () => {
    const { svc } = makeSuite({ schedules: [scheduleRow()] })

    await expect(
      svc.update(admin, 'sched-1', { assignedToUserId: 'u-foreign-tech' } as any),
    ).rejects.toThrow(new NotFoundException('Assignee not found'))
  })

  it('DENIES a TECHNICIAN updating a schedule, including their own', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await expect(svc.update(technician, 'sched-1', { name: 'Новое имя' } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('DENIES an empty patch', async () => {
    const { svc } = makeSuite({ schedules: [scheduleRow()] })

    await expect(svc.update(admin, 'sched-1', {} as any)).rejects.toThrow(
      new BadRequestException('At least one field must be provided'),
    )
  })

  it('keeps the CUSTOM/intervalDays rule on update', async () => {
    const { svc } = makeSuite({ schedules: [scheduleRow()] })

    await expect(
      svc.update(admin, 'sched-1', { frequency: InspectionFrequency.CUSTOM } as any),
    ).rejects.toThrow(new BadRequestException('intervalDays is required for CUSTOM frequency'))
  })
})

// ── DELETE / DEACTIVATE ──────────────────────────────────────────────────────

describe('098 schedule DELETE / DEACTIVATE', () => {
  it('hard-deletes a plan that never produced a run', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow({ _count: { runs: 0 } })] })

    await expect(svc.remove(admin, 'sched-1')).resolves.toEqual({
      id: 'sched-1',
      deleted: true,
      isActive: false,
    })
    expect(prisma.inspectionSchedule.delete).toHaveBeenCalled()
  })

  it('deactivates instead of deleting once runs exist, preserving the history link', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow({ _count: { runs: 3 } })] })

    await expect(svc.remove(admin, 'sched-1')).resolves.toEqual({
      id: 'sched-1',
      deleted: false,
      isActive: false,
    })
    expect(prisma.inspectionSchedule.delete).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    )
  })

  it('deactivates a plan that generated before its runs were cleaned up', async () => {
    const { svc, prisma } = makeSuite({
      schedules: [scheduleRow({ _count: { runs: 0 }, lastGeneratedAt: new Date() })],
    })

    await expect(svc.remove(admin, 'sched-1')).resolves.toMatchObject({ deleted: false })
    expect(prisma.inspectionSchedule.delete).not.toHaveBeenCalled()
  })

  it('DENIES a TECHNICIAN retiring a schedule', async () => {
    const { svc, prisma } = makeSuite({ schedules: [scheduleRow()] })

    await expect(svc.remove(technician, 'sched-1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.inspectionSchedule.delete).not.toHaveBeenCalled()
  })
})
