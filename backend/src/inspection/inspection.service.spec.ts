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

function makeService(overrides: Record<string, any> = {}, deps: { shiftPolicy?: any; serviceContracts?: any } = {}) {
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
    problemCategory: {
      findMany: jest.fn().mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]),
      findFirst: jest.fn(async ({ where }: any) => ({
        id: where.id,
        name: `Category ${where.id}`,
        specializationLinks: [],
      })),
    },
    technicianSpecialization: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    inspectionRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      // 029: закрытие обхода идёт условным updateMany внутри транзакции.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'run-1', items: [] }),
    },
    inspectionSchedule: {
      findFirst: jest.fn(),
      update: jest.fn(),
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
    serviceContract: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'contract-1',
        status: 'ACTIVE',
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        endsAt: null,
        locationMode: 'ALL_LOCATIONS',
        locations: [],
      }),
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
  const serviceContracts = deps.serviceContracts ?? new ServiceContractsService({
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
          defaultCategoryId: 'cat-1',
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
        defaultCategoryId: 'cat-1',
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

  it('snapshots zone and checkpoint identity when an unscheduled run starts', async () => {
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
          defaultCategoryId: 'cat-1',
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
      defaultCategoryId: 'cat-1',
      defaultCategoryName: 'Category cat-1',
      responseType: InspectionCheckpointResponseType.YES_NO,
      status: InspectionRunItemStatus.PENDING,
      requiresRepair: false,
    }))
  })

  it('resolves a checkpoint hint against the Location CLIENT and snapshots id plus name', async () => {
    const { prisma, service } = makeService()
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Round template',
      items: [{
        id: 'template-item-1',
        title: 'Door',
        description: null,
        sortOrder: 0,
        zoneName: 'Hall',
        zoneSortOrder: 0,
        checkpointSortOrder: 0,
        defaultCategoryId: 'cat-client-v1',
        responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
        numericMin: null,
        numericMax: null,
        numericUnit: null,
        isRequired: true,
      }],
    })
    prisma.problemCategory.findFirst.mockResolvedValue({
      id: 'cat-client-v1',
      name: 'Холодильное оборудование',
      specializationLinks: [],
    })

    await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })

    expect(prisma.problemCategory.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 'cat-client-v1',
        companyId: USER.companyId,
        isActive: true,
      }),
    }))
    expect(prisma.inspectionRun.create.mock.calls[0][0].data.items.create[0]).toEqual(
      expect.objectContaining({
        defaultCategoryId: 'cat-client-v1',
        defaultCategoryName: 'Холодильное оборудование',
      }),
    )
  })

  it.each(['foreign', 'inactive', 'deleted'])(
    'starts the Run with a null snapshot when the checkpoint hint is %s',
    async () => {
      const { prisma, service } = makeService()
      prisma.inspectionTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        name: 'Round template',
        items: [{
          id: 'template-item-1',
          title: 'Door',
          description: null,
          sortOrder: 0,
          zoneName: null,
          zoneSortOrder: 0,
          checkpointSortOrder: 0,
          defaultCategoryId: 'stale-category',
          responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
          numericMin: null,
          numericMax: null,
          numericUnit: null,
          isRequired: true,
        }],
      })
      prisma.problemCategory.findFirst.mockResolvedValue(null)

      await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })

      expect(prisma.inspectionRun.create.mock.calls[0][0].data.items.create[0]).toEqual(
        expect.objectContaining({ defaultCategoryId: null, defaultCategoryName: null }),
      )
    },
  )

  it('starts the Run with a null snapshot when the category is outside actor specialization scope', async () => {
    const { prisma, service } = makeService()
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Round template',
      items: [{
        id: 'template-item-1',
        title: 'Electrical checkpoint',
        description: null,
        sortOrder: 0,
        zoneName: null,
        zoneSortOrder: 0,
        checkpointSortOrder: 0,
        defaultCategoryId: 'cat-electric',
        responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
        numericMin: null,
        numericMax: null,
        numericUnit: null,
        isRequired: true,
      }],
    })
    prisma.problemCategory.findFirst.mockResolvedValue({
      id: 'cat-electric',
      name: 'Электрика',
      specializationLinks: [{
        specializationId: 'spec-electric',
        specialization: { name: 'Электрика' },
      }],
    })
    prisma.technicianSpecialization.findMany.mockResolvedValue([{
      specializationId: 'spec-hvac',
      specialization: { name: 'Холодильное оборудование' },
    }])

    await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })

    expect(prisma.inspectionRun.create.mock.calls[0][0].data.items.create[0]).toEqual(
      expect.objectContaining({ defaultCategoryId: null, defaultCategoryName: null }),
    )
  })

  it('resolves the same provider template hint for CLIENT A and drops it for CLIENT B', async () => {
    const provider = { id: 'provider-admin', companyId: 'provider-1', role: UserRole.ADMIN }
    const serviceContracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: 'PRIMARY',
        effectiveLocationScope: { mode: 'tenant_wide', locationIds: [] },
      }),
    }
    const { prisma, service } = makeService({}, { serviceContracts })
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Provider template',
      items: [{
        id: 'template-item-1',
        title: 'Checkpoint',
        description: null,
        sortOrder: 0,
        zoneName: null,
        zoneSortOrder: 0,
        checkpointSortOrder: 0,
        defaultCategoryId: 'cat-client-a',
        responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
        numericMin: null,
        numericMax: null,
        numericUnit: null,
        isRequired: true,
      }],
    })
    prisma.location.findFirst
      .mockResolvedValueOnce({ id: 'location-a', name: 'A', clientCompanyId: 'client-a' })
      .mockResolvedValueOnce({ id: 'location-b', name: 'B', clientCompanyId: 'client-b' })
    prisma.problemCategory.findFirst.mockImplementation(async ({ where }: any) =>
      where.companyId === 'client-a'
        ? { id: 'cat-client-a', name: 'Category A', specializationLinks: [] }
        : null,
    )

    await service.startRun(provider, { templateId: 'template-1', locationId: 'location-a' })
    await service.startRun(provider, { templateId: 'template-1', locationId: 'location-b' })

    expect(prisma.inspectionRun.create.mock.calls[0][0].data.items.create[0]).toEqual(
      expect.objectContaining({ defaultCategoryId: 'cat-client-a', defaultCategoryName: 'Category A' }),
    )
    expect(prisma.inspectionRun.create.mock.calls[1][0].data.items.create[0]).toEqual(
      expect.objectContaining({ defaultCategoryId: null, defaultCategoryName: null }),
    )
    expect(prisma.problemCategory.findFirst.mock.calls.map((call: any[]) => call[0].where.companyId))
      .toEqual(['client-a', 'client-b'])
  })

  it('does not add a PRIMARY-only gate for SECONDARY providers', async () => {
    const provider = { id: 'provider-admin', companyId: 'provider-1', role: UserRole.ADMIN }
    const serviceContracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: 'SECONDARY',
        effectiveLocationScope: { mode: 'tenant_wide', locationIds: [] },
      }),
    }
    const { prisma, service } = makeService({}, { serviceContracts })
    prisma.location.findFirst.mockResolvedValue({
      id: 'location-1',
      name: 'Client location',
      clientCompanyId: 'client-1',
    })
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Provider template',
      items: [{
        id: 'template-item-1',
        title: 'Checkpoint',
        description: null,
        sortOrder: 0,
        zoneName: null,
        zoneSortOrder: 0,
        checkpointSortOrder: 0,
        defaultCategoryId: null,
        responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
        numericMin: null,
        numericMax: null,
        numericUnit: null,
        isRequired: true,
      }],
    })

    await service.startRun(provider, { templateId: 'template-1', locationId: 'location-1' })

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
    expect(serviceContracts.getLinkedClientAccess).toHaveBeenCalledWith('provider-1', 'client-1')
  })

  it('stores raw category hints on provider and client templates without treating template ownership as authority', async () => {
    const { prisma, service } = makeService()

    await service.createTemplate(USER, {
      name: 'Hints',
      items: [
        { title: 'Client hint', defaultCategoryId: 'cat-client' },
        { title: 'Provider hint', defaultCategoryId: 'cat-provider' },
      ],
    } as any)

    expect(prisma.inspectionTemplate.create.mock.calls[0][0].data.items.create).toEqual([
      expect.objectContaining({ defaultCategoryId: 'cat-client' }),
      expect.objectContaining({ defaultCategoryId: 'cat-provider' }),
    ])
    expect(prisma.problemCategory.findFirst).not.toHaveBeenCalled()
    expect(prisma.problemCategory.findMany).not.toHaveBeenCalled()
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
          defaultCategoryId: 'cat-2',
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
        defaultCategoryId: 'cat-2',
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
            defaultCategoryId: 'cat-1',
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
            defaultCategoryId: 'cat-2',
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
          defaultCategoryId: 'cat-2',
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
      defaultCategoryId: 'cat-1',
      defaultCategoryName: 'Category cat-1',
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
      defaultCategoryId: 'cat-2',
      defaultCategoryName: 'Category cat-2',
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

  it('keeps an existing Run snapshot after the Template hint is cleared', async () => {
    const { prisma, service } = makeService()
    const updatedAt = new Date('2026-01-10T12:00:00.000Z')
    prisma.inspectionTemplate.findFirst
      .mockResolvedValueOnce({
        id: 'template-1',
        name: 'Round template',
        items: [{
          id: 'template-item-1',
          title: 'Checkpoint',
          description: null,
          sortOrder: 0,
          zoneName: null,
          zoneSortOrder: 0,
          checkpointSortOrder: 0,
          defaultCategoryId: 'cat-before-clear',
          responseType: InspectionCheckpointResponseType.NORMAL_PROBLEM,
          numericMin: null,
          numericMax: null,
          numericUnit: null,
          isRequired: true,
        }],
      })
      .mockResolvedValueOnce({
        id: 'template-1',
        updatedAt,
        items: [{ id: 'template-item-1' }],
      })
    prisma.problemCategory.findFirst.mockResolvedValue({
      id: 'cat-before-clear',
      name: 'Category before clear',
      specializationLinks: [],
    })

    await service.startRun(USER, { templateId: 'template-1', locationId: 'location-1' })
    const snapshot = prisma.inspectionRun.create.mock.calls[0][0].data.items.create[0]

    await service.updateTemplate(USER, 'template-1', {
      name: 'Round template',
      updatedAt: updatedAt.toISOString(),
      items: [{ id: 'template-item-1', title: 'Checkpoint', defaultCategoryId: null }],
    } as any)

    expect(snapshot).toEqual(expect.objectContaining({
      defaultCategoryId: 'cat-before-clear',
      defaultCategoryName: 'Category before clear',
    }))
    expect(prisma.inspectionTemplateItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ defaultCategoryId: null }),
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
