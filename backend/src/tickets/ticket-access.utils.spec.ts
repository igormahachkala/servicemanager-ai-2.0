import { BadRequestException } from '@nestjs/common'
import { ServiceContractRole, UserRole } from '@prisma/client'

import { resolveReadableTicketAccess, resolveTicketReadScope } from './ticket-access.utils'

describe('ticket-access utils SECONDARY provider visibility', () => {
  const providerCompanyId = 'provider-1'
  const clientCompanyId = 'client-1'
  const ticketId = 'ticket-1'

  function makeServiceContractsService(contractRole: ServiceContractRole) {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: contractRole,
        status: 'ACTIVE',
        clientCompanyId,
        providerCompanyId,
      }),
      listLinkedClients: jest.fn().mockResolvedValue([
        {
          linkedClientCompanyId: clientCompanyId,
          role: contractRole,
        },
      ]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }
  }

  function makePrismaTicketMock(readableTicketCompanyId = clientCompanyId) {
    const ticket = {
      id: ticketId,
      companyId: readableTicketCompanyId,
      assignedTechnicianId: null,
    }

    return {
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          const companyId = where?.companyId
          if (companyId === providerCompanyId) {
            return null
          }
          if (companyId?.in && Array.isArray(companyId.in) && companyId.in.includes(clientCompanyId)) {
            return ticket
          }
          return null
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: providerCompanyId }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ isExecutor: false, technicianSpecializations: [] }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps SECONDARY contract blocked by default for ticket reads (management path, non-executor role)', async () => {
    // Use NETWORK_DIRECTOR: in PROVIDER_LINKED_OVERVIEW_ROLES but NOT executor-capable.
    // This exercises the management board path without hitting the executor scope.
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.NETWORK_DIRECTOR,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(providerCompanyId, clientCompanyId)
  })

  it('allows explicit SECONDARY contract access for operational ticket reads when enabled (management path)', async () => {
    // Use NETWORK_DIRECTOR to test the management board path with SECONDARY explicitly enabled.
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'user-1',
        role: UserRole.NETWORK_DIRECTOR,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result).toEqual({
      ticket: {
        id: ticketId,
        companyId: clientCompanyId,
        assignedTechnicianId: null,
      },
      scopeCompanyId: clientCompanyId,
      visibilityMode: 'provider_primary',
    })
  })

  it('allows explicit SECONDARY contract access via direct ticket fallback when enabled', async () => {
    const prisma = {
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where?.companyId?.in) {
            return null
          }
          return null
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: ticketId,
          companyId: clientCompanyId,
          assignedTechnicianId: null,
        }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: providerCompanyId }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ isExecutor: false }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'user-1',
        role: UserRole.NETWORK_DIRECTOR,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result).toEqual({
      ticket: {
        id: ticketId,
        companyId: clientCompanyId,
        assignedTechnicianId: null,
      },
      scopeCompanyId: clientCompanyId,
      visibilityMode: 'provider_primary',
    })
  })

  it('keeps company/analytics scope PRIMARY-only by default', async () => {
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    await expect(
      resolveTicketReadScope({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actorCompanyId: providerCompanyId,
        role: UserRole.ADMIN,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientRoles: [UserRole.ADMIN],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(providerCompanyId, clientCompanyId)
    expect(serviceContractsService.listLinkedClients).not.toHaveBeenCalled()
  })

  it('allows explicit SECONDARY contract scope for operational ticket read scope when enabled', async () => {
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    const result = await resolveTicketReadScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actorCompanyId: providerCompanyId,
      role: UserRole.ADMIN,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientRoles: [UserRole.ADMIN],
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result).toEqual({
      scopeCompanyId: clientCompanyId,
      visibilityMode: 'provider_primary',
    })
  })
})

describe('resolveReadableTicketAccess — PRIMARY provider ADMIN with linkedClientCompanyId', () => {
  // Regression test for Failure 2:
  // PRIMARY_PROVIDER_ADMIN calling getOne/assign with linkedClientCompanyId was hitting
  // resolveTechnicianOperationalScope which guards PRIMARY against non-TECHNICIAN roles,
  // causing a false 403.  The fix: skip executor scope when linkedClientCompanyId is provided
  // and the role is a management role (PROVIDER_LINKED_OVERVIEW_ROLES).

  const providerCompanyId = 'primary-provider'
  const clientCompanyId = 'client-co'
  const ticketId = 'ticket-42'
  const adminUserId = 'admin-user'

  function makeServiceContracts() {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        status: 'ACTIVE',
        clientCompanyId,
        providerCompanyId,
      }),
      listLinkedClients: jest.fn().mockResolvedValue([
        { linkedClientCompanyId: clientCompanyId, role: ServiceContractRole.PRIMARY },
      ]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([clientCompanyId]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }
  }

  function makePrisma() {
    const ticket = { id: ticketId, companyId: clientCompanyId, assignedTechnicianId: null }
    return {
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          // Return null for own-company check (companyId = providerCompanyId)
          if (where?.companyId === providerCompanyId) return null
          // Return ticket for linked-client lookup (companyId: { in: [clientCompanyId] })
          if (where?.companyId?.in?.includes(clientCompanyId)) return ticket
          return null
        }),
        findUnique: jest.fn().mockResolvedValue(ticket),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: providerCompanyId }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: adminUserId, technicianSpecializations: [] }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any
  }

  afterEach(() => jest.restoreAllMocks())

  it('ADMIN with linkedClientCompanyId (PRIMARY contract) resolves via management path, not executor scope', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: adminUserId, role: UserRole.ADMIN, companyId: providerCompanyId },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
    // listPrimaryLinkedClientIds must NOT have been called — that's only in the executor scope path
    expect(svc.listPrimaryLinkedClientIds).not.toHaveBeenCalled()
  })

  it('MASTER with linkedClientCompanyId (PRIMARY contract) also resolves via management path', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: adminUserId, role: UserRole.MASTER, companyId: providerCompanyId },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('DISPATCHER with linkedClientCompanyId (PRIMARY contract) also resolves via management path', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: adminUserId, role: UserRole.DISPATCHER, companyId: providerCompanyId },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })
})
