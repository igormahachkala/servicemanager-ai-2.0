import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import {
  InspectionRunItemStatus,
  InspectionRunStatus,
  Prisma,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client'

import { IdempotencyService } from '../common/idempotency/idempotency.service'
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

/**
 * 119T: настоящий IdempotencyService поверх памяти. Заглушка повторяла бы
 * собственную логику сервиса, а проверяем мы именно её — гонку за уникальным
 * ключом и возврат прежнего результата вместо второй доменной записи.
 */
function makeIdempotencyStore() {
  const rows = new Map<string, any>()
  const keyOf = (w: any) => {
    const k = w.companyId_userId_operationType_key ?? w
    return `${k.companyId}|${k.userId}|${k.operationType}|${k.key}`
  }
  const idempotencyRecord = {
    create: jest.fn(async ({ data }: any) => {
      const id = keyOf(data)
      if (rows.has(id)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        })
      }
      const row = { id, ...data, updatedAt: new Date(), storageKey: null }
      rows.set(id, row)
      return row
    }),
    findUnique: jest.fn(async ({ where }: any) => rows.get(keyOf(where)) ?? null),
    update: jest.fn(async ({ where, data }: any) => {
      const id = keyOf(where)
      const row = { ...rows.get(id), ...data, updatedAt: new Date() }
      rows.set(id, row)
      return row
    }),
    delete: jest.fn(async ({ where }: any) => {
      const id = keyOf(where)
      const row = rows.get(id)
      rows.delete(id)
      return row
    }),
    deleteMany: jest.fn(async () => ({ count: 0 })),
  }
  return { idempotencyRecord, rows }
}

function makeSuite(
  options: {
    contracts?: any[]
    schedule?: any | null
    activeRun?: any
    /** 119T: без него сервис ведёт себя как до задачи — так же, как в юнит-тестах 119K. */
    withIdempotency?: boolean
    /** Общее хранилище ключей: два «одновременных» вызова должны делить его. */
    store?: ReturnType<typeof makeIdempotencyStore>
  } = {},
) {
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

  /** Каждое создание — новый обход: иначе повтор и следующий визит неразличимы. */
  let runSeq = 0
  const createdRuns = new Map<string, any>()

  const prisma: any = {
    /**
     * 119T: канонический доступ к локации (ticket-access) читает привязки
     * пользователя. В 119K этот путь из startRun не вызывался; в текущем
     * кандидате Rounds — вызывается. Заглушка стоит здесь, чтобы связь плана
     * и обхода проверялась одинаково по обе стороны этой сверки.
     */
    userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
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
      create: jest.fn(async ({ data }: any) => {
        runSeq += 1
        const created = { ...runRow, ...data, id: `run-${runSeq}` }
        createdRuns.set(created.id, created)
        return created
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const found = createdRuns.get(where.id)
        if (!found) return null
        /*
         * 029: сдвиг плана читает обход вместе со связанным планом. Заглушка
         * отдаёт связь так же, как настоящий select, иначе сдвиг молча
         * пропускался бы и проверка ничего бы не значила.
         */
        const linked = (found as any).scheduleId === schedule?.id ? schedule : null
        return {
          ...found,
          schedule: linked
            ? {
                id: linked.id,
                isActive: linked.isActive,
                frequency: (linked as any).frequency ?? 'DAILY',
                intervalDays: (linked as any).intervalDays ?? null,
                nextDueAt: linked.nextDueAt,
                company: { timezone: 'Europe/Moscow' },
              }
            : null,
        }
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.scheduleId) return options.activeRun ?? null
        return { ...runRow, ...(options.activeRun ?? {}) }
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(async ({ data }: any) => ({ ...runRow, ...data })),
      /**
       * 029: завершение закрывает обход условным updateMany — признак
       * «уже завершён» ставит сам переход статуса. Заглушка отвечает как
       * выигранная гонка: один изменённый ряд.
       */
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
          const found = createdRuns.get(where.id) ?? runRow
          // Настоящий запрос идёт с select: runSelect(), где items всегда есть;
          // сводка обхода по ним и строится.
          // В созданной записи items лежит входной формой Prisma
          // ({ create: [...] }), а сводке нужен массив — как в настоящем select.
          const items = (found as any).items
          return { ...found, items: Array.isArray(items) ? items : [] }
        }),
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

  const store = options.store ?? makeIdempotencyStore()
  if (options.withIdempotency || options.store) {
    prisma.idempotencyRecord = store.idempotencyRecord
  }
  const idempotency =
    options.withIdempotency || options.store ? new IdempotencyService(prisma) : undefined

  const svc = new InspectionService(
    prisma,
    tickets,
    timeline,
    exporter,
    serviceContracts,
    idempotency,
  )

  return { svc, prisma, timeline, store, schedule }
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

  /**
   * SMA-ROUND-SCHEDULE-ADVANCE-029: правило заменено намеренно.
   *
   * 119K утверждал, что завершение план не трогает, — и это было верно,
   * пока арифметики повторения не существовало: двигать было нечем и некуда.
   * Теперь завершение сдвигает план, иначе периодичность, обещанная
   * в планировщике, так и осталась бы словом в выпадающем списке.
   *
   * Что осталось прежним и проверяется здесь же: сам обход закрывается один
   * раз, а прошлые обходы никто не переписывает.
   */
  it('17. завершение сдвигает план и закрывает обход ровно один раз', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    prisma.inspectionSchedule.update.mockClear()

    await svc.completeRun(technician, 'run-1')

    // Закрытие идёт условным переходом статуса: победитель гонки один.
    expect(prisma.inspectionRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: InspectionRunStatus.COMPLETED } }),
        data: expect.objectContaining({ status: InspectionRunStatus.COMPLETED }),
      }),
    )
    // И план получает новую дату ближайшего визита.
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledTimes(1)
  })

  it('17b. проигравший гонку завершения план не двигает', async () => {
    const { svc, prisma } = makeSuite()

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    prisma.inspectionSchedule.update.mockClear()
    // Обход уже закрыт кем-то другим: изменённых рядов нет.
    prisma.inspectionRun.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(svc.completeRun(technician, 'run-1')).rejects.toBeTruthy()

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

// ── 119T: расписание не является источником доступа ─────────────────────────

describe('119T расписание сверяется с разрешённым, а не с присланным', () => {
  /**
   * Главное свойство связи: план подтверждает, что начинаемый обход — тот самый
   * визит, но не расширяет доступ. Ломается оно тихо — достаточно сверить
   * расписание с dto.locationId вместо локации, которую вернул канонический
   * доступ. Снаружи такая подмена выглядит рабочей: оба значения совпадают,
   * пока разрешение локации тривиально.
   */
  it('отказывает, когда план совпал с сырым запросом, но не с разрешённой локацией', async () => {
    const { svc, prisma } = makeSuite({
      schedule: makeSchedule({ locationId: OTHER_LOCATION.id }),
    })
    // Канонический доступ разрешил не ту локацию, что назвал запрос.
    prisma.location.findFirst = jest.fn(async () => ({ ...LOCATION }))

    await expect(
      svc.startRun(technician, {
        templateId: 'tpl-1',
        locationId: OTHER_LOCATION.id,
        scheduleId: 'sch-1',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)

    // Ни обхода, ни отметки в плане: подменённый запрос не стал исполнением.
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('план не открывает локацию, к которой у актора нет доступа', async () => {
    // Договора нет — канонический доступ обязан отказать первым.
    const { svc, prisma } = makeSuite({ contracts: [] })

    await expect(
      svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toBeInstanceOf(NotFoundException)

    // Расписание даже не читалось: доступ решается до него, а не им.
    expect(prisma.inspectionSchedule.findFirst).not.toHaveBeenCalled()
    expect(prisma.inspectionRun.create).not.toHaveBeenCalled()
  })
})

// ── 119T: повтор запуска ────────────────────────────────────────────────────

describe('119T идемпотентность запуска по плану', () => {
  it('повтор возвращает тот же обход, а не создаёт второй', async () => {
    const { svc, prisma, timeline } = makeSuite({ withIdempotency: true })

    const first: any = await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    const second: any = await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(second.id).toBe(first.id)
    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(1)
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledTimes(1)
    // Событие описывает появление обхода. Второго обхода не появилось.
    expect(timeline.recordLegacy).toHaveBeenCalledTimes(1)
  })

  it('следующий визит по тому же плану выполняется заново', async () => {
    const { svc, prisma, schedule } = makeSuite({ withIdempotency: true })

    const first: any = await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    // План закрыт предыдущим визитом — ключ следующего визита уже другой.
    schedule.lastRunId = first.id

    const next: any = await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    expect(next.id).not.toBe(first.id)
    expect(prisma.inspectionRun.create).toHaveBeenCalledTimes(2)
  })

  it('ключ и тип операции строятся по плану и разрешённому смыслу', async () => {
    const { svc, store } = makeSuite({ withIdempotency: true })

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    const row: any = [...store.rows.values()][0]
    expect(row.operationType).toBe('inspection.start_run')
    expect(row.key).toBe('sch-1:initial')
    expect(row.companyId).toBe(PROVIDER_ID)
    expect(row.userId).toBe(technician.id)
    expect(row.fingerprint).toBe(
      IdempotencyService.fingerprint({
        templateId: 'tpl-1',
        locationId: LOCATION.id,
        equipmentId: null,
      }),
    )
  })

  it('отредактированный план под тем же ключом отклоняется, а не угадывается', async () => {
    const { svc, schedule } = makeSuite({ withIdempotency: true })

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)
    // Смысл операции изменился, ключ прежний: две разные операции под одним ключом.
    schedule.equipmentId = 'eq-1'

    await expect(
      svc.startRun(technician, { ...base, equipmentId: 'eq-1', scheduleId: 'sch-1' } as any),
    ).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_KEY_CONFLICT' } })
  })

  it('обход «от руки» идемпотентность не затрагивает', async () => {
    const { svc, store } = makeSuite({ withIdempotency: true })

    await svc.startRun(technician, { ...base } as any)

    expect(store.idempotencyRecord.create).not.toHaveBeenCalled()
  })

  it('проверка занятости выполняется внутри транзакции создания', async () => {
    const { svc, prisma } = makeSuite();

    await svc.startRun(technician, { ...base, scheduleId: 'sch-1' } as any)

    const txStarted = prisma.$transaction.mock.invocationCallOrder[0]
    const guardRan = prisma.inspectionRun.findFirst.mock.invocationCallOrder[0]
    // Снаружи между проверкой и вставкой оставалось окно на второй обход.
    expect(guardRan).toBeGreaterThan(txStarted)
  })

  it('одновременный запуск другим актором ловится проверкой занятости', async () => {
    /**
     * Запись идемпотентности уникальна в пределах одного пользователя, поэтому
     * техник и диспетчер ключами не пересекаются. Их гонку закрывает не ключ,
     * а проверка незакрытого обхода внутри транзакции.
     */
    const { svc, store } = makeSuite({ withIdempotency: true, activeRun: { id: 'run-open' } })

    await expect(
      svc.startRun(dispatcher, { ...base, scheduleId: 'sch-1' } as any),
    ).rejects.toMatchObject({
      response: { code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS', runId: 'run-open' },
    })

    // Отказ не съедает ключ: законный повтор после отказа должен быть возможен.
    expect(store.idempotencyRecord.delete).toHaveBeenCalled()
  })
})
