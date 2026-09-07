import { BadRequestException } from '@nestjs/common'
import {
  InspectionCheckpointResponseType,
  InspectionRunItemStatus,
  InspectionRunStatus,
  TicketUrgency,
  UserRole,
} from '@prisma/client'

import { InspectionService } from './inspection.service'

const USER = {
  id: 'user-1',
  companyId: 'company-1',
  role: UserRole.ADMIN,
}

function makeService(overrides: Record<string, any> = {}) {
  const prisma = {
    inspectionTemplate: {
      create: jest.fn().mockResolvedValue({ id: 'template-1' }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    inspectionRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue({ id: 'location-1', name: 'Location 1' }),
    },
    equipment: {
      findFirst: jest.fn(),
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
  const tickets = {
    create: jest.fn().mockResolvedValue({
      ticket: { id: 'ticket-1', ticketNumber: 101 },
      generated: null,
      autoAssigned: false,
    }),
  }
  const timeline = { recordLegacy: jest.fn().mockResolvedValue(undefined) }
  const exporter = { exportReport: jest.fn() }

  return {
    prisma,
    tickets,
    timeline,
    service: new InspectionService(prisma as any, tickets as any, timeline as any, exporter as any),
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
