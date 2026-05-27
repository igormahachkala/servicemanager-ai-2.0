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
