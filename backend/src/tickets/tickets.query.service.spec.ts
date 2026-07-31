import { NotFoundException } from '@nestjs/common'
import { ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { TicketsQueryService } from './tickets.query.service'
import * as ticketAccessUtils from './ticket-access.utils'

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

function makePrisma(opts: { executorIds?: string[]; boundLocationIds?: string[] } = {}) {
  return {
    ticket: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    domainEvent: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findFirst: jest.fn().mockResolvedValue({ isExecutor: false }),
      findMany: jest.fn().mockResolvedValue((opts.executorIds ?? []).map((id) => ({ id }))),
    },
    userLocationBinding: {
      findMany: jest.fn().mockResolvedValue((opts.boundLocationIds ?? []).map((locationId) => ({ locationId }))),
    },
  } as any
}

function makeService(prisma: any, serviceContractsOverride: Record<string, any> = {}) {
  // TimelineService is only used by TicketMetaBuilder (getOne path).
  // ServiceContractsService.getLinkedClientAccess is consulted by the SECONDARY
  // operational-scope check; default to null (no SECONDARY restriction) so these
  // tests exercise the management/technician scoping they target.
  const serviceContracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(null),
    listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    ...serviceContractsOverride,
  }
  return new TicketsQueryService(prisma, {} as any, serviceContracts as any)
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

const wideLocationScope = { mode: 'tenant_wide' as const, locationIds: [] as string[] }

function fieldMatches(condition: any, value: any): boolean {
  if (condition === undefined) return true
  if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
    return value === condition
  }
  if ('equals' in condition) return value === condition.equals
  if ('in' in condition) return Array.isArray(condition.in) && condition.in.includes(value)
  if ('notIn' in condition) return Array.isArray(condition.notIn) && !condition.notIn.includes(value)
  if ('not' in condition) return value !== condition.not
  return true
}

function ticketMatchesWhere(where: any, ticket: any): boolean {
  if (!where) return true
  if (where.id?.equals === '__no_access__') return false
  if (Array.isArray(where.AND)) {
    return where.AND.every((part: any) => ticketMatchesWhere(part, ticket))
  }
  if (Array.isArray(where.OR)) {
    return where.OR.some((part: any) => ticketMatchesWhere(part, ticket))
  }
  if (!fieldMatches(where.id, ticket.id)) return false
  if (!fieldMatches(where.companyId, ticket.companyId)) return false
  if (!fieldMatches(where.locationId, ticket.locationId)) return false
  if (!fieldMatches(where.assignedTechnicianId, ticket.assignedTechnicianId)) return false
  if (!fieldMatches(where.status, ticket.status)) return false
  return true
}

// ── list ──────────────────────────────────────────────────────────────────────

describe('TicketsQueryService.list', () => {
  let spyTechScope: jest.SpyInstance
  let spyReadScope: jest.SpyInstance
  let spyLocationScope: jest.SpyInstance

  beforeEach(() => {
    spyTechScope = jest.spyOn(ticketAccessUtils, 'resolveTechnicianOperationalScope')
    spyReadScope = jest.spyOn(ticketAccessUtils, 'resolveTicketReadScope').mockResolvedValue(makeManagementScope())
    spyLocationScope = jest.spyOn(ticketAccessUtils, 'resolveActorLocationScope').mockResolvedValue(wideLocationScope)
  })

  afterEach(() => jest.restoreAllMocks())

  it('TECHNICIAN: calls resolveTechnicianOperationalScope, skips resolveTicketReadScope', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID]))
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN)

    expect(spyTechScope).toHaveBeenCalledWith(
      expect.objectContaining({ actor: expect.objectContaining({ role: UserRole.TECHNICIAN }) }),
    )
    expect(spyReadScope).not.toHaveBeenCalled()
    expect(prisma.ticket.findMany).toHaveBeenCalled()
  })

  it('TECHNICIAN with two companyIds: findMany where references both companies', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN)

    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).toContain(PROVIDER_ID)
    expect(whereStr).toContain(CLIENT_ID)
  })

  it('ADMIN: calls resolveTicketReadScope, skips resolveTechnicianOperationalScope', async () => {
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN)

    expect(spyTechScope).not.toHaveBeenCalled()
    expect(spyReadScope).toHaveBeenCalled()
  })

  it('ADMIN own company: findMany where is scoped to provider companyId', async () => {
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN)

    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).toContain(PROVIDER_ID)
  })

  it('ADMIN linked-client list applies SELECTED_LOCATIONS to one selected location', async () => {
    spyReadScope.mockResolvedValue(makeManagementScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({ mode: 'bound_locations', locationIds: ['loc-selected'] })
    const rows = [
      { id: 'ticket-selected', companyId: CLIENT_ID, locationId: 'loc-selected', assignedTechnicianId: null, status: TicketStatus.NEW },
      { id: 'ticket-forbidden', companyId: CLIENT_ID, locationId: 'loc-forbidden', assignedTechnicianId: null, status: TicketStatus.NEW },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN, undefined, undefined, CLIENT_ID)

    expect(result.map((ticket: any) => ticket.id)).toEqual(['ticket-selected'])
    expect(JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)).toContain('loc-selected')
  })

  it('ADMIN linked-client list fail-closes SELECTED_LOCATIONS with no bindings', async () => {
    spyReadScope.mockResolvedValue(makeManagementScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({ mode: 'bound_locations', locationIds: [] })
    const rows = [
      { id: 'ticket-forbidden', companyId: CLIENT_ID, locationId: 'loc-forbidden', assignedTechnicianId: null, status: TicketStatus.NEW },
    ]
    const prisma = makePrisma()
    prisma.ticket.findMany.mockImplementation(async ({ where }: any) =>
      rows.filter((ticket) => ticketMatchesWhere(where, ticket)),
    )
    const svc = makeService(prisma)

    const result = await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN, undefined, undefined, CLIENT_ID)

    expect(result).toEqual([])
    expect(JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)).toContain('__no_access__')
  })

  it('ADMIN with linkedClientCompanyId: passes it through to resolveTicketReadScope', async () => {
    spyReadScope.mockResolvedValue(makeManagementScope(CLIENT_ID))
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.ADMIN, undefined, undefined, CLIENT_ID)

    expect(spyReadScope).toHaveBeenCalledWith(
      expect.objectContaining({ linkedClientCompanyId: CLIENT_ID }),
    )
  })

  it('status filter is applied when provided', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID]))
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, TicketStatus.ASSIGNED)

    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).toContain('ASSIGNED')
  })

  it('TECHNICIAN with explicit SECONDARY linked client applies operational scope fail-closed', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma()
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, undefined, undefined, CLIENT_ID)

    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(PROVIDER_ID, CLIENT_ID)
    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
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

    const result = await svc.list(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, undefined, undefined, CLIENT_ID)

    expect(result.map((ticket: any) => ticket.id)).toEqual(['ticket-allowed'])
  })
})

// ── board ─────────────────────────────────────────────────────────────────────

describe('TicketsQueryService.board', () => {
  let spyTechScope: jest.SpyInstance
  let spyReadScope: jest.SpyInstance
  let spyLocationScope: jest.SpyInstance

  beforeEach(() => {
    spyTechScope = jest.spyOn(ticketAccessUtils, 'resolveTechnicianOperationalScope')
    spyReadScope = jest.spyOn(ticketAccessUtils, 'resolveTicketReadScope').mockResolvedValue(makeManagementScope())
    spyLocationScope = jest.spyOn(ticketAccessUtils, 'resolveActorLocationScope').mockResolvedValue(wideLocationScope)
  })

  afterEach(() => jest.restoreAllMocks())

  it('returns exactly 6 columns covering all ticket statuses', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const svc = makeService(makePrisma())

    const result = await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

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

    const result = await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

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
    spyReadScope.mockResolvedValue(makeManagementScope(CLIENT_ID))
    spyLocationScope.mockResolvedValue({ mode: 'bound_locations', locationIds: [] })
    const prisma = makePrisma()
    const svc = makeService(prisma)

    const result = await svc.board(PROVIDER_ID, USER_ID, UserRole.ADMIN, {}, undefined, CLIENT_ID)

    expect(JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)).toContain('__no_access__')
    expect(result.meta.totalTickets).toBe(0)
    expect(result.columns.every((column) => column.total === 0 && column.cards.length === 0)).toBe(true)
  })

  it('columns include sla counters and card arrays', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const svc = makeService(makePrisma())

    const result = await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

    for (const col of result.columns) {
      expect(col).toHaveProperty('total')
      expect(col).toHaveProperty('sla')
      expect(col).toHaveProperty('cards')
      expect(Array.isArray(col.cards)).toBe(true)
    }
  })

  it('archive filter: includes OR condition guarding DONE tickets by default', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    // applyArchivedFilter wraps the where with AND containing { OR: [{ status: { not: DONE } }, ...] }
    expect(whereStr).toContain('DONE')
  })

  it('archive filter absent when includeArchived = true', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const prisma = makePrisma()
    const svc = makeService(prisma)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, { includeArchived: true })

    // Without archive filter, no closedAt threshold is added
    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).not.toContain('closedAt')
  })

  it('meta.limitedToLast defaults to 500 when no take is provided', async () => {
    spyTechScope.mockResolvedValue(makeTechScope())
    const svc = makeService(makePrisma())

    const result = await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

    expect(result.meta.limitedToLast).toBe(500)
  })

  it('TECHNICIAN with explicit SECONDARY linked client limits board to executor or bound locations', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma({ executorIds: [USER_ID], boundLocationIds: ['loc-allowed'] })
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {}, undefined, CLIENT_ID)

    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(PROVIDER_ID, CLIENT_ID)
    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).toContain(USER_ID)
    expect(whereStr).toContain('loc-allowed')
  })

  it('TECHNICIAN aggregate board constrains SECONDARY companies without constraining own or PRIMARY companies', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, 'primary-client', CLIENT_ID]))
    const prisma = makePrisma()
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.board(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, {})

    expect(contracts.listSecondaryLinkedClientIds).toHaveBeenCalledWith(PROVIDER_ID)
    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).toContain('notIn')
    expect(whereStr).toContain(CLIENT_ID)
    expect(whereStr).toContain('__no_access__')
  })
})

// ── context analytics ─────────────────────────────────────────────────────────

describe('TicketsQueryService.contextAnalytics', () => {
  let spyTechScope: jest.SpyInstance
  let spyReadScope: jest.SpyInstance
  let spyLocationScope: jest.SpyInstance

  beforeEach(() => {
    spyTechScope = jest.spyOn(ticketAccessUtils, 'resolveTechnicianOperationalScope')
    spyReadScope = jest.spyOn(ticketAccessUtils, 'resolveTicketReadScope').mockResolvedValue(makeManagementScope())
    spyLocationScope = jest.spyOn(ticketAccessUtils, 'resolveActorLocationScope').mockResolvedValue(wideLocationScope)
  })

  afterEach(() => jest.restoreAllMocks())

  it('TECHNICIAN with explicit SECONDARY linked client applies the same fail-closed scope as board/list', async () => {
    spyTechScope.mockResolvedValue(makeTechScope([PROVIDER_ID, CLIENT_ID]))
    const prisma = makePrisma()
    const contracts = makeSecondaryContracts()
    const svc = makeService(prisma, contracts)

    await svc.contextAnalytics(PROVIDER_ID, USER_ID, UserRole.TECHNICIAN, undefined, CLIENT_ID)

    expect(spyReadScope).not.toHaveBeenCalled()
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(PROVIDER_ID, CLIENT_ID)
    const whereStr = JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where)
    expect(whereStr).toContain('__no_access__')
  })
})

// ── getOne ────────────────────────────────────────────────────────────────────

describe('TicketsQueryService.getOne', () => {
  afterEach(() => jest.restoreAllMocks())

  it('throws NotFoundException when ticket is absent after access check', async () => {
    jest.spyOn(ticketAccessUtils, 'resolveReadableTicketAccess').mockResolvedValue({
      ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
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
