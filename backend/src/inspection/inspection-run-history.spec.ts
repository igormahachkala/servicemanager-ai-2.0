import {
  InspectionCheckpointResponseType,
  InspectionReportStatus,
  InspectionRunItemStatus,
  InspectionRunStatus,
  UserRole,
} from '@prisma/client'

import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { InspectionExportService } from './inspection.export.service'
import { InspectionService } from './inspection.service'

/**
 * SMA-ROUND-RESULT-HISTORY-116F.
 *
 * История обходов как операционная запись: фильтры по уже существующим
 * измерениям, итог по снимку пунктов и неизменность исторической записи
 * при правке шаблона (116C).
 */

const ADMIN = { id: 'user-1', companyId: 'company-1', role: UserRole.ADMIN }
const TECHNICIAN = { id: 'tech-1', companyId: 'company-1', role: UserRole.TECHNICIAN }
const CLIENT = { id: 'client-1', companyId: 'company-1', role: UserRole.CLIENT }

function makeService(runs: any[] = []) {
  const prisma = {
    inspectionTemplate: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    inspectionRun: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue(runs),
    },
    location: { findFirst: jest.fn() },
    equipment: { findFirst: jest.fn() },
    user: { findFirst: jest.fn().mockResolvedValue({ id: ADMIN.id }) },
    userAccessScope: { findUnique: jest.fn().mockResolvedValue(null) },
    userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    inspectionRunItem: { findFirst: jest.fn(), update: jest.fn() },
    inspectionRunItemAttachment: { create: jest.fn() },
  }
  const serviceContracts = new ServiceContractsService({
    serviceContract: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  } as any)

  return {
    prisma,
    service: new InspectionService(
      prisma as any,
      { create: jest.fn() } as any,
      { recordLegacy: jest.fn() } as any,
      { exportReport: jest.fn() } as any,
      serviceContracts,
    ),
  }
}

function run(overrides: Record<string, any> = {}) {
  return {
    id: 'run-1',
    title: 'Ежедневный обход кухни',
    status: InspectionRunStatus.COMPLETED,
    reportStatus: InspectionReportStatus.APPROVED,
    reportReviewedAt: new Date('2026-09-14T12:00:00Z'),
    completedAt: new Date('2026-09-14T11:00:00Z'),
    createdAt: new Date('2026-09-14T09:00:00Z'),
    updatedAt: new Date('2026-09-14T12:00:00Z'),
    template: { id: 'template-1', name: 'Ежедневный обход кухни' },
    // Площадка принадлежит клиенту; исполнителем может быть провайдер.
    location: { id: 'location-1', clientCompanyId: 'company-1', name: 'Фудзияма — Арбат', city: 'Уфа' },
    equipment: null,
    performedBy: { id: 'tech-1', email: 'tech@test.local', firstName: 'Гена', lastName: 'Бурдов' },
    reportReviewedBy: { id: 'user-1', email: 'admin@test.local', firstName: null, lastName: null },
    items: [
      { status: InspectionRunItemStatus.OK, ticketId: null },
      { status: InspectionRunItemStatus.OK, ticketId: null },
      { status: InspectionRunItemStatus.ISSUE, ticketId: 'ticket-1' },
      { status: InspectionRunItemStatus.CRITICAL, ticketId: 'ticket-2' },
      { status: InspectionRunItemStatus.SKIPPED, ticketId: null },
      { status: InspectionRunItemStatus.PENDING, ticketId: null },
    ],
    _count: { items: 6 },
    ...overrides,
  }
}

describe('116F история обходов — итог', () => {
  it('считает итог по снимку пунктов, включая смешанные статусы и созданные заявки', async () => {
    const { service } = makeService([run()])

    const [row] = await service.listRuns(ADMIN)

    expect(row.summary).toEqual({
      totalItems: 6,
      okCount: 2,
      issueCount: 1,
      criticalCount: 1,
      skippedCount: 1,
      pendingCount: 1,
      createdTicketsCount: 2,
    })
  })

  it('не отдаёт сырой массив пунктов в списке — только посчитанный итог', async () => {
    const { service } = makeService([run()])

    const [row] = await service.listRuns(ADMIN)

    expect((row as any).items).toBeUndefined()
    expect(row.performedBy).toEqual(expect.objectContaining({ id: 'tech-1' }))
  })

  it('отдаёт исполнителя и результат проверки акта', async () => {
    const { service } = makeService([run()])

    const [row] = await service.listRuns(ADMIN)

    expect(row.reportStatus).toBe(InspectionReportStatus.APPROVED)
    expect(row.reportReviewedBy).toEqual(expect.objectContaining({ id: 'user-1' }))
    expect(row.reportReviewedAt).toEqual(new Date('2026-09-14T12:00:00Z'))
  })
})

describe('116F история обходов — фильтры', () => {
  it('фильтрует по объекту, исполнителю, шаблону и статусам', async () => {
    const { prisma, service } = makeService([])

    await service.listRuns(ADMIN, {
      locationId: 'location-1',
      performedByUserId: 'tech-1',
      templateId: 'template-1',
      status: InspectionRunStatus.COMPLETED,
      reportStatus: InspectionReportStatus.APPROVED,
    })

    const where = prisma.inspectionRun.findMany.mock.calls[0][0].where
    expect(where).toEqual({
      companyId: 'company-1',
      locationId: 'location-1',
      performedByUserId: 'tech-1',
      templateId: 'template-1',
      status: InspectionRunStatus.COMPLETED,
      reportStatus: InspectionReportStatus.APPROVED,
    })
  })

  it('переводит окно дат в границы по createdAt', async () => {
    const { prisma, service } = makeService([])

    await service.listRuns(ADMIN, { from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T23:59:59.999Z' })

    const where = prisma.inspectionRun.findMany.mock.calls[0][0].where
    expect(where.createdAt).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lte: new Date('2026-09-30T23:59:59.999Z'),
    })
  })

  it('без фильтров сужает выдачу только своей компанией', async () => {
    const { prisma, service } = makeService([])

    await service.listRuns(ADMIN)

    const args = prisma.inspectionRun.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ companyId: 'company-1' })
    expect(args.take).toBe(50)
  })

  it('уважает limit и не даёт им расширить чужую компанию', async () => {
    const { prisma, service } = makeService([])

    await service.listRuns(ADMIN, { limit: 20 })

    const args = prisma.inspectionRun.findMany.mock.calls[0][0]
    expect(args.take).toBe(20)
    expect(args.where.companyId).toBe('company-1')
  })
})

describe('116F история обходов — доступ', () => {
  it('исполнитель видит историю своей компании', async () => {
    const { service } = makeService([run()])

    await expect(service.listRuns(TECHNICIAN)).resolves.toHaveLength(1)
  })

  it('роль без права на обходы получает отказ', async () => {
    const { prisma, service } = makeService([run()])

    await expect(service.listRuns(CLIENT)).rejects.toThrow()
    expect(prisma.inspectionRun.findMany).not.toHaveBeenCalled()
  })
})

describe('116F историческая запись не переписывается правкой шаблона', () => {
  /**
   * 116C вводит редактирование шаблонов. Снимок обхода живёт в InspectionRunItem
   * и в InspectionRun.title, поэтому правка шаблона задним числом не меняет то,
   * что записано про завершённый обход.
   */
  it('итог считается по пунктам обхода, а не по текущему составу шаблона', async () => {
    const historical = run({
      items: [
        { status: InspectionRunItemStatus.OK, ticketId: null },
        { status: InspectionRunItemStatus.ISSUE, ticketId: 'ticket-1' },
      ],
      _count: { items: 2 },
      // Шаблон с тех пор переименовали и расширили — на историю это не влияет.
      template: { id: 'template-1', name: 'Обход кухни (ред. 2026-09-20)' },
    })
    const { service } = makeService([historical])

    const [row] = await service.listRuns(ADMIN)

    expect(row.summary.totalItems).toBe(2)
    expect(row.summary.okCount).toBe(1)
    expect(row.summary.issueCount).toBe(1)
    // Название обхода — снимок на момент запуска, а не текущее имя шаблона.
    expect(row.title).toBe('Ежедневный обход кухни')
    expect(row.template.name).toBe('Обход кухни (ред. 2026-09-20)')
  })

  it('запуск обхода копирует определение пунктов в запись обхода', async () => {
    const { prisma, service } = makeService([])
    prisma.inspectionTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      name: 'Ежедневный обход кухни',
      items: [
        {
          id: 'template-item-1',
          title: 'Проверить холодильник',
          description: 'Температура и уплотнитель',
          sortOrder: 0,
          zoneName: 'Кухня',
          zoneSortOrder: 0,
          checkpointSortOrder: 0,
          responseType: InspectionCheckpointResponseType.NUMBER,
          numericMin: 2,
          numericMax: 6,
          numericUnit: 'C',
          isRequired: true,
        },
      ],
    })
    prisma.location.findFirst.mockResolvedValue({
      id: 'location-1',
      name: 'Фудзияма — Арбат',
      clientCompanyId: 'company-1',
    })
    prisma.inspectionRun.create.mockResolvedValue({ id: 'run-1' })

    await service.startRun(ADMIN, { templateId: 'template-1', locationId: 'location-1' } as any)

    const data = prisma.inspectionRun.create.mock.calls[0][0].data
    // Название обхода фиксируется в самой записи.
    expect(data.title).toBe('Ежедневный обход кухни')
    // Определение пункта копируется целиком, а не читается из шаблона потом.
    expect(data.items.create[0]).toEqual(
      expect.objectContaining({
        templateItemId: 'template-item-1',
        title: 'Проверить холодильник',
        description: 'Температура и уплотнитель',
        zoneName: 'Кухня',
        responseType: InspectionCheckpointResponseType.NUMBER,
        numericMin: 2,
        numericMax: 6,
        numericUnit: 'C',
        isRequired: true,
      }),
    )
  })
})

describe('116F экспорт исторического обхода', () => {
  it('печатает снимок названия обхода, а не текущее имя шаблона', () => {
    const xml = (new InspectionExportService() as any).documentXml({
      run: {
        id: 'run-1',
        title: 'Ежедневный обход кухни',
        status: InspectionRunStatus.COMPLETED,
        startedAt: '2026-09-14T09:00:00Z',
        completedAt: '2026-09-14T11:00:00Z',
        performedBy: null,
        template: { name: 'Обход кухни (ред. 2026-09-20)' },
        location: { name: 'Фудзияма — Арбат' },
        equipment: null,
      },
      document: {
        title: 'Акт выполненных работ',
        number: '1',
        executorCompany: { name: 'Исполнитель' },
        clientCompany: { name: 'Заказчик' },
      },
      reportMeta: { status: InspectionReportStatus.APPROVED },
      items: [],
      summary: {
        totalItems: 0,
        okCount: 0,
        issueCount: 0,
        criticalCount: 0,
        repairRequiredCount: 0,
        createdTicketsCount: 0,
      },
    })

    expect(xml).toContain('Шаблон: Ежедневный обход кухни')
    expect(xml).not.toContain('Обход кухни (ред. 2026-09-20)')
  })
})
