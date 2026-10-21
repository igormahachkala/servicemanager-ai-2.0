import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import {
  InspectionCheckpointResponseType,
  InspectionRunItemStatus,
  InspectionRunStatus,
  TicketUrgency,
  UserRole,
} from '@prisma/client'

import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { ActiveShiftRequiredException } from '../workforce/shift-policy.service'

import { InspectionService } from './inspection.service'

const USER = {
  id: 'user-1',
  companyId: 'company-1',
  role: UserRole.ADMIN,
}

function makeService(overrides: Record<string, any> = {}, deps: { shiftPolicy?: any } = {}) {
  const prisma = {
    inspectionTemplate: {
      create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'template-1' }),
    },
    inspectionTemplateItem: {
      create: jest.fn().mockResolvedValue({ id: 'template-item-new' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({ id: 'template-item-1' }),
    },
    inspectionRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue({ id: 'location-1', name: 'Location 1', clientCompanyId: USER.companyId }),
    },
    equipment: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: USER.id }),
    },
    userAccessScope: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userLocationBinding: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inspectionRunItem: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'item-1' }),
    },
    inspectionRunItemAttachment: {
      create: jest.fn(),
    },
    ...overrides,
  }
  ;(prisma as any).$transaction = jest.fn(async (handler: any) => handler(prisma))
  const tickets = {
    create: jest.fn().mockResolvedValue({
      ticket: { id: 'ticket-1', ticketNumber: 101 },
      generated: null,
      autoAssigned: false,
    }),
  }
  const timeline = { recordLegacy: jest.fn().mockResolvedValue(undefined) }
  const exporter = { exportReport: jest.fn() }
  const serviceContracts = new ServiceContractsService({
    serviceContract: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any)

  return {
    prisma,
    tickets,
    timeline,
    service: new InspectionService(
      prisma as any,
      tickets as any,
      timeline as any,
      exporter as any,
      serviceContracts,
      undefined,
      deps.shiftPolicy,
    ),
  }
}

describe('InspectionService round zone/checkpoint foundation', () => {
  it('creates templates with multiple ordered zones and checkpoint metadata', async () => {
    const { prisma, service } = makeService()

    await service.createTemplate(USER, {
      name: 'Daily round',
      items: [
        {
          title: 'Sink',
          zoneName: 'Bathroom',
          zoneSortOrder: 2,
          checkpointSortOrder: 1,
          responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
        },
        {
          title: 'Door',
          zoneName: 'Hall',
          zoneSortOrder: 1,
          checkpointSortOrder: 0,
          responseType: InspectionCheckpointResponseType.YES_NO,
          isRequired: false,
        },
        {
          title: 'Temperature',
          zoneName: 'Hall',
          zoneSortOrder: 1,
          checkpointSortOrder: 1,
          responseType: InspectionCheckpointResponseType.NUMBER,
          numericMin: 18,
          numericMax: 24,
          numericUnit: 'C',
        },
      ],
    } as any)

    const createArg = prisma.inspectionTemplate.create.mock.calls[0][0]
    expect(createArg.data.items.create).toEqual([
      expect.objectContaining({
        title: 'Door',
        zoneName: 'Hall',
        zoneSortOrder: 1,
        checkpointSortOrder: 0,
        responseType: InspectionCheckpointResponseType.YES_NO,
        isRequired: false,
      }),
      expect.objectContaining({
        title: 'Temperature',
        zoneName: 'Hall',
        zoneSortOrder: 1,
        checkpointSortOrder: 1,
        responseType: InspectionCheckpointResponseType.NUMBER,
        numericMin: 18,
        numericMax: 24,
        numericUnit: 'C',
      }),
      expect.objectContaining({
        title: 'Sink',
        zoneName: 'Bathroom',
        zoneSortOrder: 2,
        checkpointSortOrder: 1,
      }),
    ])
  })

  it('keeps old flat templates readable through default metadata', async () => {
    const { prisma, service } = makeService()

    await service.createTemplate(USER, {
      name: 'Legacy checklist',
      items: [{ title: 'Old item', sortOrder: 7 }],
    } as any)

    const item = prisma.inspectionTemplate.create.mock.calls[0][0].data.items.create[0]
    expect(item).toEqual(expect.objectContaining({
      title: 'Old item',
      sortOrder: 7,
      zoneName: null,
      zoneSortOrder: 0,
      checkpointSortOrder: 7,
      responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
      isRequired: true,
    }))
  })

  it('snapshots zone and checkpoint identity when a run starts', async () => {
    const { prisma, service } = makeService()
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Round template',
      items: [
        {
          id: 'template-item-1',
          title: 'Door',
          description: 'Check the entrance door',
          sortOrder: 0,
          zoneName: 'Hall',
          zoneSortOrder: 1,
          checkpointSortOrder: 0,
          responseType: InspectionCheckpointResponseType.YES_NO,
          numericMin: null,
          numericMax: null,
          numericUnit: null,
          isRequired: true,
        },
      ],
    })

    await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })

    const runCreate = prisma.inspectionRun.create.mock.calls[0][0]
    expect(runCreate.data.items.create[0]).toEqual(expect.objectContaining({
      templateItemId: 'template-item-1',
      title: 'Door',
      description: 'Check the entrance door',
      zoneName: 'Hall',
      zoneSortOrder: 1,
      checkpointSortOrder: 0,
      responseType: InspectionCheckpointResponseType.YES_NO,
      status: InspectionRunItemStatus.PENDING,
      requiresRepair: false,
    }))
  })

  it('blocks round start through canonical ShiftPolicy before creating a run', async () => {
    const shiftPolicy = {
      assertActiveShiftForOperationalWork: jest.fn().mockRejectedValue(new ActiveShiftRequiredException()),
    }
    const { prisma, service } = makeService({}, { shiftPolicy })
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Round template',
      items: [
        {
          id: 'template-item-1',
          title: 'Door',
          description: null,
          sortOrder: 0,
          zoneName: null,
          zoneSortOrder: 0,
          checkpointSortOrder: 0,
          responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
          numericMin: null,
          numericMax: null,
          numericUnit: null,
          isRequired: true,
        },
      ],
    })

    await expect(
      service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' }),
    ).rejects.toBeInstanceOf(ActiveShiftRequiredException)

    expect(shiftPolicy.assertActiveShiftForOperationalWork).toHaveBeenCalledWith(USER)
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('does not allow numeric constraints on non-number checkpoints', async () => {
    const { service } = makeService()

    await expect(
      service.createTemplate(USER, {
        name: 'Invalid round',
        items: [
          {
            title: 'Door',
            responseType: InspectionCheckpointResponseType.YES_NO,
            numericMin: 1,
          },
        ],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('updates an existing template definition and checklist for future runs', async () => {
    const { prisma, service } = makeService()
    const updatedAt = new Date('2026-01-10T12:00:00.000Z')
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      updatedAt,
      items: [{ id: 'template-item-1' }],
    })

    await service.updateTemplate(USER, 'template-1', {
      name: '  Evening round  ',
      description: '  Updated checklist  ',
      updatedAt: updatedAt.toISOString(),
      items: [
        {
          id: 'template-item-1',
          title: 'Temperature',
          zoneName: 'Kitchen',
          zoneSortOrder: 2,
          checkpointSortOrder: 1,
          responseType: InspectionCheckpointResponseType.NUMBER,
          numericMin: 2,
          numericMax: 6,
          numericUnit: 'C',
        },
        {
          title: 'Doors',
          zoneName: 'Hall',
          zoneSortOrder: 1,
          checkpointSortOrder: 0,
          responseType: InspectionCheckpointResponseType.YES_NO,
          isRequired: false,
        },
      ],
    } as any)

    expect(prisma.inspectionTemplate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'template-1', companyId: USER.companyId, isActive: true },
    }))
    expect(prisma.inspectionTemplate.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'template-1' },
      data: expect.objectContaining({
        name: 'Evening round',
        description: 'Updated checklist',
      }),
    }))
    expect(prisma.inspectionTemplateItem.deleteMany).toHaveBeenCalledWith({
      where: {
        templateId: 'template-1',
        id: { notIn: ['template-item-1'] },
      },
    })
    expect(prisma.inspectionTemplateItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'template-item-1' },
      data: expect.objectContaining({
        title: 'Temperature',
        zoneName: 'Kitchen',
        zoneSortOrder: 2,
        checkpointSortOrder: 1,
        responseType: InspectionCheckpointResponseType.NUMBER,
        numericMin: 2,
        numericMax: 6,
        numericUnit: 'C',
      }),
    }))
    expect(prisma.inspectionTemplateItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        templateId: 'template-1',
        title: 'Doors',
        zoneName: 'Hall',
        zoneSortOrder: 1,
        checkpointSortOrder: 0,
        responseType: InspectionCheckpointResponseType.YES_NO,
        isRequired: false,
      }),
    }))
  })

  it('denies template edits for roles outside the management policy', async () => {
    const { prisma, service } = makeService()

    await expect(
      service.updateTemplate(
        { ...USER, role: UserRole.TECHNICIAN },
        'template-1',
        { name: 'No access' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.inspectionTemplate.update).not.toHaveBeenCalled()
  })

  it('rejects stale template edits instead of overwriting a newer version', async () => {
    const { prisma, service } = makeService()
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      updatedAt: new Date('2026-01-10T12:00:01.000Z'),
      items: [{ id: 'template-item-1' }],
    })

    await expect(
      service.updateTemplate(USER, 'template-1', {
        name: 'Stale edit',
        updatedAt: '2026-01-10T12:00:00.000Z',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException)

    expect(prisma.inspectionTemplate.update).not.toHaveBeenCalled()
  })

  it('keeps completed V1 run snapshots after editing the template and starts new runs from V2', async () => {
    const { prisma, service } = makeService()
    const templateUpdatedAt = new Date('2026-01-10T12:00:00.000Z')
    prisma.inspectionTemplate.findFirst
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Round template V1',
        items: [
          {
            id: 'template-item-1',
            title: 'Old temperature',
            description: 'Old instruction',
            sortOrder: 0,
            zoneName: 'Old zone',
            zoneSortOrder: 0,
            checkpointSortOrder: 0,
            responseType: InspectionCheckpointResponseType.NUMBER,
            numericMin: 10,
            numericMax: 20,
            numericUnit: 'C',
            isRequired: true,
          },
        ],
      })
      .mockResolvedValueOnce({ id: 'template-1', updatedAt: templateUpdatedAt, items: [{ id: 'template-item-1' }] })
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Round template V2',
        items: [
          {
            id: 'template-item-1',
            title: 'New temperature',
            description: 'New instruction',
            sortOrder: 0,
            zoneName: 'New zone',
            zoneSortOrder: 1,
            checkpointSortOrder: 1,
            responseType: InspectionCheckpointResponseType.NUMBER,
            numericMin: 1,
            numericMax: 5,
            numericUnit: 'C',
            isRequired: true,
          },
        ],
      })

    await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })
    const historicalRunCreate = prisma.inspectionRun.create.mock.calls[0][0].data
    const historicalRunItemSnapshot = historicalRunCreate.items.create[0]

    prisma.inspectionRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      locationId: 'location-1',
      equipmentId: null,
      status: InspectionRunStatus.IN_PROGRESS,
      location: { id: 'location-1', clientCompanyId: USER.companyId },
    })
    prisma.inspectionRunItem.findFirst.mockResolvedValueOnce({
      id: 'run-item-1',
      templateItemId: 'template-item-1',
      title: 'Old temperature',
      description: 'Old instruction',
      responseType: InspectionCheckpointResponseType.NUMBER,
      numericMin: 10,
      numericMax: 20,
      status: InspectionRunItemStatus.PENDING,
      requiresRepair: false,
      comment: null,
      ticketId: null,
    })

    await service.updateRunItem(USER, 'run-1', 'run-item-1', {
      status: InspectionRunItemStatus.OK,
      numberValue: 15,
      comment: 'Completed on V1',
    })

    expect(prisma.inspectionRunItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'run-item-1' },
      data: expect.objectContaining({
        status: InspectionRunItemStatus.OK,
        numberValue: 15,
        comment: 'Completed on V1',
      }),
    }))
    prisma.inspectionRunItem.update.mockClear()

    prisma.inspectionRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      status: InspectionRunStatus.IN_PROGRESS,
      location: { id: 'location-1', clientCompanyId: USER.companyId },
    })
    prisma.inspectionRun.update.mockResolvedValueOnce({
      id: 'run-1',
      items: [{ status: InspectionRunItemStatus.OK, requiresRepair: false, ticketId: null }],
    })

    await service.completeRun(USER, 'run-1')

    await service.updateTemplate(USER, 'template-1', {
      name: 'Round template V2',
      updatedAt: templateUpdatedAt.toISOString(),
      items: [
        {
          id: 'template-item-1',
          title: 'New temperature',
          description: 'New instruction',
          zoneName: 'New zone',
          zoneSortOrder: 1,
          checkpointSortOrder: 1,
          responseType: InspectionCheckpointResponseType.NUMBER,
          numericMin: 1,
          numericMax: 5,
          numericUnit: 'C',
        },
      ],
    } as any)

    await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })
    const newRunCreate = prisma.inspectionRun.create.mock.calls[1][0].data
    const newRunItemSnapshot = newRunCreate.items.create[0]

    expect(historicalRunCreate.title).toBe('Round template V1')
    expect(historicalRunItemSnapshot).toEqual(expect.objectContaining({
      templateItemId: 'template-item-1',
      title: 'Old temperature',
      description: 'Old instruction',
      zoneName: 'Old zone',
      responseType: InspectionCheckpointResponseType.NUMBER,
      numericMin: 10,
      numericMax: 20,
    }))
    expect(prisma.inspectionRunItem.update).not.toHaveBeenCalled()
    expect(newRunCreate.title).toBe('Round template V2')
    expect(newRunItemSnapshot).toEqual(expect.objectContaining({
      templateItemId: 'template-item-1',
      title: 'New temperature',
      description: 'New instruction',
      zoneName: 'New zone',
      zoneSortOrder: 1,
      checkpointSortOrder: 1,
      responseType: InspectionCheckpointResponseType.NUMBER,
      numericMin: 1,
      numericMax: 5,
    }))
    expect(prisma.inspectionTemplateItem.deleteMany).toHaveBeenCalledWith({
      where: {
        templateId: 'template-1',
        id: { notIn: ['template-item-1'] },
      },
    })
    expect(prisma.inspectionTemplateItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'template-item-1' },
      data: expect.objectContaining({
        title: 'New temperature',
      }),
    }))
  })

  it('blocks round completion through canonical ShiftPolicy before writing completion', async () => {
    const shiftPolicy = {
      assertActiveShiftForOperationalWork: jest.fn().mockRejectedValue(new ActiveShiftRequiredException()),
    }
    const { prisma, service } = makeService({}, { shiftPolicy })
    prisma.inspectionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: InspectionRunStatus.IN_PROGRESS,
      location: { id: 'location-1', clientCompanyId: USER.companyId },
    })

    await expect(service.completeRun(USER, 'run-1')).rejects.toBeInstanceOf(ActiveShiftRequiredException)

    expect(shiftPolicy.assertActiveShiftForOperationalWork).toHaveBeenCalledWith(USER)
    expect(prisma.inspectionRun.update).not.toHaveBeenCalled()
  })

  it('stores typed checkpoint answers only for matching response types', async () => {
    const { prisma, service } = makeService()
    prisma.inspectionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      locationId: 'location-1',
      equipmentId: null,
      status: InspectionRunStatus.IN_PROGRESS,
    })
    prisma.inspectionRunItem.findFirst.mockResolvedValue({
      id: 'item-1',
      templateItemId: 'template-item-1',
      title: 'Temperature',
      description: null,
      responseType: InspectionCheckpointResponseType.NUMBER,
      numericMin: 18,
      numericMax: 24,
      status: InspectionRunItemStatus.PENDING,
      requiresRepair: false,
      comment: null,
      ticketId: null,
    })

    await service.updateRunItem(USER, 'run-1', 'item-1', { numberValue: 22 })

    expect(prisma.inspectionRunItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ numberValue: 22 }),
    }))

    await expect(
      service.updateRunItem(USER, 'run-1', 'item-1', { booleanValue: true }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('keeps existing issue-to-ticket behavior for inspection items', async () => {
    const { prisma, service, tickets } = makeService()
    prisma.inspectionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      locationId: 'location-1',
      equipmentId: 'equipment-1',
      status: InspectionRunStatus.IN_PROGRESS,
    })
    prisma.inspectionRunItem.findFirst.mockResolvedValue({
      id: 'item-1',
      templateItemId: 'template-item-1',
      title: 'Broken mixer',
      description: 'Inspect mixer',
      responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
      numericMin: null,
      numericMax: null,
      status: InspectionRunItemStatus.ISSUE,
      requiresRepair: true,
      comment: 'Leaks',
      ticketId: null,
    })

    await service.createTicketFromItem(USER, 'run-1', 'item-1', {
      categoryId: 'category-1',
      urgency: TicketUrgency.NOT_URGENT,
    })

    expect(tickets.create).toHaveBeenCalledWith(
      USER.companyId,
      { id: USER.id, role: USER.role },
      expect.objectContaining({
        locationId: 'location-1',
        equipmentId: 'equipment-1',
        categoryId: 'category-1',
        title: 'Broken mixer',
        description: 'Leaks',
        urgency: TicketUrgency.NOT_URGENT,
      }),
    )
  })
})
