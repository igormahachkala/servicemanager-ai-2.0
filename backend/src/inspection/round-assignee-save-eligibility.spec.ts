import { BadRequestException, NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'

import { InspectionScheduleService } from './inspection-schedule.service'

/**
 * SMA-ROUND-ASSIGNEE-SAVE-ELIGIBILITY-HARDENING-039.
 *
 * Сохранение назначения проверяет ту же пригодность, что и выбор кандидатов.
 *
 * Аудит 034 нашёл расхождение: выбор сужал по договору и привязкам к точке,
 * а запись проверяла только компанию, активность и правило исполнителя.
 * Подставленный идентификатор своего же сотрудника без привязки к точке
 * сохранялся. Интерфейс границей доступа не является, поэтому проверяется
 * сервер, а не форма.
 *
 * Пригодность здесь заново не вычисляется: она приходит от канонического
 * резолвера, того же, что наполняет выбор и назначает заявки. Поэтому
 * заглушка резолвера — это и есть «мир», а проверяется решение сохранения.
 */

const PROVIDER = 'provider-1'
const CLIENT = 'client-a'
const OTHER_PROVIDER = 'provider-2'

const admin = { id: 'u-admin', companyId: PROVIDER, role: UserRole.ADMIN } as any
const tech = { id: 'u-tech', companyId: PROVIDER, role: UserRole.TECHNICIAN }

const LOC_A = { id: 'loc-a', clientCompanyId: CLIENT }
const LOC_B = { id: 'loc-b', clientCompanyId: CLIENT }

type Suite = {
  svc: any
  assignment: { listLocationAssignableExecutors: jest.Mock }
  prisma: any
}

/**
 * Мир задаётся двумя вещами: кто вообще существует в компании и кого
 * канонический резолвер считает пригодным на этой точке. Всё остальное —
 * поведение сохранения.
 */
function makeSuite(opts: {
  existingUsers?: Array<{ id: string; companyId: string; isActive?: boolean; deleted?: boolean }>
  eligible?: string[]
  eligibleByLocation?: Record<string, string[]>
  schedule?: { assignedToUserId?: string | null; locationId?: string }
} = {}): Suite {
  const existing = opts.existingUsers ?? [{ id: tech.id, companyId: PROVIDER }]
  const eligible = opts.eligible ?? [tech.id]

  const prisma = {
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        const row = existing.find((u) => u.id === where.id)
        if (!row) return null
        // Запрос сужен по компании, активности и удалению — как в сервисе.
        if (where.companyId && row.companyId !== where.companyId) return null
        if (where.isActive === true && row.isActive === false) return null
        if (where.deletedAt === null && row.deleted === true) return null
        return { id: row.id }
      }),
    },
    inspectionSchedule: {
      findFirst: jest.fn(async () => ({
        id: 'sch-1',
        frequency: 'ONCE',
        intervalDays: null,
        lastGeneratedAt: null,
        assignedToUserId: opts.schedule?.assignedToUserId ?? null,
        location: { id: opts.schedule?.locationId ?? LOC_A.id, clientCompanyId: CLIENT },
        _count: { runs: 0 },
      })),
      update: jest.fn(async ({ data }: any) => ({ id: 'sch-1', ...data, runs: [] })),
      create: jest.fn(async ({ data }: any) => ({ id: 'sch-1', ...data, runs: [] })),
    },
    inspectionTemplate: {
      findFirst: jest.fn(async () => ({ id: 'tpl-1', name: 'Обход', companyId: PROVIDER })),
    },
    location: {
      findFirst: jest.fn(async ({ where }: any) =>
        [LOC_A, LOC_B].find((l) => l.id === where.id) ?? null,
      ),
    },
    equipment: { findFirst: jest.fn(async () => null) },
  } as any

  const serviceContracts = {
    getLinkedClientAccess: jest.fn(async () => ({ id: 'sc-1', locationMode: 'ALL_LOCATIONS', locations: [] })),
  } as any

  const assignment = {
    listLocationAssignableExecutors: jest.fn(async ({ locationId }: any) => {
      const eligibleForLocation = opts.eligibleByLocation?.[locationId] ?? eligible
      return eligibleForLocation.map((id) => ({
        id,
        email: `${id}@x`,
        firstName: 'И',
        lastName: 'П',
        role: UserRole.TECHNICIAN,
        activeLoad: 0,
      }))
    }),
  }

  const svc: any = new InspectionScheduleService(prisma, serviceContracts, assignment as any)
  // Доступ к точке решает канонический contract-примитив; здесь он открыт,
  // чтобы проверять именно назначение, а не заново сужение по договору.
  svc.requireAccessibleLocation = async (_u: any, id: string) =>
    [LOC_A, LOC_B].find((l) => l.id === id) ?? (() => { throw new NotFoundException('Location not found') })()

  return { svc, assignment, prisma }
}

const createDto = (assignedToUserId?: string | null) => ({
  templateId: 'tpl-1',
  locationId: LOC_A.id,
  name: 'Обход',
  frequency: 'ONCE',
  startDate: '2026-10-01T09:00:00.000Z',
  ...(assignedToUserId === undefined ? {} : { assignedToUserId }),
}) as any

describe('039 отрицательные: сохранение закрывается', () => {
  it('подставленный свой же сотрудник без права на точке отклонён', async () => {
    // Главная находка аудита: существует, своя компания, исполнитель —
    // но канонический резолвер его на этой точке не предлагает.
    const { svc } = makeSuite({ eligible: [] })
    await expect(svc.create(admin, createDto(tech.id))).rejects.toBeInstanceOf(BadRequestException)
  })

  it('сотрудник другого арендатора отклонён', async () => {
    const { svc } = makeSuite({
      existingUsers: [{ id: 'u-foreign', companyId: OTHER_PROVIDER }],
      eligible: ['u-foreign'],
    })
    await expect(svc.create(admin, createDto('u-foreign'))).rejects.toBeInstanceOf(NotFoundException)
  })

  it('несуществующий идентификатор отклонён', async () => {
    const { svc } = makeSuite({ existingUsers: [] })
    await expect(svc.create(admin, createDto('u-nope'))).rejects.toBeInstanceOf(NotFoundException)
  })

  it('погашенная учётная запись отклонена', async () => {
    const { svc } = makeSuite({
      existingUsers: [{ id: tech.id, companyId: PROVIDER, isActive: false }],
    })
    await expect(svc.create(admin, createDto(tech.id))).rejects.toBeInstanceOf(NotFoundException)
  })

  it('удалённая учётная запись отклонена', async () => {
    const { svc } = makeSuite({
      existingUsers: [{ id: tech.id, companyId: PROVIDER, deleted: true }],
    })
    await expect(svc.create(admin, createDto(tech.id))).rejects.toBeInstanceOf(NotFoundException)
  })

  it('не-исполнитель отклонён: резолвер его не предлагает', async () => {
    /*
     * Правило исполнителя живёт в каноническом резолвере и повторно здесь
     * не описывается. Не-исполнитель в его выдаче не появляется, и этого
     * достаточно: сохранение отказывает.
     */
    const { svc } = makeSuite({
      existingUsers: [{ id: 'u-staff', companyId: PROVIDER }],
      eligible: [],
    })
    await expect(svc.create(admin, createDto('u-staff'))).rejects.toBeInstanceOf(BadRequestException)
  })

  it('нет привязки к точке или нет договора — один и тот же отказ; specialization остаётся за resolver', async () => {
    /*
     * Contract + Location eligibility обязательны для Round assignee.
     * Specialization применяет канонический resolver только тогда, когда
     * caller передаёт реальные requiredSpecializations. У Round Schedule
     * без category requirements этот список пуст, поэтому сохранение не
     * дублирует и не выдумывает отдельное specialization-правило.
     */
    for (const reason of ['без привязки', 'без договора']) {
      const { svc } = makeSuite({ eligible: [] })
      await expect(svc.create(admin, createDto(tech.id))).rejects.toThrow(
        /not eligible to execute rounds at this location/,
      )
      expect(reason).toBeTruthy()
    }
  })

  it('обновление назначения проверяется так же, как создание', async () => {
    const { svc } = makeSuite({ eligible: [] })
    await expect(
      svc.update(admin, 'sch-1', { assignedToUserId: tech.id } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('смена точки перепроверяет уже назначенного и отказывает, если он больше не подходит', async () => {
    /*
     * Исполнителя в запросе нет — меняют только точку. Прежний назначенный
     * на новой точке работать не может, и оставить его нельзя.
     */
    const { svc, assignment } = makeSuite({
      schedule: { assignedToUserId: tech.id, locationId: LOC_A.id },
      eligible: [],
    })

    await expect(
      svc.update(admin, 'sch-1', { locationId: LOC_B.id } as any),
    ).rejects.toBeInstanceOf(BadRequestException)

    // Проверялась именно новая точка, а не прежняя.
    expect(assignment.listLocationAssignableExecutors).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: LOC_B.id, scopeCompanyId: CLIENT }),
    )
  })

  it('смена точки и нового исполнителя проверяет исполнителя по новой точке до записи', async () => {
    /*
     * Тот же update меняет точку A -> B и явно назначает исполнителя.
     * Исполнитель подходит на старой точке A, но не подходит на новой B:
     * сохранение обязано проверять B, иначе запрос ошибочно пройдёт.
     */
    const { svc, assignment, prisma } = makeSuite({
      schedule: { assignedToUserId: null, locationId: LOC_A.id },
      eligibleByLocation: {
        [LOC_A.id]: [tech.id],
        [LOC_B.id]: [],
      },
    })

    await expect(
      svc.update(admin, 'sch-1', { locationId: LOC_B.id, assignedToUserId: tech.id } as any),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(assignment.listLocationAssignableExecutors).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: LOC_B.id, scopeCompanyId: CLIENT }),
    )
    expect(prisma.inspectionSchedule.update).not.toHaveBeenCalled()
  })

  it('отказ наступает до записи: испорченного плана не остаётся', async () => {
    const { svc, prisma } = makeSuite({ eligible: [] })
    await expect(svc.create(admin, createDto(tech.id))).rejects.toBeTruthy()
    expect(prisma.inspectionSchedule.create).not.toHaveBeenCalled()
  })
})

describe('039 положительные: пригодный исполнитель проходит', () => {
  it('назначается при создании', async () => {
    const { svc, prisma } = makeSuite({ eligible: [tech.id] })
    await svc.create(admin, createDto(tech.id))
    expect(prisma.inspectionSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToUserId: tech.id }) }),
    )
  })

  it('обновляется', async () => {
    const { svc, prisma } = makeSuite({ eligible: [tech.id] })
    await svc.update(admin, 'sch-1', { assignedToUserId: tech.id } as any)
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedTo: { connect: { id: tech.id } } }) }),
    )
  })

  it('снимается явным null, и пригодность при этом не спрашивается', async () => {
    const { svc, assignment, prisma } = makeSuite({ eligible: [] })
    await svc.update(admin, 'sch-1', { assignedToUserId: null } as any)
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedTo: { disconnect: true } }) }),
    )
    expect(assignment.listLocationAssignableExecutors).not.toHaveBeenCalled()
  })

  it('план без исполнителя создаётся и резолвера не трогает', async () => {
    const { svc, assignment } = makeSuite()
    await svc.create(admin, createDto(undefined))
    expect(assignment.listLocationAssignableExecutors).not.toHaveBeenCalled()
  })

  it('смена точки проходит, если назначенный подходит и на новой', async () => {
    const { svc, prisma } = makeSuite({
      schedule: { assignedToUserId: tech.id, locationId: LOC_A.id },
      eligible: [tech.id],
    })
    await svc.update(admin, 'sch-1', { locationId: LOC_B.id } as any)
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledTimes(1)
  })

  it('смена точки и нового исполнителя проходит, если исполнитель подходит на новой точке', async () => {
    const { svc, assignment, prisma } = makeSuite({
      schedule: { assignedToUserId: null, locationId: LOC_A.id },
      eligibleByLocation: {
        [LOC_A.id]: [],
        [LOC_B.id]: [tech.id],
      },
    })

    await svc.update(admin, 'sch-1', { locationId: LOC_B.id, assignedToUserId: tech.id } as any)

    expect(assignment.listLocationAssignableExecutors).toHaveBeenCalledWith(
      expect.objectContaining({ locationId: LOC_B.id, scopeCompanyId: CLIENT }),
    )
    expect(prisma.inspectionSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          location: { connect: { id: LOC_B.id } },
          assignedTo: { connect: { id: tech.id } },
        }),
      }),
    )
  })
})

describe('039 границы изменения', () => {
  it('пригодность спрашивается у канонического резолвера, а не считается здесь', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'inspection-schedule.service.ts'),
      'utf8',
    ) as string
    const fn = source.slice(
      source.indexOf('private async resolveAssigneeId'),
      source.indexOf('private parseStartDate'),
    )

    // Решение о пригодности — один вызов канонического резолвера.
    expect(fn).toContain('this.assignment.listLocationAssignableExecutors')
    // Правила договора, привязок и специализаций здесь не переписаны.
    expect(fn).not.toContain('serviceContract')
    expect(fn).not.toContain('userLocationBinding')
    expect(fn).not.toContain('technicianSpecialization')
    expect(fn).not.toContain('isExecutorEligible')
  })

  it('пригодность считается для точки, а не вообще', () => {
    const source = require('node:fs').readFileSync(
      require('node:path').resolve(__dirname, 'inspection-schedule.service.ts'),
      'utf8',
    ) as string
    const fn = source.slice(
      source.indexOf('private async resolveAssigneeId'),
      source.indexOf('private parseStartDate'),
    )
    expect(fn).toContain('scopeCompanyId: location.clientCompanyId')
    expect(fn).toContain('locationId: location.id')
    expect(fn).toContain('employerCompanyId: user.companyId')
  })
})
