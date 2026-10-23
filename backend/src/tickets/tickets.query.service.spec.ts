import { NotFoundException } from '@nestjs/common'
import { ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { TicketsQueryService } from './tickets.query.service'
import * as ticketAccessUtils from './ticket-access.utils'
import {
  compareLongTermKeys,
  isLongTermCandidate,
  longTermKeyOf,
} from './long-term-tickets';
import * as longTermSql from './long-term-tickets.sql';

// ── constants ─────────────────────────────────────────────────────────────────

const PROVIDER_ID = 'provider-1'
const CLIENT_ID = 'client-1'
const USER_ID = 'user-1'
const TICKET_ID = 'ticket-1'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeTechScope(companyIds: string[] = [PROVIDER_ID]) {
  return {
    companyIds,
    scopeCompanyId: companyIds[companyIds.length - 1],
    visibilityMode: 'provider_primary' as const,
    locationScopeByCompany: {} as Record<string, string[]>,
    specializationIds: [] as string[],
    specializationNames: [] as string[],
    allowTechnicianClaim: true,
  }
}

function makeManagementScope(scopeCompanyId = PROVIDER_ID) {
  return { scopeCompanyId, visibilityMode: 'tenant' as const }
}

function makeProviderLinkedScope(scopeCompanyId = CLIENT_ID) {
  return { scopeCompanyId, visibilityMode: 'provider_primary' as const }
}

function makePrisma(
  opts: {
    executorIds?: string[]
    boundLocationIds?: string[]
    contractSpecializationIds?: string[]
    contractSpecializationNames?: string[]
  } = {},
) {
  const contractSpecializationIds = opts.contractSpecializationIds ?? [
    'contract-default',
  ]
  return {
    ticket: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ticketAttachment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    domainEvent: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findFirst: jest.fn().mockResolvedValue({ isExecutor: false }),
      findMany: jest
        .fn()
        .mockResolvedValue((opts.executorIds ?? []).map((id) => ({ id }))),
    },
    userLocationBinding: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (opts.boundLocationIds ?? []).map((locationId) => ({ locationId })),
        ),
    },
    technicianSpecialization: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    serviceContract: {
      findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }),
    },
    serviceContractSpecialization: {
      findMany: jest.fn().mockResolvedValue(
        contractSpecializationIds.map((specializationId, index) => ({
          specializationId,
          specialization: {
            name: opts.contractSpecializationNames?.[index] ?? specializationId,
          },
        })),
      ),
    },
  } as any
}

function makeService(
  prisma: any,
  serviceContractsOverride: Record<string, any> = {},
) {
  // TimelineService is only used by TicketMetaBuilder (getOne path).
  // ServiceContractsService.getLinkedClientAccess is consulted by the SECONDARY
  // operational-scope check; default to null (no SECONDARY restriction) so these
  // tests exercise the management/technician scoping they target.
  const serviceContracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(null),
    listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    ...serviceContractsOverride,
  }
  const contractContext = {
    getContractContext: jest.fn().mockResolvedValue(null),
  }
  return new TicketsQueryService(
    prisma,
    {} as any,
    serviceContracts as any,
    contractContext as any,
  )
}

function makeSecondaryContracts() {
  return {
    getLinkedClientAccess: jest.fn().mockResolvedValue({
      role: ServiceContractRole.SECONDARY,
      status: 'ACTIVE',
      providerCompanyId: PROVIDER_ID,
      clientCompanyId: CLIENT_ID,
    }),
    listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([CLIENT_ID]),
  }
}

const wideLocationScope = {
  mode: 'tenant_wide' as const,
  locationIds: [] as string[],
}

function fieldMatches(condition: any, value: any): boolean {
  if (condition === undefined) return true
  if (
    condition === null ||
    typeof condition !== 'object' ||
    condition instanceof Date
  ) {
    return value === condition
  }
  if ('equals' in condition) return value === condition.equals
  if ('in' in condition)
    return Array.isArray(condition.in) && condition.in.includes(value)
  if ('notIn' in condition)
    return Array.isArray(condition.notIn) && !condition.notIn.includes(value)
  if ('not' in condition) return value !== condition.not
  return true
}

function specializationLinkMatches(where: any, link: any): boolean {
  if (!where) return true
  if (Array.isArray(where.AND)) {
    return where.AND.every((part: any) => specializationLinkMatches(part, link))
  }
  if (Array.isArray(where.OR)) {
    return where.OR.some((part: any) => specializationLinkMatches(part, link))
  }
  if (!fieldMatches(where.specializationId, link.specializationId)) return false
  const nameCondition = where.specialization?.name
  if (nameCondition !== undefined) {
    const actual = String(link.specialization?.name ?? '')
    if (
      typeof nameCondition === 'object' &&
      nameCondition &&
      'equals' in nameCondition
    ) {
      const expected = String(nameCondition.equals ?? '')
      return nameCondition.mode === 'insensitive'
        ? actual.toLowerCase() === expected.toLowerCase()
        : actual === expected
    }
    return actual === nameCondition
  }
  return true
}

function problemCategoryMatches(where: any, category: any): boolean {
  if (!where) return true
  const links = category?.specializationLinks ?? []
  const specializationLinks = where.specializationLinks
  if (!specializationLinks) return true
  if (specializationLinks.none !== undefined) return links.length === 0
  if (specializationLinks.some !== undefined) {
    return links.some((link: any) =>
      specializationLinkMatches(specializationLinks.some, link),
    )
  }
  return true
}

function ticketMatchesWhere(where: any, ticket: any): boolean {
  if (!where) return true
  if (where.id?.equals === '__no_access__') return false
  if (!fieldMatches(where.id, ticket.id)) return false
  if (!fieldMatches(where.companyId, ticket.companyId)) return false
  if (!fieldMatches(where.locationId, ticket.locationId)) return false
  if (!fieldMatches(where.assignedTechnicianId, ticket.assignedTechnicianId))
    return false
  if (!fieldMatches(where.status, ticket.status)) return false
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- where/ticket — any, как у полей выше
  if (!fieldMatches(where.plannedDueAt, ticket.plannedDueAt)) return false;
  if (!problemCategoryMatches(where.problemCategory, ticket.problemCategory))
    return false
  // AND и OR на одном уровне проверяются оба: where техника — это OR видимости
  // плюс AND ограничений, и ранний return по AND пропускал бы OR.
  if (
    Array.isArray(where.AND) &&
    !where.AND.every((part: any) => ticketMatchesWhere(part, ticket))
  ) {
    return false;
  }
  if (
    Array.isArray(where.OR) &&
    !where.OR.some((part: any) => ticketMatchesWhere(part, ticket))
  ) {
    return false;
  }
  return true
}

// ── list ──────────────────────────────────────────────────────────────────────

describe('TicketsQueryService.list', () => {
  let spyTechScope: jest.SpyInstance
  let spyReadScope: jest.SpyInstance
  let spyLocationScope: jest.SpyInstance

  beforeEach(() => {
    spyTechScope = jest.spyOn(
      ticketAccessUtils,
      'resolveTechnicianOperationalScope',
    )
    spyReadScope = jest
      .spyOn(ticketAccessUtils, 'resolveTicketReadScope')
      .mockResolvedValue(makeManagementScope())
    spyLocationScope = jest
      .spyOn(ticketAccessUtils, 'resolveActorLocationScope')
      .mockResolvedValue(wideLocationScope)
  })

  afterEach(() => jest.restoreAllMocks())

  it('TECHNICIAN: calls resolveTechnicianOperationalScope, skips resolveTicketReadScope', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID]))
    const prisma = makePrisma({
      contractSpecializationIds: ['spec-hvac'],
      contractSpecializationNames: ['Холодильное оборудование'],
    })
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN)

    expect(spyTechScope).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ role: UserRole.TECHNICIAN }),
      }),
    )
    expect(spyReadScope).not.toHaveBeenCalled()
    expect(prisma.ticket.findMany).toHaveBeenCalled()
  })

  it('TECHNICIAN with two companyIds: findMany where references both companies', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma({
      contractSpecializationIds: ['spec-hvac'],
      contractSpecializationNames: ['Холодильное оборудование'],
    })
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN)

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain(PROVIDER_ID)
    expect(whereStr).toContain(CLIENT_ID)
  })

  it('ADMIN: calls resolveTicketReadScope, skips resolveTechnicianOperationalScope', async () => {
    const prisma = makePrisma({
      contractSpecializationIds: ['spec-hvac'],
      contractSpecializationNames: ['Холодильное оборудование'],
    })
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN)

    expect(spyTechScope).not.toHaveBeenCalled()
    expect(spyReadScope).toHaveBeenCalled()
  })

  it('ADMIN own company: findMany where is scoped to provider companyId', async () => {
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN)

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain(PROVIDER_ID)
  })

  it('ADMIN linked-client list applies SELECTED_LOCATIONS to one selected location', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: ['loc-selected'],
    })
    const rows = [
      {
        id: 'ticket-selected',
        companyId: CLIENT_ID,
        locationId: 'loc-selected',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
      },
      {
        id: 'ticket-forbidden',
        companyId: CLIENT_ID,
        locationId: 'loc-forbidden',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
      },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(result.map((ticket: any) => ticket.id)).toEqual(['ticket-selected'])
    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('loc-selected')
  })

  it('ADMIN linked-client list fail-closes SELECTED_LOCATIONS with no bindings', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: [],
    })
    const rows = [
      {
        id: 'ticket-forbidden',
        companyId: CLIENT_ID,
        locationId: 'loc-forbidden',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
      },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(result).toEqual([])
    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('__no_access__')
  })

  it('004C: SECONDARY ADMIN default all-locations list does not expand to full client board', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue(wideLocationScope)
    const rows = [
      {
        id: 'ticket-outside-secondary-relationship',
        companyId: CLIENT_ID,
        locationId: 'client-loc',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: { specializationLinks: [] },
      },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma, makeSecondaryContracts())

    const result = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(result).toEqual([])
    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('__no_access__')
  })

  it('004C: SECONDARY ADMIN selected relationship location remains readable', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: ['loc-secondary-bound'],
    })
    const rows = [
      {
        id: 'ticket-secondary-location',
        companyId: CLIENT_ID,
        locationId: 'loc-secondary-bound',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: { specializationLinks: [] },
      },
      {
        id: 'ticket-foreign-location',
        companyId: CLIENT_ID,
        locationId: 'loc-foreign',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: { specializationLinks: [] },
      },
    ]
    const prisma = makePrisma({ boundLocationIds: ['loc-secondary-bound'] })
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma, makeSecondaryContracts())

    const result = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(result.map((ticket: any) => ticket.id)).toEqual([
      'ticket-secondary-location',
    ])
  })

  it('ADMIN list composes location and specialization scopes through one ticket predicate', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: ['loc-selected'],
    })
    const prisma = makePrisma({
      contractSpecializationIds: ['spec-hvac'],
      contractSpecializationNames: ['Холодильное оборудование'],
    })
    prisma.technicianSpecialization.findMany.mockResolvedValue([
      {
        specializationId: 'spec-hvac',
        specialization: { name: 'Холодильное оборудование' },
      },
    ])
    const svc = makeService(prisma)

    await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('loc-selected')
    expect(whereStr).toContain('spec-hvac')
    expect(whereStr).toContain('specializationLinks')
  })

  it('provider ADMIN linked-client list is isolated by each contract location and specialization', async () => {
    const clientX = 'client-x'
    const clientY = 'client-y'
    spyReadScope.mockImplementation(async (params: any) =>
      makeProviderLinkedScope(params.linkedClientCompanyId),
    )
    spyLocationScope.mockImplementation(async (params: any) =>
      params.scopeCompanyId === clientX
        ? { mode: 'bound_locations', locationIds: ['x1', 'x2'] }
        : { mode: 'bound_locations', locationIds: ['y1'] },
    )
    const rows = [
      {
        id: 'ticket-x-hvac',
        companyId: clientX,
        locationId: 'x1',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            { specializationId: 'spec-hvac', specialization: { name: 'HVAC' } },
          ],
        },
      },
      {
        id: 'ticket-x-electrical',
        companyId: clientX,
        locationId: 'x2',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            {
              specializationId: 'spec-electrical',
              specialization: { name: 'Electrical' },
            },
          ],
        },
      },
      {
        id: 'ticket-y-electrical',
        companyId: clientY,
        locationId: 'y1',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            {
              specializationId: 'spec-electrical',
              specialization: { name: 'Electrical' },
            },
          ],
        },
      },
      {
        id: 'ticket-y-hvac',
        companyId: clientY,
        locationId: 'y1',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            { specializationId: 'spec-hvac', specialization: { name: 'HVAC' } },
          ],
        },
      },
      {
        id: 'ticket-y-electrical-wrong-location',
        companyId: clientY,
        locationId: 'x1',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            {
              specializationId: 'spec-electrical',
              specialization: { name: 'Electrical' },
            },
          ],
        },
      },
    ]
    const prisma = makePrisma()
    prisma.serviceContract.findFirst.mockImplementation(
      async ({ where }: any) => ({
        id: where.clientCompanyId === clientX ? 'contract-x' : 'contract-y',
      }),
    )
    prisma.serviceContractSpecialization.findMany.mockImplementation(
      async ({ where }: any) =>
        where.serviceContractId === 'contract-x'
          ? [
              {
                specializationId: 'spec-hvac',
                specialization: { name: 'HVAC' },
              },
            ]
          : [
              {
                specializationId: 'spec-electrical',
                specialization: { name: 'Electrical' },
              },
            ],
    )
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const xResult = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      clientX,
    )
    const yResult = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      clientY,
    )

    expect(xResult.map((ticket: any) => ticket.id)).toEqual(['ticket-x-hvac'])
    expect(yResult.map((ticket: any) => ticket.id)).toEqual([
      'ticket-y-electrical',
    ])
  })

  it('provider ADMIN linked-client list fail-closes when contract specialization is UNCONFIGURED', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue(wideLocationScope)
    const rows = [
      {
        id: 'ticket-hvac',
        companyId: CLIENT_ID,
        locationId: 'loc-client',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            { specializationId: 'spec-hvac', specialization: { name: 'HVAC' } },
          ],
        },
      },
    ]
    const prisma = makePrisma({ contractSpecializationIds: [] })
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(result).toEqual([])
    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('__no_access__')
  })

  it('client ADMIN own-company list is not restricted by provider contract specializations', async () => {
    spyReadScope.mockResolvedValue(makeManagementScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue(wideLocationScope)
    const rows = [
      {
        id: 'client-ticket-hvac',
        companyId: CLIENT_ID,
        locationId: 'loc-client',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemCategory: {
          specializationLinks: [
            { specializationId: 'spec-hvac', specialization: { name: 'HVAC' } },
          ],
        },
      },
    ]
    const prisma = makePrisma({ contractSpecializationIds: [] })
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(CLIENT_ID, USER_ID, UserRole.ADMIN)

    expect(result.map((ticket: any) => ticket.id)).toEqual([
      'client-ticket-hvac',
    ])
    expect(prisma.serviceContractSpecialization.findMany).not.toHaveBeenCalled()
  })

  it('ADMIN with linkedClientCompanyId: passes it through to resolveTicketReadScope', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(spyReadScope).toHaveBeenCalledWith(
      expect.objectContaining({ linkedClientCompanyId: CLIENT_ID }),
    )
  })

  it('status filter is applied when provided', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID]))
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      TicketStatus.ASSIGNED,
    )

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('ASSIGNED')
  })

  it('TECHNICIAN with explicit SECONDARY linked client applies operational scope fail-closed', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma()
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      PROVIDER_ID,
      CLIENT_ID,
    )
    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('__no_access__')
  })

  it('TECHNICIAN selected-location list omits forbidden location tickets', async () => {
    const techScope = makeTechScope([PROVIDER_ID, CLIENT_ID])
    techScope.locationScopeByCompany = {
      [PROVIDER_ID]: ['__restricted_empty_location_scope__'],
      [CLIENT_ID]: ['loc-allowed'],
    }
    spyTechScope.mockResolvedValue(techScope)
    const rows = [
      {
        id: 'ticket-allowed',
        companyId: CLIENT_ID,
        locationId: 'loc-allowed',
        assignedTechnicianId: USER_ID,
        status: TicketStatus.ASSIGNED,
      },
      {
        id: 'ticket-forbidden',
        companyId: CLIENT_ID,
        locationId: 'loc-forbidden',
        assignedTechnicianId: USER_ID,
        status: TicketStatus.ASSIGNED,
      },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      undefined,
      undefined,
      CLIENT_ID,
    )

    expect(result.map((ticket: any) => ticket.id)).toEqual(['ticket-allowed'])
  })
})

// ── board ─────────────────────────────────────────────────────────────────────

describe('TicketsQueryService.board', () => {
  let spyTechScope: jest.SpyInstance
  let spyReadScope: jest.SpyInstance
  let spyLocationScope: jest.SpyInstance

  beforeEach(() => {
    spyTechScope = jest.spyOn(
      ticketAccessUtils,
      'resolveTechnicianOperationalScope',
    )
    spyReadScope = jest
      .spyOn(ticketAccessUtils, 'resolveTicketReadScope')
      .mockResolvedValue(makeManagementScope())
    spyLocationScope = jest
      .spyOn(ticketAccessUtils, 'resolveActorLocationScope')
      .mockResolvedValue(wideLocationScope)
  })

  afterEach(() => jest.restoreAllMocks())

  it('returns exactly 6 columns covering all ticket statuses', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const svc = makeService(makePrisma())

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      {},
    )

    expect(result.columns).toHaveLength(6)
    const statuses = result.columns.map((c) => c.status)
    expect(statuses).toEqual(
      expect.arrayContaining([
        TicketStatus.NEW,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.DONE,
        TicketStatus.CANCELED,
      ]),
    )
  })

  it('TECHNICIAN: uses techScope, meta reflects scope company and mode', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([CLIENT_ID]))
    const svc = makeService(makePrisma())

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      {},
    )

    expect(spyTechScope).toHaveBeenCalled()
    expect(spyReadScope).not.toHaveBeenCalled()
    expect(result.meta.scopeCompanyId).toBe(CLIENT_ID)
    expect(result.meta.visibilityMode).toBe('provider_primary')
  })

  it('ADMIN: uses management scope routing', async () => {
    const svc = makeService(makePrisma())

    await svc.board(PROVIDER_ID, USER_ID, UserRole.ADMIN, {})

    expect(spyTechScope).not.toHaveBeenCalled()
    expect(spyReadScope).toHaveBeenCalled()
  })

  it('ADMIN linked-client board fail-closes SELECTED_LOCATIONS with no bindings and zero counters', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: [],
    })
    const prisma = makePrisma()
    const svc = makeService(prisma)

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      {},
      undefined,
      CLIENT_ID,
    )

    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('__no_access__')
    expect(result.meta.totalTickets).toBe(0)
    expect(
      result.columns.every(
        (column) => column.total === 0 && column.cards.length === 0,
      ),
    ).toBe(true)
  })

  it('004C: SECONDARY ADMIN default all-locations board does not return full client board', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue(wideLocationScope)
    const rows = [
      {
        id: 'ticket-outside-secondary-relationship',
        companyId: CLIENT_ID,
        locationId: 'client-loc',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        problemText: 'outside relationship',
        problemCategory: {
          id: 'cat-1',
          name: 'Category',
          specializationLinks: [],
        },
        company: null,
        ticketNumber: null,
        urgency: 'NOT_URGENT',
        priority: 'NORMAL',
        urgencyReason: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        slaDueAt: null,
        slaBreachedAt: null,
        plannedDueAt: null,
        requesterName: null,
        createdByUserId: null,
        createdByUser: null,
        pointName: null,
        location: null,
        equipment: null,
        assignedTechnician: null,
        parentId: null,
      },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma, makeSecondaryContracts())

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      {},
      undefined,
      CLIENT_ID,
    )

    expect(result.meta.totalTickets).toBe(0)
    expect(
      result.columns.every(
        (column) => column.total === 0 && column.cards.length === 0,
      ),
    ).toBe(true)
    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('__no_access__')
  })

  it('ADMIN board uses the same location and specialization predicate as list/mobile data', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: ['loc-selected'],
    })
    const prisma = makePrisma({
      contractSpecializationIds: ['spec-hvac'],
      contractSpecializationNames: ['Холодильное оборудование'],
    })
    prisma.technicianSpecialization.findMany.mockResolvedValue([
      {
        specializationId: 'spec-hvac',
        specialization: { name: 'Холодильное оборудование' },
      },
    ])
    const svc = makeService(prisma)

    await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      {},
      undefined,
      CLIENT_ID,
    )

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('loc-selected')
    expect(whereStr).toContain('spec-hvac')
    expect(whereStr).toContain('specializationLinks')
  })

  it('columns include sla counters and card arrays', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const svc = makeService(makePrisma())

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      {},
    )

    for (const col of result.columns) {
      expect(col).toHaveProperty('total')
      expect(col).toHaveProperty('sla')
      expect(col).toHaveProperty('cards')
      expect(Array.isArray(col.cards)).toBe(true)
    }
  })

  it('card carries createdAt and plannedDueAt from the scoped board query', async () => {
    // Мобильная карточка «Долгосрочные заявки» считает плановый срок
    // выполнения по этим двум полям board-карточки и других источников не
    // имеет: без них она молча обнулится, а доступ решает этот же запрос.
    spyTechScope.mockResolvedValue(makeTechScope());
    const prisma = makePrisma() as { ticket: { findMany: jest.Mock } };
    const createdAt = new Date('2026-10-01T09:00:00.000Z');
    const plannedDueAt = new Date('2026-10-15T09:00:00.000Z');
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 't-long',
        companyId: PROVIDER_ID,
        company: null,
        ticketNumber: 7,
        status: TicketStatus.ASSIGNED,
        urgency: 'NOT_URGENT',
        priority: 'NORMAL',
        urgencyReason: null,
        createdAt,
        slaDueAt: null,
        slaBreachedAt: null,
        plannedDueAt,
        problemText: 'Замена витрины',
        requesterName: null,
        createdByUserId: null,
        createdByUser: null,
        pointName: null,
        parentId: null,
        locationId: 'loc-1',
        location: {
          id: 'loc-1',
          name: 'Точка',
          platformCode: 'P1',
          externalCode: null,
          city: null,
          address: null,
        },
        problemCategory: {
          id: 'cat-1',
          name: 'Холод',
          specializationLinks: [],
        },
        equipment: null,
        assignedTechnicianId: USER_ID,
        assignedTechnician: null,
      },
    ]);
    const svc = makeService(prisma);

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      {},
    );

    const card = result.columns
      .flatMap(
        (col) =>
          col.cards as Array<{
            id: string;
            createdAt: Date;
            plannedDueAt: Date | null;
          }>,
      )
      .find((c) => c.id === 't-long');
    expect(card).toMatchObject({ createdAt, plannedDueAt });
    const [[boardQuery]] = prisma.ticket.findMany.mock.calls as Array<
      [{ select: Record<string, unknown> }]
    >;
    const select = boardQuery.select;
    expect(select).toMatchObject({ createdAt: true, plannedDueAt: true });
  });

  it('archive filter: includes OR condition guarding DONE tickets by default', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    // applyArchivedFilter wraps the where with AND containing { OR: [{ status: { not: DONE } }, ...] }
    expect(whereStr).toContain('DONE')
  })

  it('archive filter absent when includeArchived = true', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {
      includeArchived: true,
    })

    // Without archive filter, no closedAt threshold is added
    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).not.toContain('closedAt')
  })

  it('meta.limitedToLast defaults to 500 when no take is provided', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const svc = makeService(makePrisma())

    const result = await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      {},
    )

    expect(result.meta.limitedToLast).toBe(500)
  })

  it('TECHNICIAN with explicit SECONDARY linked client limits board to executor or bound locations', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma({
      executorIds: [USER_ID],
      boundLocationIds: ['loc-allowed'],
    })
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.board(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      {},
      undefined,
      CLIENT_ID,
    )

    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      PROVIDER_ID,
      CLIENT_ID,
    )
    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain(USER_ID)
    expect(whereStr).toContain('loc-allowed')
  })

  it('TECHNICIAN aggregate board constrains SECONDARY companies without constraining own or PRIMARY companies', async () => {
    spyTechScope.mockResolvedValue(
      makeTechScope([PROVIDER_ID, 'primary-client', CLIENT_ID]),
    )
    const prisma = makePrisma()
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

    expect(contracts.listSecondaryLinkedClientIds).toHaveBeenCalledWith(
      PROVIDER_ID,
    )
    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('notIn')
    expect(whereStr).toContain(CLIENT_ID)
    expect(whereStr).toContain('__no_access__')
  })
})

// ── context analytics ─────────────────────────────────────────────────────────

// ── long-term ─────────────────────────────────────────────────────────────────

/**
 * SMA-MOBILE-LONG-TERM-TICKETS. Строки в памяти фильтрует тот же вычислитель
 * where, что и тесты board: доступ проверяется по тому, что реально пришло, а
 * не по аргументам. findMany повторяет поведение Prisma в нужном объёме:
 * where, orderBy createdAt desc и take — поэтому board честно режется на 500.
 *
 * COUNT и keyset-страница в проде — SQL в PostgreSQL. Здесь их заменяет та же
 * выборка в памяти, но WHERE, пришедший в них, сначала по-настоящему
 * переводится в SQL: форма доступа каждого сценария должна переводиться. Сам
 * SQL сверяется с Prisma на PostgreSQL в test/long-term-tickets.e2e-spec.ts.
 */
/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- строки и Prisma-мок в памяти, как в тестах board выше */
describe('TicketsQueryService.longTermTickets', () => {
  const HOUR = 60 * 60 * 1000;
  const BASE = Date.parse('2026-01-01T00:00:00Z');
  const CATEGORY = {
    id: 'cat-1',
    name: 'Холод',
    specializationLinks: [
      {
        specializationId: 'contract-default',
        specialization: { name: 'Холод' },
      },
    ],
  };

  let spyTechScope: jest.SpyInstance;
  let spyReadScope: jest.SpyInstance;
  let spyLocationScope: jest.SpyInstance;

  beforeEach(() => {
    spyTechScope = jest.spyOn(
      ticketAccessUtils,
      'resolveTechnicianOperationalScope',
    );
    spyReadScope = jest
      .spyOn(ticketAccessUtils, 'resolveTicketReadScope')
      .mockResolvedValue(makeManagementScope(CLIENT_ID));
    spyLocationScope = jest
      .spyOn(ticketAccessUtils, 'resolveActorLocationScope')
      .mockResolvedValue(wideLocationScope);
  });

  afterEach(() => jest.restoreAllMocks());

  function row(
    id: string,
    createdHoursFromBase: number,
    durationHours: number | null,
    overrides: Record<string, unknown> = {},
  ) {
    const createdAt = new Date(BASE + createdHoursFromBase * HOUR);
    return {
      id,
      companyId: CLIENT_ID,
      locationId: 'loc-1',
      assignedTechnicianId: null,
      status: TicketStatus.ASSIGNED,
      problemText: `Заявка ${id}`,
      problemCategory: CATEGORY,
      company: null,
      ticketNumber: 1,
      urgency: 'NOT_URGENT',
      priority: 'NORMAL',
      urgencyReason: null,
      createdAt,
      slaDueAt: null,
      slaBreachedAt: null,
      plannedDueAt:
        durationHours === null
          ? null
          : new Date(createdAt.getTime() + durationHours * HOUR),
      requesterName: null,
      createdByUserId: null,
      createdByUser: null,
      pointName: null,
      location: {
        id: 'loc-1',
        name: 'Точка',
        platformCode: 'P1',
        externalCode: null,
        city: null,
        address: null,
      },
      equipment: null,
      assignedTechnician: null,
      parentId: null,
      ...overrides,
    };
  }

  /** Сколько строк каждая операция «БД» отдала в Node.js. */
  let transferred: Array<{ op: string; rows: number; where?: unknown }> = [];

  function longTermRows(rows: any[], where: any) {
    return rows
      .filter((ticket) => ticketMatchesWhere(where, ticket))
      .filter(isLongTermCandidate)
      .sort((a, b) => compareLongTermKeys(longTermKeyOf(a), longTermKeyOf(b)));
  }

  function prismaWith(
    rows: any[],
    opts: Parameters<typeof makePrisma>[0] = {},
  ) {
    transferred = [];
    jest
      .spyOn(longTermSql, 'countLongTermTickets')
      .mockImplementation(async (_db, where) => {
        longTermSql.longTermCountSql(where);
        transferred.push({ op: 'count', rows: 1, where });
        return longTermRows(rows, where).length;
      });
    jest
      .spyOn(longTermSql, 'pageLongTermTickets')
      .mockImplementation(async (_db, where, { limit, after }) => {
        longTermSql.longTermPageSql(where, { limit, after });
        const fetched = longTermRows(rows, where)
          .filter(
            (r) => !after || compareLongTermKeys(longTermKeyOf(r), after) > 0,
          )
          .slice(0, limit + 1);
        transferred.push({ op: 'page', rows: fetched.length, where });
        return {
          rows: fetched.slice(0, limit),
          hasMore: fetched.length > limit,
        };
      });
    const prisma = makePrisma(opts);
    prisma.ticket.findMany.mockImplementation(
      async ({ where, take, orderBy }: any) => {
        let found = rows.filter((ticket) => ticketMatchesWhere(where, ticket));
        if (orderBy?.createdAt === 'desc') {
          found = [...found].sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
        }
        const result = typeof take === 'number' ? found.slice(0, take) : found;
        transferred.push({ op: 'findMany', rows: result.length, where });
        return result;
      },
    );
    return prisma;
  }

  async function allPages(
    svc: TicketsQueryService,
    limit: number,
    ...scopeArgs: any[]
  ) {
    const seen: string[] = [];
    let cursor: string | null = null;
    let total = -1;
    for (let guard = 0; guard < 1000; guard++) {
      const page: any = await svc.longTermTickets(
        CLIENT_ID,
        USER_ID,
        UserRole.ADMIN,
        { limit, cursor },
        undefined,
        ...scopeArgs,
      );
      total = page.total;
      seen.push(...page.items.map((item: any) => item.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return { seen, total };
  }

  it('больше 500 заявок: старая долгосрочная за пределами первой страницы board считается и находится', async () => {
    const rows = [
      row('old-long', 0, 400),
      ...Array.from({ length: 600 }, (_, index) =>
        row(
          `recent-${String(index).padStart(3, '0')}`,
          1000 + index,
          index % 3 === 0 ? 300 : 24,
        ),
      ),
    ];
    const prisma = prismaWith(rows);
    const svc = makeService(prisma);

    const board = await svc.board(CLIENT_ID, USER_ID, UserRole.ADMIN, {});
    const boardIds = board.columns.flatMap((column) =>
      column.cards.map((card: any) => card.id),
    );
    expect(boardIds).toHaveLength(500);
    expect(boardIds).not.toContain('old-long');

    const { seen, total } = await allPages(svc, 37);
    const expected = rows.filter(
      (r) =>
        r.plannedDueAt &&
        r.plannedDueAt.getTime() - r.createdAt.getTime() >= 240 * HOUR,
    );
    expect(total).toBe(expected.length);
    expect(total).toBe(201);
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
    expect(seen).toContain('old-long');
  });

  it('порядок детерминирован: ближайший плановый срок, затем дата создания, затем id', async () => {
    const rows = [
      row('b', 0, 300),
      row('a', 0, 300),
      row('c', -100, 400),
      row('d', 10, 250),
    ];
    const svc = makeService(prismaWith(rows));

    const { seen } = await allPages(svc, 1);

    // сроки: c = 300ч, a/b = 300ч (созданы позже c), d = 260ч
    expect(seen).toEqual(['d', 'c', 'a', 'b']);
  });

  it('точный счётчик: порог ровно 240 часов, завершённые, отменённые и без срока не считаются', async () => {
    const rows = [
      row('exact', 0, 240),
      row('almost', 0, 240 - 1 / 3600),
      row('no-due', 0, null, { slaDueAt: new Date(BASE + 1000 * HOUR) }),
      row('done', 0, 500, {
        status: TicketStatus.DONE,
        closedAt: new Date(BASE),
      }),
      row('canceled', 0, 500, { status: TicketStatus.CANCELED }),
      row('field-complete', 0, 500, { status: TicketStatus.FIELD_COMPLETE }),
      row('new', 0, 500, { status: TicketStatus.NEW }),
      row('accepting', 0, 500, { status: TicketStatus.AWAITING_ACCEPTANCE }),
    ];
    const svc = makeService(prismaWith(rows));

    const page: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
    );

    expect(page.total).toBe(3);
    expect(page.items.map((item: any) => item.id).sort()).toEqual([
      'accepting',
      'exact',
      'new',
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('пагинация: заявка, закрытая между страницами, не сдвигает и не дублирует остальные', async () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row(`t-${index}`, index, 300),
    );
    const svc = makeService(prismaWith(rows));

    const first: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 4 },
    );
    rows.splice(0, 2);
    const second: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      {
        limit: 4,
        cursor: first.nextCursor,
      },
    );

    expect(first.items.map((item: any) => item.id)).toEqual([
      't-0',
      't-1',
      't-2',
      't-3',
    ]);
    expect(second.items.map((item: any) => item.id)).toEqual([
      't-4',
      't-5',
      't-6',
      't-7',
    ]);
    expect(second.total).toBe(8);
  });

  it('битый курсор — 400', async () => {
    const svc = makeService(prismaWith([row('t', 0, 300)]));
    await expect(
      svc.longTermTickets(CLIENT_ID, USER_ID, UserRole.ADMIN, {
        cursor: 'не курсор',
      }),
    ).rejects.toThrow('Invalid cursor');
  });

  it('tenant isolation: заявки чужой компании не считаются и не отдаются', async () => {
    const rows = [
      row('own', 0, 300),
      row('foreign', 0, 300, { companyId: 'client-2' }),
    ];
    const prisma = prismaWith(rows);
    const svc = makeService(prisma);

    const page: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
    );

    expect(page.total).toBe(1);
    expect(page.items.map((item: any) => item.id)).toEqual(['own']);
    for (const [args] of prisma.ticket.findMany.mock.calls) {
      expect(JSON.stringify(args.where)).toContain(CLIENT_ID);
    }
    for (const op of transferred) {
      expect(JSON.stringify(op.where)).toContain(CLIENT_ID);
      expect(JSON.stringify(op.where)).not.toContain('client-2');
    }
  });

  it('PRIMARY-провайдер видит долгосрочные заявки клиента в контуре договора', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID));
    const rows = [
      row('client-long', 0, 300),
      row('other-client', 0, 300, { companyId: 'client-2' }),
    ];
    const svc = makeService(prismaWith(rows));

    const page: any = await svc.longTermTickets(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
      undefined,
      CLIENT_ID,
    );

    expect(page.total).toBe(1);
    expect(page.items.map((item: any) => item.id)).toEqual(['client-long']);
  });

  it('SECONDARY-провайдер: видит заявки своих исполнителей, а не весь контур клиента', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID));
    const rows = [
      row('outside', 0, 300),
      row('by-own-executor', 0, 300, {
        assignedTechnicianId: 'secondary-exec',
      }),
    ];
    const svc = makeService(
      prismaWith(rows, { executorIds: ['secondary-exec'] }),
      makeSecondaryContracts(),
    );

    const page: any = await svc.longTermTickets(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
      undefined,
      CLIENT_ID,
    );

    expect(page.items.map((item: any) => item.id)).toEqual(['by-own-executor']);
    expect(page.total).toBe(1);
  });

  it('SECONDARY-провайдер: видит заявки на объектах своей привязки, остальные — нет', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID));
    const rows = [
      row('outside', 0, 300),
      row('at-bound-location', 0, 300, { locationId: 'secondary-loc' }),
    ];
    const svc = makeService(
      prismaWith(rows, { boundLocationIds: ['secondary-loc'] }),
      makeSecondaryContracts(),
    );

    const page: any = await svc.longTermTickets(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
      undefined,
      CLIENT_ID,
    );

    expect(page.items.map((item: any) => item.id)).toEqual([
      'at-bound-location',
    ]);
    expect(page.total).toBe(1);
  });

  it('SECONDARY-провайдер без исполнителей и привязок не видит ничего', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID));
    const svc = makeService(
      prismaWith([row('outside', 0, 300)]),
      makeSecondaryContracts(),
    );

    const page: any = await svc.longTermTickets(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
      undefined,
      CLIENT_ID,
    );

    expect(page).toMatchObject({ total: 0, items: [] });
  });

  it('привязки к объектам сужают выборку', async () => {
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: ['loc-bound'],
    });
    const rows = [
      row('bound', 0, 300, { locationId: 'loc-bound' }),
      row('unbound', 0, 300),
    ];
    const svc = makeService(prismaWith(rows));

    const page: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
    );

    expect(page.items.map((item: any) => item.id)).toEqual(['bound']);
    expect(page.total).toBe(1);
  });

  it('restricted-empty: ноль и пустой список', async () => {
    spyLocationScope.mockResolvedValue({
      mode: 'restricted_empty',
      locationIds: [],
    });
    const svc = makeService(prismaWith([row('t', 0, 300)]));

    const page: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
    );

    expect(page).toEqual({ total: 0, items: [], nextCursor: null, limit: 50 });
  });

  it('техник: только свои и доступные для взятия, как на board', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([CLIENT_ID]));
    const rows = [
      row('mine', 0, 300, { assignedTechnicianId: USER_ID }),
      row('claimable', 0, 300, { status: TicketStatus.NEW }),
      row('colleague', 0, 300, { assignedTechnicianId: 'other-tech' }),
    ];
    const svc = makeService(prismaWith(rows));

    const page: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      { limit: 50 },
    );

    expect(page.items.map((item: any) => item.id).sort()).toEqual([
      'claimable',
      'mine',
    ]);
  });

  it.each([1000, 10000, 100000])(
    '%i заявок: точный total, в Node.js приходит не больше страницы, заявки — только по id страницы',
    async (size) => {
      const rows = Array.from({ length: size }, (_, index) =>
        row(
          `t-${String(index).padStart(6, '0')}`,
          index % 97,
          index % 3 === 0 ? 300 : index % 3 === 1 ? 239 : null,
          index % 7 === 0 ? { status: TicketStatus.CANCELED } : {},
        ),
      );
      const expected = rows.filter(
        (_, index) => index % 3 === 0 && index % 7 !== 0,
      ).length;
      const prisma = prismaWith(rows);
      const svc = makeService(prisma);

      const first: any = await svc.longTermTickets(
        CLIENT_ID,
        USER_ID,
        UserRole.ADMIN,
        { limit: 100 },
      );
      const second: any = await svc.longTermTickets(
        CLIENT_ID,
        USER_ID,
        UserRole.ADMIN,
        { limit: 100, cursor: first.nextCursor },
      );

      expect(first.total).toBe(expected);
      expect(second.total).toBe(expected);
      expect(first.items).toHaveLength(100);
      expect(second.items).toHaveLength(100);
      const ids = [...first.items, ...second.items].map((item: any) => item.id);
      expect(new Set(ids).size).toBe(200);
      for (const op of transferred) {
        expect(op.rows).toBeLessThanOrEqual(101);
      }
      for (const [args] of prisma.ticket.findMany.mock.calls) {
        expect(JSON.stringify(args.where)).toContain('"in"');
        expect(args.take).toBeLessThanOrEqual(100);
      }
    },
  );

  it('счётчик главной: только COUNT, без страницы и без карточек', async () => {
    const rows = [row('a', 0, 300), row('b', 0, 24), row('c', 0, 240)];
    const prisma = prismaWith(rows);
    const svc = makeService(prisma);

    await expect(
      svc.longTermTicketsTotal(CLIENT_ID, USER_ID, UserRole.ADMIN),
    ).resolves.toEqual({ total: 2 });
    expect(transferred.map((op) => op.op)).toEqual(['count']);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it('счётчик главной при restricted-empty — ноль без запроса в БД', async () => {
    spyLocationScope.mockResolvedValue({
      mode: 'restricted_empty',
      locationIds: [],
    });
    const svc = makeService(prismaWith([row('t', 0, 300)]));

    await expect(
      svc.longTermTicketsTotal(CLIENT_ID, USER_ID, UserRole.ADMIN),
    ).resolves.toEqual({ total: 0 });
  });

  it('битый курсор отклоняется до запросов в БД', async () => {
    const prisma = prismaWith([row('t', 0, 300)]);
    const svc = makeService(prisma);
    for (const cursor of [
      'не курсор',
      Buffer.from('{"p":"x","c":1,"i":"a"}').toString('base64url'),
      Buffer.from('{"p":1,"c":1,"i":""}').toString('base64url'),
      Buffer.from('[]').toString('base64url'),
    ]) {
      await expect(
        svc.longTermTickets(CLIENT_ID, USER_ID, UserRole.ADMIN, { cursor }),
      ).rejects.toThrow('Invalid cursor');
    }
    expect(transferred).toEqual([]);
  });

  it('карточки страницы — формат board: срок и дата создания на месте', async () => {
    const svc = makeService(prismaWith([row('t', 0, 300)]));

    const page: any = await svc.longTermTickets(
      CLIENT_ID,
      USER_ID,
      UserRole.ADMIN,
      { limit: 50 },
    );

    expect(page.items[0]).toMatchObject({
      id: 't',
      status: TicketStatus.ASSIGNED,
      createdAt: new Date(BASE),
      plannedDueAt: new Date(BASE + 300 * HOUR),
      category: { id: 'cat-1', name: 'Холод' },
    });
  });
});
/* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */

describe('TicketsQueryService.contextAnalytics', () => {
  let spyTechScope: jest.SpyInstance
  let spyReadScope: jest.SpyInstance
  let spyLocationScope: jest.SpyInstance

  beforeEach(() => {
    spyTechScope = jest.spyOn(
      ticketAccessUtils,
      'resolveTechnicianOperationalScope',
    )
    spyReadScope = jest
      .spyOn(ticketAccessUtils, 'resolveTicketReadScope')
      .mockResolvedValue(makeManagementScope())
    spyLocationScope = jest
      .spyOn(ticketAccessUtils, 'resolveActorLocationScope')
      .mockResolvedValue(wideLocationScope)
  })

  afterEach(() => jest.restoreAllMocks())

  it('TECHNICIAN with explicit SECONDARY linked client applies the same fail-closed scope as board/list', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma()
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.contextAnalytics(
      PROVIDER_ID,
      USER_ID,
      UserRole.TECHNICIAN,
      undefined,
      CLIENT_ID,
    )

    expect(spyReadScope).not.toHaveBeenCalled()
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      PROVIDER_ID,
      CLIENT_ID,
    )
    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('__no_access__')
  })

  it('004C: SECONDARY ADMIN default all-locations analytics does not count full client board', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue(wideLocationScope)
    const rows = [
      {
        id: 'ticket-outside-secondary-relationship',
        companyId: CLIENT_ID,
        locationId: 'client-loc',
        assignedTechnicianId: null,
        status: TicketStatus.NEW,
        location: { id: 'client-loc', name: 'Client location' },
        equipment: null,
        problemCategory: { specializationLinks: [] },
      },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma, makeSecondaryContracts())

    const result = await svc.contextAnalytics(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      CLIENT_ID,
    )

    expect(result.meta.totalTickets).toBe(0)
    expect(result.byLocation).toEqual([])
    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('__no_access__')
  })

  it('context analytics applies specialization scope consistently with board/list', async () => {
    spyReadScope.mockResolvedValue(makeProviderLinkedScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({
      mode: 'bound_locations',
      locationIds: ['loc-selected'],
    })
    const prisma = makePrisma({
      contractSpecializationIds: ['spec-hvac'],
      contractSpecializationNames: ['Холодильное оборудование'],
    })
    prisma.technicianSpecialization.findMany.mockResolvedValue([
      {
        specializationId: 'spec-hvac',
        specialization: { name: 'Холодильное оборудование' },
      },
    ])
    const svc = makeService(prisma)

    await svc.contextAnalytics(
      PROVIDER_ID,
      USER_ID,
      UserRole.ADMIN,
      undefined,
      CLIENT_ID,
    )

    const whereStr = JSON.stringify(
      prisma.ticket.findMany.mock.calls[0][0].where,
    )
    expect(whereStr).toContain('loc-selected')
    expect(whereStr).toContain('spec-hvac')
    expect(whereStr).toContain('specializationLinks')
  })
})

// ── getOne ────────────────────────────────────────────────────────────────────

describe('TicketsQueryService.getOne', () => {
  afterEach(() => jest.restoreAllMocks())

  it('throws NotFoundException when ticket is absent after access check', async () => {
    jest
      .spyOn(ticketAccessUtils, 'resolveReadableTicketAccess')
      .mockResolvedValue({
        ticket: {
          id: TICKET_ID,
          companyId: CLIENT_ID,
          assignedTechnicianId: null,
        },
        scopeCompanyId: CLIENT_ID,
        visibilityMode: 'provider_primary',
      } as any)

    const prisma = {
      ticket: { findFirst: jest.fn().mockResolvedValue(null) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any

    const svc = makeService(prisma)

    await expect(
      svc.getOne(PROVIDER_ID, USER_ID, UserRole.ADMIN, TICKET_ID),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

/**
 * SMA-WORK-CALENDAR-V1: календарь берёт заявки через resolveListWhere, а для
 * CLIENT_ADMIN действующий маршрут чтения — board. Здесь scope не подменяется:
 * проверяется, что для этой роли resolveListWhere даёт ровно контур board и не
 * шире — своя компания, без чужого контура, с привязками к объектам.
 */
describe('TicketsQueryService.resolveListWhere — CLIENT_ADMIN', () => {
  const CLIENT_ADMIN_ID = 'client-admin-1';
  const rows = [
    {
      id: 'own-1',
      companyId: CLIENT_ID,
      locationId: 'loc-own-1',
      status: TicketStatus.NEW,
    },
    {
      id: 'own-2',
      companyId: CLIENT_ID,
      locationId: 'loc-own-2',
      status: TicketStatus.ASSIGNED,
    },
    {
      id: 'foreign',
      companyId: 'client-2',
      locationId: 'loc-foreign',
      status: TicketStatus.NEW,
    },
  ];
  const visible = (where: unknown) =>
    rows.filter((row) => ticketMatchesWhere(where, row)).map((row) => row.id);

  afterEach(() => jest.restoreAllMocks());

  it('свой tenant: только заявки своей компании, тот же контур, что у board', async () => {
    const svc = makeService(makePrisma());

    const listScope = await svc.resolveListWhere(
      CLIENT_ID,
      CLIENT_ADMIN_ID,
      UserRole.CLIENT_ADMIN,
    );

    expect(listScope).toMatchObject({
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'tenant',
      technicianCompanyIds: null,
    });
    expect(visible(listScope.where)).toEqual(['own-1', 'own-2']);
  });

  it('чужой tenant через linkedClientCompanyId — отказ роли, контракт даже не спрашивается', async () => {
    const getLinkedClientAccess = jest
      .fn()
      .mockResolvedValue({ role: ServiceContractRole.PRIMARY });
    const svc = makeService(makePrisma(), { getLinkedClientAccess });

    await expect(
      svc.resolveListWhere(
        CLIENT_ID,
        CLIENT_ADMIN_ID,
        UserRole.CLIENT_ADMIN,
        undefined,
        undefined,
        'client-2',
      ),
    ).rejects.toThrow('Role cannot access linked client tickets');
    expect(getLinkedClientAccess).not.toHaveBeenCalled();
  });

  it('companyId наблюдателя для CLIENT_ADMIN игнорируется: остаётся своя компания', async () => {
    const svc = makeService(makePrisma());

    const listScope = await svc.resolveListWhere(
      CLIENT_ID,
      CLIENT_ADMIN_ID,
      UserRole.CLIENT_ADMIN,
      undefined,
      undefined,
      undefined,
      'client-2',
    );

    expect(listScope.visibilityMode).toBe('tenant');
    expect(visible(listScope.where)).toEqual(['own-1', 'own-2']);
  });

  it('restricted-empty: CLIENT_ADMIN без доступа к объектам не видит ни одной заявки', async () => {
    const prisma = {
      ...(makePrisma() as object),
      userAccessScope: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ locationMode: 'RESTRICTED_EMPTY' }),
      },
    };
    const svc = makeService(prisma);

    const listScope = await svc.resolveListWhere(
      CLIENT_ID,
      CLIENT_ADMIN_ID,
      UserRole.CLIENT_ADMIN,
    );

    expect(visible(listScope.where)).toEqual([]);
  });

  it('привязки к объектам сужают заявки CLIENT_ADMIN', async () => {
    const svc = makeService(makePrisma({ boundLocationIds: ['loc-own-2'] }));

    const listScope = await svc.resolveListWhere(
      CLIENT_ID,
      CLIENT_ADMIN_ID,
      UserRole.CLIENT_ADMIN,
    );

    expect(visible(listScope.where)).toEqual(['own-2']);
  });
});
