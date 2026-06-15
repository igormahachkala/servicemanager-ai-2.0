import { NotFoundException } from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

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

function makePrisma() {
  return {
    ticket: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    domainEvent: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findFirst: jest.fn().mockResolvedValue({ isExecutor: false }) },
    userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
  } as any
}

function makeService(prisma: any) {
  // TimelineService is only used by TicketMetaBuilder (getOne path).
  // ServiceContractsService.getLinkedClientAccess is consulted by the SECONDARY
  // operational-scope check; default to null (no SECONDARY restriction) so these
  // tests exercise the management/technician scoping they target.
  const serviceContracts = { getLinkedClientAccess: jest.fn().mockResolvedValue(null) }
  return new TicketsQueryService(prisma, {} as any, serviceContracts as any)
}

const wideLocationScope = { mode: 'tenant_wide' as const, locationIds: [] as string[] }

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
