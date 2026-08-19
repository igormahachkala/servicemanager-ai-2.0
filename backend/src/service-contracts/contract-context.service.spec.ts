import { ServiceContractLocationMode, ServiceContractRole, ServiceContractStatus } from '@prisma/client'

import { ContractContextService } from './contract-context.service'

const PROVIDER_A = 'provider-a'
const CLIENT_X = 'client-x'
const CLIENT_Y = 'client-y'
const CLIENT_Z = 'client-z'
const HVAC = 'specialization-hvac'
const ELECTRICAL = 'specialization-electrical'

function makeContract(overrides: any = {}) {
  return {
    id: 'contract-x',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    clientCompanyId: CLIENT_X,
    providerCompanyId: PROVIDER_A,
    startsAt: null,
    endsAt: null,
    locations: [],
    ...overrides,
  }
}

function makeService() {
  const contracts = [
    makeContract({
      id: 'contract-x',
      role: ServiceContractRole.SECONDARY,
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      clientCompanyId: CLIENT_X,
      locations: [{ locationId: 'x1' }, { locationId: 'x2' }],
    }),
    makeContract({
      id: 'contract-y',
      role: ServiceContractRole.PRIMARY,
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      clientCompanyId: CLIENT_Y,
      locations: [{ locationId: 'y1' }],
    }),
    makeContract({
      id: 'contract-z',
      role: ServiceContractRole.PRIMARY,
      locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
      clientCompanyId: CLIENT_Z,
    }),
  ]
  const contractSpecializations = new Map<string, string[]>([
    ['contract-x', [HVAC]],
    ['contract-y', [ELECTRICAL]],
  ])
  const tickets = new Map([
    ['ticket-y', { id: 'ticket-y', companyId: CLIENT_Y }],
  ])

  const prisma = {
    serviceContract: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id) {
          return contracts.find((contract) => contract.id === where.id) ?? null
        }
        return contracts.find((contract) =>
          contract.providerCompanyId === where.providerCompanyId &&
          contract.clientCompanyId === where.clientCompanyId
        ) ?? null
      }),
      findMany: jest.fn(async ({ where }: any) =>
        contracts.filter((contract) =>
          contract.clientCompanyId === where.clientCompanyId &&
          (!where.role || contract.role === where.role) &&
          (!where.id?.not || contract.id !== where.id.not)
        ),
      ),
    },
    serviceContractSpecialization: {
      findMany: jest.fn(async ({ where }: any) =>
        (contractSpecializations.get(where.serviceContractId) ?? []).map((specializationId) => ({
          specializationId,
        })),
      ),
    },
    ticket: {
      findUnique: jest.fn(async ({ where }: any) => tickets.get(where.id) ?? null),
    },
  }

  return { svc: new ContractContextService(prisma as any), prisma }
}

describe('ContractContextService', () => {
  it('keeps location and specialization scopes isolated across provider contracts', async () => {
    const { svc } = makeService()

    const contractX = await svc.getContractContext({
      providerCompanyId: PROVIDER_A,
      clientCompanyId: CLIENT_X,
    })
    const contractY = await svc.getContractContext({
      providerCompanyId: PROVIDER_A,
      clientCompanyId: CLIENT_Y,
    })

    expect(contractX).toMatchObject({
      contractId: 'contract-x',
      serviceContractId: 'contract-x',
      clientCompanyId: CLIENT_X,
      providerCompanyId: PROVIDER_A,
      roleInContract: ServiceContractRole.SECONDARY,
      specializationMode: 'EXPLICIT',
      specializationIds: [HVAC],
    })
    expect(contractX?.contractLocationScope).toEqual({
      mode: 'bound_locations',
      locationIds: ['x1', 'x2'],
    })

    expect(contractY).toMatchObject({
      contractId: 'contract-y',
      serviceContractId: 'contract-y',
      clientCompanyId: CLIENT_Y,
      providerCompanyId: PROVIDER_A,
      roleInContract: ServiceContractRole.PRIMARY,
      specializationMode: 'EXPLICIT',
      specializationIds: [ELECTRICAL],
    })
    expect(contractY?.contractLocationScope).toEqual({
      mode: 'bound_locations',
      locationIds: ['y1'],
    })

    expect(contractX?.specializationIds).not.toContain(ELECTRICAL)
    expect(contractY?.specializationIds).not.toContain(HVAC)
    expect(contractX?.locationIds).not.toContain('y1')
    expect(contractY?.locationIds).not.toEqual(expect.arrayContaining(['x1', 'x2']))
  })

  it('resolves client context from the ticket when linked client is not explicit', async () => {
    const { svc, prisma } = makeService()

    const context = await svc.getContractContext({
      actorCompanyId: PROVIDER_A,
      ticketId: 'ticket-y',
    })

    expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
      where: { id: 'ticket-y' },
      select: { companyId: true },
    })
    expect(context?.serviceContractId).toBe('contract-y')
    expect(context?.roleInContract).toBe(ServiceContractRole.PRIMARY)
  })

  it('exposes reusable location and specialization scope helpers', async () => {
    const { svc } = makeService()

    await expect(svc.getContractLocationScope('contract-x')).resolves.toEqual({
      mode: 'bound_locations',
      locationIds: ['x1', 'x2'],
    })
    await expect(svc.getContractSpecializationScope('contract-x')).resolves.toEqual({
      mode: 'EXPLICIT',
      specializationIds: [HVAC],
    })
  })

  it('returns UNCONFIGURED for contracts without specialization rows', async () => {
    const { svc } = makeService()

    await expect(svc.getContractSpecializationScope('contract-z')).resolves.toEqual({
      mode: 'UNCONFIGURED',
      specializationIds: [],
    })
  })
})
