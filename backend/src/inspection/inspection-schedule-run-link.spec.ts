import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import {
  InspectionRunItemStatus,
  InspectionRunStatus,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client'

import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { InspectionService } from './inspection.service'

/**
 * SMA-PLANNER-V1-SCHEDULE-TO-RUN-LINK-119K.
 *
 * План (InspectionSchedule) и исполнение (InspectionRun) существовали в схеме
 * по отдельности: поля scheduleId и dueAt у обхода были, но заполнить их через
 * API было нельзя, и отметки lastRunId/lastGeneratedAt оставались пустыми
 * всегда. Здесь проверяется связь между ними.
 *
 * Чего тут нет намеренно: расписание не является источником доступа. Доступ
 * к шаблону, локации и оборудованию решает канонический порядок 097, и его
 * проверяет inspection.service.access.spec.ts. Проверки ниже — про то, что
 * начинаемый обход действительно тот самый запланированный визит, и про то,
 * что обход «от руки» продолжает работать без плана.
 */

const PROVIDER_ID = 'provider-1'
const OTHER_PROVIDER_ID = 'provider-2'
const CLIENT_A = 'client-a'

const LOCATION = { id: 'loc-a1', name: 'Фудзияма — Уфа', clientCompanyId: CLIENT_A }
const OTHER_LOCATION = { id: 'loc-a2', name: 'Фудзияма — Казань', clientCompanyId: CLIENT_A }

const DUE_AT = new Date('2026-09-18T09:00:00.000Z')

const technician = { id: 'u-tech', companyId: PROVIDER_ID, role: UserRole.TECHNICIAN }
const otherTechnician = { id: 'u-tech-2', companyId: PROVIDER_ID, role: UserRole.TECHNICIAN }
const dispatcher = { id: 'u-disp', companyId: PROVIDER_ID, role: UserRole.DISPATCHER }

function makeContract(overrides: any = {}) {
  return {
    id: 'sc-1',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    clientCompanyId: CLIENT_A,
    providerCompanyId: PROVIDER_ID,
    startsAt: null,
    endsAt: null,
    locations: [],
    ...overrides,
  }
}

function makeSchedule(overrides: any = {}) {
  return {
    id: 'sch-1',
    isActive: true,
    templateId: 'tpl-1',
    locationId: LOCATION.id,
    equipmentId: null,
    assignedToUserId: technician.id,
    nextDueAt: DUE_AT,
    ...overrides,
  }
}

function makeSuite(options: { contracts?: any[]; schedule?: any | null; activeRun?: any } = {}) {
  const contracts = options.contracts ?? [makeContract()]
  const schedule = options.schedule === undefined ? makeSchedule() : options.schedule

  const serviceContracts = new ServiceContractsService({
    serviceContract: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.clientCompanyId_providerCompanyId
        return (
          contracts.find(
            (c) =>
              c.clientCompanyId === key.clientCompanyId &&
              c.providerCompanyId === key.providerCompanyId,
          ) ?? null
        )
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any)

  const templateItems = [
    {
      id: 'ti-1',
      title: 'Электрощит',
      description: null,
      sortOrder: 0,
      zoneName: 'Зал',
      zoneSortOrder: 0,
      checkpointSortOrder: 0,
      responseType: 'NORMAL_PROBLEM',
      numericMin: null,
      numericMax: null,
      numericUnit: null,
      isRequired: true,
    },
  ]

  const runRow = {
    id: 'run-1',
    companyId: PROVIDER_ID,
    status: InspectionRunStatus.IN_PROGRESS,
    location: { ...LOCATION },
    items: [{ id: 'item-1', status: InspectionRunItemStatus.PENDING }],
  }

  const prisma: any = {
    inspectionTemplate: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.companyId === PROVIDER_ID ? { id: where.id, name: 'ТО', items: templateItems } : null,
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    location: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id === LOCATION.id) return { ...LOCATION }
        if (where.id === OTHER_LOCATION.id) return { ...OTHER_LOCATION }
        return null
      }),
    },
    equipment: {
      findFirst: jest.fn(async ({ where }: any) => ({ id: where.id })),
    },
    inspectionSchedule: {
      findFirst: jest.fn(async ({ where }: any) =>
        schedule && where.id === schedule.id && where.companyId === PROVIDER_ID ? { ...schedule } : null,
      ),
      update: jest.fn(async ({ data }: any) => ({ id: schedule?.id, ...data })),
    },
    inspectionRun: {
      create: jest.fn(async ({ data }: any) => ({ ...runRow, ...data })),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.scheduleId) return options.activeRun ?? null
        return { ...runRow, ...(options.activeRun ?? {}) }
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(async ({ data }: any) => ({ ...runRow, ...data })),
    },
    inspectionRunItem: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'item-1',
        runId: 'run-1',
        status: InspectionRunItemStatus.PENDING,
        responseType: 'NORMAL_PROBLEM',
        numericMin: null,
        numericMax: null,
        ticketId: null,
        run: { id: 'run-1', companyId: PROVIDER_ID, status: InspectionRunStatus.IN_PROGRESS, location: { ...LOCATION } },
      }),
      update: jest.fn(async ({ data }: any) => ({ id: 'item-1', ...data })),
    },
    /** Транзакция исполняется на тех же заглушках: связь и отметка должны идти вместе. */
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  }

  const tickets = { create: jest.fn() } as any
  const timeline = { recordLegacy: jest.fn().mockResolvedValue(undefined) } as any
  const exporter = { exportReport: jest.fn() } as any

  const svc = new InspectionService(prisma, tickets, timeline, exporter, serviceContracts)

  return { svc, prisma, timeline }
}

const base = { templateId: 'tpl-1', locationId: LOCATION.id }

// ── связь плана и исполнения ────────────────────────────────────────────────

describe('119K startRun по расписанию', () => {
  it('1-2. связывает обход с расписанием и переносит срок визита', async () => {
    const { svc, prisma } = makeSuite()

    const run: any = await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
    const data = prisma.inspectionRun.create.mock.calls[0][0].data
    expect(data.scheduleId).toBe('sch-1')
    expect(data.dueAt).toEqual(DUE_AT)
    expect(run.scheduleId).toBe('sch-1')
    expect(data.performedByUserId).toBe(technician.id)
    // Исполнение остаётся за провайдером, объект — за клиентом.
    expect(data.companyId).toBe(PROVIDER_ID)
    expect(data.locationId).toBe(LOCATION.id)
  })

  it('3-4. закрывает план: отмечает последний обход и время', async () => {
    const { svc, prisma } = makeSuite()

    const before = Date.now()
    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.inspectionSchedule.update).toHaveBeenCalledTimes(1)
    const call = prisma.inspectionSchedule.update.mock.calls[0][0]
    expect(call.where).toEqual({ id: 'sch-1' })
    expect(call.data.lastRunId).toBe('run-1')
    expect(call.data.lastGeneratedAt.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('пишет обход и отметку плана одной транзакцией', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('событие описывает появление обхода из плана и называет инициатора', async () => {
    const { svc, timeline } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(timeline.recordLegacy).toHaveBeenCalledTimes(1)
    const event = timeline.recordLegacy.mock.calls[0][0]
    expect(event.type).toBe('inspection.run_generated')
    expect(event.entityType).toBe('InspectionRun')
    expect(event.entityId).toBe('run-1')
    // Актор отличает запуск человеком от будущего автогенератора.
    expect(event.actorUserId).toBe(technician.id)
    expect(event.payload).toMatchObject({ scheduleId: 'sch-1', trigger: 'technician_start' })
  })

  // ── назначение и чужой план ───────────────────────────────────────────────

  it('5. техник не может выполнить план, назначенный другому', async () => {
    const { svc, prisma } = makeSuite()

    await expect(
      svc.startRun(otherTechnician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new NotFoundException('Inspection schedule not found'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('планировщик может начать обход по плану, назначенному технику', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(dispatcher, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
  })

  it('8. план без назначения закрыт для техника', async () => {
    const { svc, prisma } = makeSuite({ schedule: makeSchedule({ assignedToUserId: null }) })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new NotFoundException('Inspection schedule not found'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('8. план другого провайдера не существует для актора', async () => {
    const { svc, prisma } = makeSuite({ schedule: null })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-foreign' } as any),
    ).rejects.toThrow(new NotFoundException('Inspection schedule not found'))
    expect(prisma.inspectionSchedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sch-foreign', companyId: PROVIDER_ID } }),
    )
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  // ── состояние и сходимость плана ──────────────────────────────────────────

  it('9. отключённый план не исполняется', async () => {
    const { svc, prisma } = makeSuite({ schedule: makeSchedule({ isActive: false }) })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new BadRequestException('Inspection schedule is not active'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('10. локация запроса должна совпадать с локацией плана', async () => {
    const { svc, prisma } = makeSuite({ schedule: makeSchedule({ locationId: OTHER_LOCATION.id }) })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new BadRequestException('Inspection schedule has a different location'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('11. шаблон запроса должен совпадать с шаблоном плана', async () => {
    const { svc, prisma } = makeSuite({ schedule: makeSchedule({ templateId: 'tpl-other' }) })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new BadRequestException('Inspection schedule has a different template'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('12. оборудование плана обязательно, если оно в плане указано', async () => {
    const { svc, prisma } = makeSuite({ schedule: makeSchedule({ equipmentId: 'eq-planned' }) })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new BadRequestException('Inspection schedule has different equipment'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('12. оборудование не из плана тоже не принимается', async () => {
    const { svc, prisma } = makeSuite()

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1', equipmentId: 'eq-1' } as any),
    ).rejects.toThrow(new BadRequestException('Inspection schedule has different equipment'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('12. совпадающее оборудование принимается', async () => {
    const { svc, prisma } = makeSuite({ schedule: makeSchedule({ equipmentId: 'eq-1' }) })

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1', equipmentId: 'eq-1' } as any)

    expect(prisma.inspectionRun.create.mock.calls[0][0].data.equipmentId).toBe('eq-1')
  })

  // ── контурный доступ остаётся каноническим ────────────────────────────────

  it('6. PRIMARY-провайдер исполняет план на контрактной локации', async () => {
    const { svc, prisma } = makeSuite({ contracts: [makeContract({ role: ServiceContractRole.PRIMARY })] })

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
  })

  it('7. SECONDARY-провайдер исполняет план в делегированном контуре', async () => {
    const { svc, prisma } = makeSuite({
      contracts: [makeContract({ role: ServiceContractRole.SECONDARY })],
    })

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
  })

  it('7. SECONDARY вне своей выборки локаций закрыт, план не спасает', async () => {
    const { svc, prisma } = makeSuite({
      contracts: [
        makeContract({
          role: ServiceContractRole.SECONDARY,
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          locations: [{ locationId: OTHER_LOCATION.id }],
        }),
      ],
    })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
    // Доступ решается до расписания: плана даже не спрашивали.
    expect(prisma.inspectionSchedule.findFirst).not.toHaveBeenCalled()
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })

  it('13. отказ по контракту не создаёт ни обхода, ни отметки в плане', async () => {
    const { svc, prisma } = makeSuite({ contracts: [] })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toThrow(new NotFoundException('Location not found'))
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ── повтор того же визита ─────────────────────────────────────────────────

  it('повтор визита с незакрытым обходом отклоняется, а не удваивается', async () => {
    const { svc, prisma } = makeSuite({ activeRun: { id: 'run-open' } })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('отказ повтора называет уже начатый обход', async () => {
    const { svc } = makeSuite({ activeRun: { id: 'run-open' } })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toMatchObject({
      response: { code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS', runId: 'run-open' },
    })
  })

  it('признаком занятости считается только незакрытый обход', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    // Завершённые обходы того же плана следующий визит не блокируют.
    expect(prisma.inspectionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scheduleId: 'sch-1', status: InspectionRunStatus.IN_PROGRESS },
      }),
    )
  })
})

// ── обход «от руки» не изменился ────────────────────────────────────────────

describe('119K обход без расписания', () => {
  it('14. начинается ровно как раньше: без плана, без транзакции, без отметок', async () => {
    const { svc, prisma, timeline } = makeSuite()

    const run: any = await svc.startRun(technician, { ...base } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
    const data = prisma.inspectionRun.create.mock.calls[0][0].data
    expect(data.scheduleId).toBeNull()
    expect(data.dueAt).toBeNull()
    expect(run.id).toBe('run-1')
    // Ни расписание, ни транзакция, ни событие плана не задействованы.
    expect(prisma.inspectionSchedule.findFirst).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(timeline.recordLegacy).not.toHaveBeenCalled()
  })

  it('14. чек-лист собирается из шаблона так же, как без плана', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base } as any)
    const withoutSchedule = prisma.inspectionRun.create.mock.calls[0][0].data.items.create

    prisma.inspectionRun.create.mockClear()
    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    const withSchedule = prisma.inspectionRun.create.mock.calls[0][0].data.items.create

    expect(withSchedule).toEqual(withoutSchedule)
  })
})

// ── смежное поведение не затронуто ──────────────────────────────────────────

describe('119K смежное поведение обходов', () => {
  it('15. связь с планом не вводит зависимости от рабочей смены', async () => {
    const { svc, prisma } = makeSuite()

    // Сервис сконструирован без всякой смены и обход по плану начинается.
    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
    expect((prisma as any).workShift).toBeUndefined()
  })

  it('16. отметка чек-поинта после планового старта работает как прежде', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    await svc.updateRunItem(technician, 'run-1', 'item-1', {
      status: InspectionRunItemStatus.OK,
    } as any)

    expect(prisma.inspectionRunItem.update).toHaveBeenCalledTimes(1)
    // Расписание в отметке чек-поинта не участвует.
    expect(prisma.inspectionSchedule.findFirst).toHaveBeenCalledTimes(1)
  })

  it('17. завершение обхода плана не переписывает', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    prisma.inspectionSchedule.update.mockClear()

    await svc.completeRun(technician, 'run-1')

    expect(prisma.inspectionRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: InspectionRunStatus.COMPLETED }) }),
    )
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('18. исторический срез: чтение обхода не смотрит ни в шаблон, ни в план', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    prisma.inspectionTemplate.findFirst.mockClear()
    prisma.inspectionSchedule.findFirst.mockClear()

    await svc.getRun(technician, 'run-1')

    // Состав обхода зафиксирован при старте: правка шаблона или плана
    // задним числом переписать его не может, потому что их не читают.
    expect(prisma.inspectionTemplate.findFirst).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.findFirst).not.toHaveBeenCalled()
  })

  it('18. состав чек-листа копируется в обход, а не берётся ссылкой', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    const items = prisma.inspectionRun.create.mock.calls[0][0].data.items.create
    expect(items).toHaveLength(1)
    // Значения скопированы; связь с пунктом шаблона остаётся только ссылкой-меткой.
    expect(items[0]).toMatchObject({
      templateItemId: 'ti-1',
      title: 'Электрощит',
      zoneName: 'Зал',
      isRequired: true,
      status: InspectionRunItemStatus.PENDING,
    })
  })
})
