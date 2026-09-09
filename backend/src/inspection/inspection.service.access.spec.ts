import { ForbiddenException, NotFoundException } from '@nestjs/common'
import {
  InspectionRunStatus,
  InspectionRunItemStatus,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client'

import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { InspectionService } from './inspection.service'

/**
 * SMA-ROUNDS-V1-PROVIDER-LOCATION-SCOPE-097 — service wiring.
 *
 * inspection-location-scope.spec.ts proves the scope decision itself. This file proves the
 * decision is actually reached from every Inspection entry point, that template ownership
 * stays provider-side, and that a ticket raised from a provider-executed round is handed to
 * the ticket layer with the client's location rather than the provider's company.
 */

const PROVIDER_ID = 'provider-1'
const OTHER_PROVIDER_ID = 'provider-2'
const CLIENT_A = 'client-a'

const LOCATION = { id: 'loc-a1', name: 'Фудзияма — Уфа', clientCompanyId: CLIENT_A }

const providerAdmin = { id: 'u-admin', companyId: PROVIDER_ID, role: UserRole.ADMIN }
const providerMaster = { id: 'u-master', companyId: PROVIDER_ID, role: UserRole.MASTER }
const providerTechnician = { id: 'u-tech', companyId: PROVIDER_ID, role: UserRole.TECHNICIAN }
const providerDispatcher = { id: 'u-disp', companyId: PROVIDER_ID, role: UserRole.DISPATCHER }
const clientAdmin = { id: 'u-client', companyId: CLIENT_A, role: UserRole.ADMIN }
const outsider = { id: 'u-outsider', companyId: PROVIDER_ID, role: UserRole.CLIENT }

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

function makeSuite(options: { contracts?: any[]; prisma?: any } = {}) {
  const contracts = options.contracts ?? [makeContract()]

  const contractsPrisma = {
    serviceContract: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.clientCompanyId_providerCompanyId
        return (
          contracts.find(
            (c) =>
              c.clientCompanyId === key.clientCompanyId &&
              c.providerCompanyId === key.providerCompanyId,
          ) ?? null
        )
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any
  const serviceContracts = new ServiceContractsService(contractsPrisma)

  const prisma = {
    inspectionTemplate: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.companyId === PROVIDER_ID || where.companyId === CLIENT_A
          ? { id: where.id, name: 'ТО', items: [{ id: 'ti-1', title: 'Проверить', description: null, sortOrder: 0, isRequired: true }] }
          : null,
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    location: {
      findFirst: jest.fn(async ({ where }: any) => (where.id === LOCATION.id ? { ...LOCATION } : null)),
    },
    equipment: {
      findFirst: jest.fn().mockResolvedValue({ id: 'eq-1' }),
    },
    inspectionRun: {
      create: jest.fn(async ({ data }: any) => ({ id: 'run-1', ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(async ({ data }: any) => ({ id: 'run-1', items: [], ...data })),
    },
    inspectionRunItem: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(async ({ data }: any) => ({ id: 'item-1', ...data })),
    },
    ...(options.prisma ?? {}),
  } as any

  const tickets = { create: jest.fn().mockResolvedValue({ ticket: { id: 'tk-1' }, generated: null, autoAssigned: null }) } as any
  const timeline = { recordLegacy: jest.fn().mockResolvedValue(undefined) } as any
  const exporter = { exportReport: jest.fn() } as any
  const shiftPolicy = { assertActiveShiftForOperationalWork: jest.fn().mockResolvedValue(undefined) } as any

  const svc = new InspectionService(prisma, tickets, timeline, exporter, serviceContracts, shiftPolicy)

  return { svc, prisma, tickets, timeline, contractsPrisma, shiftPolicy }
}

// ── startRun ─────────────────────────────────────────────────────────────────

describe('097 InspectionService.startRun', () => {
  it('ALLOWS a provider ADMIN to start a run at a contracted client location', async () => {
    const { svc, prisma } = makeSuite()

    const run: any = await svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalled()
    // Execution context stays with the provider; the site stays with the client.
    expect(run.companyId).toBe(PROVIDER_ID)
    expect(run.locationId).toBe(LOCATION.id)
  })

  it.each([
    ['MASTER', providerMaster],
    ['TECHNICIAN', providerTechnician],
    ['DISPATCHER', providerDispatcher],
  ])('ALLOWS a provider %s under the same contract, with no new management power', async (_label, actor) => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(actor, { templateId: 'tpl-1', locationId: LOCATION.id } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalled()
  })

  it('keeps the pre-097 role gate: a role outside RUN_EXECUTION_ROLES is refused', async () => {
    const { svc, prisma } = makeSuite()

    await expect(
      svc.startRun(outsider, { templateId: 'tpl-1', locationId: LOCATION.id } as any),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(prisma.location.findFirst).not.toHaveBeenCalled()
  })

  it('DENIES a provider with no contract for the location owner', async () => {
    const { svc, prisma } = makeSuite({ contracts: [] })

    await expect(
      svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('DENIES a location outside a SELECTED_LOCATIONS contract', async () => {
    const { svc, prisma } = makeSuite({
      contracts: [
        makeContract({
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          locations: [{ locationId: 'some-other-location' }],
        }),
      ],
    })

    await expect(
      svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('DENIES an expired contract', async () => {
    const { svc } = makeSuite({
      contracts: [makeContract({ endsAt: new Date(Date.now() - 86_400_000) })],
    })

    await expect(
      svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
  })

  it('keeps templates provider-owned: the lookup is scoped to the actor company', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any)

    expect(prisma.inspectionTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'tpl-1', companyId: PROVIDER_ID, isActive: true }),
      }),
    )
  })

  it("DENIES another provider reusing the first provider's template", async () => {
    const { svc, prisma } = makeSuite({
      contracts: [makeContract({ providerCompanyId: OTHER_PROVIDER_ID })],
    })

    await expect(
      svc.startRun(
        { ...providerAdmin, companyId: OTHER_PROVIDER_ID },
        { templateId: 'tpl-1', locationId: LOCATION.id } as any,
      ),
    ).rejects.toThrow(new NotFoundException('Inspection template not found'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('reuses one provider template across two authorised clients without duplicating it', async () => {
    const CLIENT_B = 'client-b'
    const LOC_B = { id: 'loc-b1', name: 'Другой клиент', clientCompanyId: CLIENT_B }
    const { svc, prisma } = makeSuite({
      contracts: [makeContract({ id: 'sc-a' }), makeContract({ id: 'sc-b', clientCompanyId: CLIENT_B })],
      prisma: {
        location: {
          findFirst: jest.fn(async ({ where }: any) =>
            where.id === LOCATION.id ? { ...LOCATION } : where.id === LOC_B.id ? { ...LOC_B } : null,
          ),
        },
      },
    })

    const first: any = await svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any)
    const second: any = await svc.startRun(providerAdmin, { templateId: 'tpl-1', locationId: LOC_B.id } as any)

    expect(first.templateId).toBe('tpl-1')
    expect(second.templateId).toBe('tpl-1')
    expect(prisma.inspectionTemplate.create).not.toHaveBeenCalled()
  })

  it('scopes equipment to the site owner, not to the executing company', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(providerAdmin, {
      templateId: 'tpl-1',
      locationId: LOCATION.id,
      equipmentId: 'eq-1',
    } as any)

    expect(prisma.equipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: CLIENT_A, locationId: LOCATION.id }),
      }),
    )
  })

  // ── client own-company path is untouched ───────────────────────────────────
  it('PRESERVES the client own-company flow and consults no contract row for it', async () => {
    const { svc, prisma, contractsPrisma } = makeSuite({ contracts: [] })

    const run: any = await svc.startRun(clientAdmin, { templateId: 'tpl-1', locationId: LOCATION.id } as any)

    expect(run.companyId).toBe(CLIENT_A)
    expect(prisma.inspectionRun.create).toHaveBeenCalled()
    // Self-access short-circuits inside getLinkedClientAccess, so the client path costs
    // exactly what it cost before 097.
    expect(contractsPrisma.serviceContract.findUnique).not.toHaveBeenCalled()
  })

  it('DENIES a client company acting on another client’s location', async () => {
    // The other client owns a perfectly valid template of its own, so the denial has to come
    // from the location scope rather than from the template lookup happening to miss.
    const { svc } = makeSuite({
      contracts: [],
      prisma: {
        inspectionTemplate: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'tpl-z',
            name: 'ТО',
            items: [{ id: 'ti-1', title: 'Проверить', description: null, sortOrder: 0, isRequired: true }],
          }),
          create: jest.fn(),
        },
      },
    })

    await expect(
      svc.startRun(
        { ...clientAdmin, companyId: 'client-z' },
        { templateId: 'tpl-z', locationId: LOCATION.id } as any,
      ),
    ).rejects.toThrow(new NotFoundException('Location not found'))
  })
})

// ── existing run access is re-validated ──────────────────────────────────────

describe('097 InspectionService run access re-validation', () => {
  function runRow(overrides: any = {}) {
    return {
      id: 'run-1',
      companyId: PROVIDER_ID,
      status: InspectionRunStatus.IN_PROGRESS,
      locationId: LOCATION.id,
      equipmentId: null,
      location: { id: LOCATION.id, clientCompanyId: CLIENT_A },
      items: [],
      ...overrides,
    }
  }

  it('ALLOWS reading a provider run while the contract is live', async () => {
    const { svc, prisma } = makeSuite()
    prisma.inspectionRun.findFirst.mockResolvedValue(runRow())

    await expect(svc.getRun(providerAdmin, 'run-1')).resolves.toMatchObject({ id: 'run-1' })
  })

  it('DENIES reading a provider run after the contract lapsed', async () => {
    const { svc, prisma } = makeSuite({
      contracts: [makeContract({ status: ServiceContractStatus.ENDED })],
    })
    prisma.inspectionRun.findFirst.mockResolvedValue(runRow())

    // The run row still carries companyId === PROVIDER_ID, so the pre-097 tenant filter alone
    // would have handed it over. Authorisation has to be re-derived from the contract.
    await expect(svc.getRun(providerAdmin, 'run-1')).rejects.toThrow(
      new NotFoundException('Inspection run not found'),
    )
  })

  it('DENIES completing a run whose location left a SELECTED_LOCATIONS scope', async () => {
    const { svc, prisma } = makeSuite({
      contracts: [
        makeContract({
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          locations: [{ locationId: 'another-location' }],
        }),
      ],
    })
    prisma.inspectionRun.findFirst.mockResolvedValue(runRow())

    await expect(svc.completeRun(providerAdmin, 'run-1')).rejects.toThrow(
      new NotFoundException('Inspection run not found'),
    )
    expect(prisma.inspectionRun.update).not.toHaveBeenCalled()
  })

  it('does not consult contracts for a run at the actor’s own location', async () => {
    const { svc, prisma, contractsPrisma } = makeSuite({ contracts: [] })
    prisma.inspectionRun.findFirst.mockResolvedValue(runRow({ companyId: CLIENT_A }))

    await expect(svc.getRun(clientAdmin, 'run-1')).resolves.toMatchObject({ id: 'run-1' })
    expect(contractsPrisma.serviceContract.findUnique).not.toHaveBeenCalled()
  })

  it('drops out-of-scope provider runs from the list', async () => {
    const CLIENT_B = 'client-b'
    const { svc, prisma } = makeSuite()
    prisma.inspectionRun.findMany.mockResolvedValue([
      { id: 'run-in', location: { id: LOCATION.id, clientCompanyId: CLIENT_A } },
      { id: 'run-out', location: { id: 'loc-b1', clientCompanyId: CLIENT_B } },
      { id: 'run-no-location', location: null },
    ])

    const runs: any[] = await svc.listRuns(providerAdmin)

    expect(runs.map((r) => r.id)).toEqual(['run-in', 'run-no-location'])
  })
})

// ── issue → ticket context ───────────────────────────────────────────────────

describe('097 ticket raised from a provider-executed round', () => {
  it('hands the ticket layer the client location and never forces provider ownership', async () => {
    const { svc, prisma, tickets } = makeSuite()
    prisma.inspectionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: InspectionRunStatus.IN_PROGRESS,
      locationId: LOCATION.id,
      equipmentId: 'eq-1',
      location: { id: LOCATION.id, clientCompanyId: CLIENT_A },
    })
    prisma.inspectionRunItem.findFirst.mockResolvedValue({
      id: 'item-1',
      templateItemId: 'ti-1',
      title: 'Течь',
      description: null,
      status: InspectionRunItemStatus.ISSUE,
      requiresRepair: false,
      comment: null,
      ticketId: null,
    })

    await svc.createTicketFromItem(providerTechnician, 'run-1', 'item-1', { categoryId: 'cat-1' } as any)

    expect(tickets.create).toHaveBeenCalledTimes(1)
    const [actorCompanyId, actor, dto] = tickets.create.mock.calls[0]

    // The provider is the ACTOR, not the owner. Ownership is derived from the location by the
    // canonical ticket resolver, so 097 must not smuggle a clientCompanyId of its own in here —
    // doing so is exactly how the ticket would end up owned by the provider.
    expect(actorCompanyId).toBe(PROVIDER_ID)
    expect(actor).toMatchObject({ id: providerTechnician.id, role: UserRole.TECHNICIAN })
    expect(dto.locationId).toBe(LOCATION.id)
    expect(dto.clientCompanyId).toBeUndefined()
  })

  it('DENIES raising a ticket from a run whose contract lapsed', async () => {
    const { svc, prisma, tickets } = makeSuite({
      contracts: [makeContract({ status: ServiceContractStatus.INACTIVE })],
    })
    prisma.inspectionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: InspectionRunStatus.IN_PROGRESS,
      locationId: LOCATION.id,
      equipmentId: null,
      location: { id: LOCATION.id, clientCompanyId: CLIENT_A },
    })

    await expect(
      svc.createTicketFromItem(providerTechnician, 'run-1', 'item-1', { categoryId: 'cat-1' } as any),
    ).rejects.toThrow(new NotFoundException('Inspection run not found'))
    expect(tickets.create).not.toHaveBeenCalled()
  })
})
