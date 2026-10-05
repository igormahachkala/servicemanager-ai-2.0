import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { CompanyType, Prisma, UserRole } from '@prisma/client'

import { FailureCausesService } from './failure-causes.service'
import * as ticketAccessUtils from '../tickets/ticket-access.utils'

jest.mock('../tickets/ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
}))

const mockResolveReadable = ticketAccessUtils.resolveReadableTicketAccess as jest.MockedFunction<
  typeof ticketAccessUtils.resolveReadableTicketAccess
>

const CLIENT_ID = 'client-1'
const PROVIDER_ID = 'provider-1'
const TICKET_ID = 'ticket-1'

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

function makeSetup(companyType: CompanyType = CompanyType.CLIENT) {
  const prisma = {
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: CLIENT_ID, type: companyType }),
    },
    failureCause: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'cause-1', companyId: CLIENT_ID, name: 'Износ', active: true }),
      findFirst: jest.fn().mockResolvedValue({ id: 'cause-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'cause-1', companyId: CLIENT_ID, name: 'Износ', active: true }),
      update: jest.fn().mockResolvedValue({ id: 'cause-1', companyId: CLIENT_ID, name: 'Дефект монтажа', active: true }),
    },
  } as any
  const serviceContracts = {}
  const svc = new FailureCausesService(prisma, serviceContracts as any)
  return { svc, prisma, serviceContracts }
}

describe('FailureCausesService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveReadable.mockReset()
  })

  it('creates a failure cause in own CLIENT company', async () => {
    const { svc, prisma } = makeSetup()

    await svc.create(CLIENT_ID, { name: '  Износ  ' })

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: CLIENT_ID },
      select: { id: true, type: true },
    })
    expect(prisma.failureCause.create).toHaveBeenCalledWith({
      data: {
        companyId: CLIENT_ID,
        name: 'Износ',
        active: true,
      },
    })
  })

  it('denies duplicate names inside one client company', async () => {
    const { svc, prisma } = makeSetup()
    prisma.failureCause.create.mockRejectedValue(uniqueError())

    await expect(svc.create(CLIENT_ID, { name: 'Износ' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('denies provider mutation of a linked client dictionary', async () => {
    const { svc, prisma } = makeSetup(CompanyType.PROVIDER)

    await expect(svc.create(PROVIDER_ID, { name: 'Ошибка эксплуатации' })).rejects.toBeInstanceOf(ForbiddenException)

    expect(prisma.failureCause.create).not.toHaveBeenCalled()
  })

  it('updates only causes belonging to the actor company', async () => {
    const { svc, prisma } = makeSetup()

    await svc.update(CLIENT_ID, 'cause-1', { name: 'Дефект монтажа' })

    expect(prisma.failureCause.findFirst).toHaveBeenCalledWith({
      where: { id: 'cause-1', companyId: CLIENT_ID },
      select: { id: true },
    })
    expect(prisma.failureCause.update).toHaveBeenCalledWith({
      where: { id: 'cause-1' },
      data: { name: 'Дефект монтажа' },
    })
  })

  it('fails closed when a cause is not in the actor company', async () => {
    const { svc, prisma } = makeSetup()
    prisma.failureCause.findFirst.mockResolvedValue(null)

    await expect(svc.update(CLIENT_ID, 'foreign-cause', { active: false })).rejects.toBeInstanceOf(NotFoundException)

    expect(prisma.failureCause.update).not.toHaveBeenCalled()
  })

  it('lists active causes for a ticket through canonical readable-ticket access', async () => {
    const { svc, prisma, serviceContracts } = makeSetup()
    mockResolveReadable.mockResolvedValue({
      ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
      scopeCompanyId: CLIENT_ID,
      visibilityMode: 'tenant',
    } as any)

    await svc.listActiveForTicket(
      { id: 'tech-1', role: UserRole.TECHNICIAN, companyId: PROVIDER_ID },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(mockResolveReadable).toHaveBeenCalledWith({
      prisma,
      serviceContractsService: serviceContracts,
      actor: { id: 'tech-1', role: UserRole.TECHNICIAN, companyId: PROVIDER_ID },
      ticketId: TICKET_ID,
      linkedClientCompanyId: CLIENT_ID,
      observerCompanyId: undefined,
    })
    expect(prisma.failureCause.findMany).toHaveBeenCalledWith({
      where: { companyId: CLIENT_ID, active: true },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('lists active own-company causes without exposing inactive rows when requested', async () => {
    const { svc, prisma } = makeSetup()

    await svc.listOwn(CLIENT_ID, 'true')

    expect(prisma.failureCause.findMany).toHaveBeenCalledWith({
      where: { companyId: CLIENT_ID, active: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('does not expose a physical delete method for used causes', () => {
    const { svc } = makeSetup()

    expect((svc as any).remove).toBeUndefined()
  })
})
