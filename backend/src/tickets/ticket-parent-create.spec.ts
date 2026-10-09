import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CompanyType, TicketStatus, UserRole } from '@prisma/client'

import {
  assertParentTicketOwnerCompany,
  loadParentTicketForCreate,
  resolveParentCreateLocationId,
  type ParentTicketForCreate,
} from './ticket-parent-create'
import { TicketsAssignmentService } from './tickets.assignment.service'

const mockAssertActorCanUseLocation = jest.fn()
const mockAssertActorCanUseProblemCategory = jest.fn()

jest.mock('./ticket-access.utils', () => {
  const actual = jest.requireActual('./ticket-access.utils')
  return {
    ...actual,
    assertActorCanUseLocation: (...args: any[]) => mockAssertActorCanUseLocation(...args),
    assertActorCanUseProblemCategory: (...args: any[]) =>
      mockAssertActorCanUseProblemCategory(...args),
  }
})

function makeParent(overrides?: Partial<ParentTicketForCreate>): ParentTicketForCreate {
  return {
    id: 'parent-1',
    companyId: 'client-company',
    locationId: 'location-1',
    ticketNumber: 42,
    requesterName: 'Иван',
    requesterPhone: '+7999',
    address: 'Уфа, ул. Тест, 1',
    pointName: 'Точка 1',
    ...overrides,
  }
}

describe('ticket-parent-create', () => {
  it('loads parent by id without companyId from JWT', async () => {
    const parent = makeParent()
    const findFirst = jest.fn().mockResolvedValue(parent)
    const loaded = await loadParentTicketForCreate({ ticket: { findFirst } }, 'parent-1')

    expect(loaded).toEqual(parent)
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'parent-1' },
      select: expect.objectContaining({
        id: true,
        companyId: true,
        locationId: true,
        ticketNumber: true,
      }),
    })
  })

  it('returns 404 when parent is missing', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    await expect(
      loadParentTicketForCreate({ ticket: { findFirst } }, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('takes location from parent and rejects a diverging locationId', () => {
    const parent = makeParent()
    expect(resolveParentCreateLocationId({ parent, requestedLocationId: null })).toBe('location-1')
    expect(resolveParentCreateLocationId({ parent, requestedLocationId: 'location-1' })).toBe(
      'location-1',
    )
    expect(() =>
      resolveParentCreateLocationId({ parent, requestedLocationId: 'other-location' }),
    ).toThrow(BadRequestException)
  })

  it('rejects a parent from another client company', () => {
    const parent = makeParent({ companyId: 'other-client' })
    expect(() =>
      assertParentTicketOwnerCompany({ parent, targetCompanyId: 'client-company' }),
    ).toThrow(NotFoundException)
  })

  it('accepts a parent of the same client company', () => {
    expect(() =>
      assertParentTicketOwnerCompany({
        parent: makeParent(),
        targetCompanyId: 'client-company',
      }),
    ).not.toThrow()
  })
})

describe('TicketsAssignmentService parent create events', () => {
  const providerCompanyId = 'provider-company'
  const clientCompanyId = 'client-company'
  const locationId = 'location-1'
  const categoryId = 'category-1'
  const parent = makeParent({ companyId: clientCompanyId, locationId })

  function makeCreateHarness() {
    const createdTicket = {
      id: 'ticket-1',
      ticketNumber: 1001,
      companyId: clientCompanyId,
      locationId,
      parentId: parent.id,
      problemCategoryId: categoryId,
      problemText: 'Generated problem',
      urgency: 'NOT_URGENT',
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
    }
    const tx = {
      ticket: {
        create: jest.fn().mockResolvedValue(createdTicket),
        update: jest.fn(),
      },
      ticketStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'status-history-1' }),
      },
    }
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      ticket: {
        findFirst: jest.fn().mockResolvedValue(parent),
      },
      permissionBlock: { count: jest.fn().mockResolvedValue(0) },
      company: { findUnique: jest.fn() },
      rolePermission: { findFirst: jest.fn() },
      userPermission: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
    }
    const timeline = {
      recordTx: jest.fn().mockResolvedValue({ id: 'timeline-event-1' }),
      recordLegacyTx: jest.fn().mockResolvedValue({ id: 'legacy-event-1' }),
    }
    const attachments = {
      bindAttachmentsToTicketTx: jest.fn().mockResolvedValue([]),
    }
    const serviceContracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: 'PRIMARY',
        status: 'ACTIVE',
      }),
      listSecondaryProviderCompanyIds: jest.fn().mockResolvedValue([]),
    }
    const notifications = {
      onTicketCreated: jest.fn(),
      scheduleTicketCommentAdded: jest.fn(),
      onTicketAssigned: jest.fn(),
    }
    const service = new TicketsAssignmentService(
      prisma as any,
      { selectTechnicianForTicket: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      timeline as any,
      attachments as any,
      serviceContracts as any,
      { resolveBoundCreateScope: jest.fn() } as any,
      notifications as any,
    )
    jest.spyOn(service as any, 'resolveTicketOwnerCompanyId').mockResolvedValue(clientCompanyId)
    jest.spyOn(service as any, 'assertActorCanUseLocationForScope').mockResolvedValue(undefined)
    jest.spyOn(service as any, 'getCompany').mockResolvedValue({
      id: clientCompanyId,
      type: CompanyType.CLIENT,
      autoAssignEnabled: false,
      allowTechnicianClaim: true,
    })
    jest.spyOn(service as any, 'getCategory').mockResolvedValue({
      id: categoryId,
      name: 'Electrical',
      instructions: null,
      specializationLinks: [],
    })
    jest.spyOn(service as any, 'getLocation').mockResolvedValue({
      id: locationId,
      name: 'Client location',
      address: 'Address 1',
    })
    jest.spyOn(service as any, 'resolveCreateCandidates').mockResolvedValue([])

    return { service, prisma, tx, timeline }
  }

  beforeEach(() => {
    mockAssertActorCanUseLocation.mockReset()
    mockAssertActorCanUseProblemCategory.mockReset()
    mockAssertActorCanUseProblemCategory.mockResolvedValue({ id: categoryId })
  })

  it('records TICKET_CREATED on the child and CHILD_TICKET_CREATED on the parent', async () => {
    const { service, tx, timeline } = makeCreateHarness()

    await service.create(providerCompanyId, 'admin-1', UserRole.ADMIN, {
      parentId: parent.id,
      locationId,
      categoryId,
      description: 'Check switch port',
    } as any)

    expect(timeline.recordTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'TICKET_CREATED',
        ticketId: 'ticket-1',
        actorUserId: 'admin-1',
        payload: expect.objectContaining({
          parentId: parent.id,
          parentTicketNumber: 42,
        }),
      }),
    )
    expect(timeline.recordTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'CHILD_TICKET_CREATED',
        ticketId: parent.id,
        companyId: clientCompanyId,
        actorUserId: 'admin-1',
        payload: {
          childTicketId: 'ticket-1',
          childTicketNumber: 1001,
        },
      }),
    )
  })

  it('rejects locationId that does not match the parent', async () => {
    const { service, prisma } = makeCreateHarness()

    await expect(
      service.create(providerCompanyId, 'admin-1', UserRole.ADMIN, {
        parentId: parent.id,
        locationId: 'other-location',
        categoryId,
        description: 'Check switch port',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a parent from another client company', async () => {
    const { service, prisma } = makeCreateHarness()
    prisma.ticket.findFirst.mockResolvedValue(makeParent({ companyId: 'other-client' }))

    await expect(
      service.create(providerCompanyId, 'admin-1', UserRole.ADMIN, {
        parentId: parent.id,
        locationId,
        categoryId,
        description: 'Check switch port',
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('createChild assembles CreateTicketDto from the parent and calls create', async () => {
    const { service } = makeCreateHarness()
    const createSpy = jest.spyOn(service, 'create').mockResolvedValue({
      ticket: { id: 'ticket-1', parentId: parent.id },
    } as any)

    const result = await service.createChild(
      providerCompanyId,
      'admin-1',
      UserRole.ADMIN,
      parent.id,
      {
        problemCategoryId: categoryId,
        problemText: 'Check switch port',
      } as any,
    )

    expect(createSpy).toHaveBeenCalledWith(
      providerCompanyId,
      'admin-1',
      UserRole.ADMIN,
      expect.objectContaining({
        parentId: parent.id,
        clientCompanyId: clientCompanyId,
        locationId,
        categoryId,
        problemCategoryId: categoryId,
        description: 'Check switch port',
        requesterName: parent.requesterName,
        address: parent.address,
      }),
    )
    expect(result.parentId).toBe(parent.id)
  })
})
