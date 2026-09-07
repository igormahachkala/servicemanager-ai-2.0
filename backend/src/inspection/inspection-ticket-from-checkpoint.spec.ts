import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { InspectionRunItemStatus, InspectionRunStatus, TicketUrgency, UserRole } from '@prisma/client'

import { InspectionService } from './inspection.service'

/**
 * SMA-ROUNDS-V1-TICKET-FROM-CHECKPOINT-103.
 *
 * Проверяется ровно то, ради чего заявка создаётся из пункта обхода: заявка
 * заводится каноническим TicketsService, владелец и локация берутся с сервера,
 * связь «пункт → заявка» сохраняется, а обход отдаёт номер заявки наружу.
 *
 * Файл назван по задаче, а не inspection.service.spec.ts: этот путь занимает
 * ветка 094, и одинаковое имя дало бы конфликт при её слиянии.
 */

const technician = { id: 'tech-1', companyId: 'provider-1', role: UserRole.TECHNICIAN }

const RUN = {
  id: 'run-1',
  locationId: 'loc-1',
  equipmentId: 'eq-1',
  status: InspectionRunStatus.IN_PROGRESS,
}

const ITEM = {
  id: 'item-1',
  templateItemId: 'tpl-item-1',
  title: 'Течь под раковиной',
  description: 'Проверить сифон',
  status: InspectionRunItemStatus.ISSUE,
  requiresRepair: false,
  comment: 'Капает на пол',
  ticketId: null as string | null,
}

function makeDeps(overrides: { run?: any; item?: any } = {}) {
  const prisma = {
    inspectionRun: {
      findFirst: jest.fn().mockResolvedValue('run' in overrides ? overrides.run : RUN),
    },
    inspectionRunItem: {
      findFirst: jest.fn().mockResolvedValue('item' in overrides ? overrides.item : ITEM),
      update: jest.fn().mockResolvedValue({ ...ITEM, ticketId: 'ticket-1', requiresRepair: true }),
    },
  } as any

  const tickets = {
    create: jest.fn().mockResolvedValue({
      ticket: { id: 'ticket-1', ticketNumber: 716, status: 'NEW' },
      generated: null,
      autoAssigned: false,
    }),
  } as any

  const timeline = { recordLegacy: jest.fn().mockResolvedValue(undefined) } as any

  return { prisma, tickets, timeline }
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new InspectionService(deps.prisma, deps.tickets, deps.timeline, {} as any)
}

describe('InspectionService.createTicketFromItem', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates an ordinary ticket through the canonical TicketsService', async () => {
    const deps = makeDeps()
    const service = makeService(deps)

    const result = await service.createTicketFromItem(technician, RUN.id, ITEM.id, {
      categoryId: 'cat-1',
    })

    expect(deps.tickets.create).toHaveBeenCalledTimes(1)
    const [companyId, actor, payload] = deps.tickets.create.mock.calls[0]
    expect(companyId).toBe(technician.companyId)
    expect(actor).toEqual({ id: technician.id, role: technician.role })
    expect(payload.categoryId).toBe('cat-1')
    expect(result.ticket.id).toBe('ticket-1')
  })

  it('derives tenant, location and equipment from the run, never from the caller', async () => {
    const deps = makeDeps()
    const service = makeService(deps)

    await service.createTicketFromItem(technician, RUN.id, ITEM.id, {
      categoryId: 'cat-1',
      // Клиент не может подсунуть чужую локацию: в DTO таких полей нет,
      // а сюда они попали бы только через приведение типа.
      ...({ locationId: 'foreign-loc', companyId: 'foreign-co' } as any),
    })

    const [companyId, , payload] = deps.tickets.create.mock.calls[0]
    expect(companyId).toBe(technician.companyId)
    expect(payload.locationId).toBe(RUN.locationId)
    expect(payload.equipmentId).toBe(RUN.equipmentId)

    // Обход ищется только внутри компании пользователя.
    expect(deps.prisma.inspectionRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RUN.id, companyId: technician.companyId } }),
    )
  })

  it('persists the checkpoint to ticket link and marks the checkpoint as needing repair', async () => {
    const deps = makeDeps()
    const service = makeService(deps)

    await service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' })

    expect(deps.prisma.inspectionRunItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM.id },
        data: { ticketId: 'ticket-1', requiresRepair: true },
      }),
    )
  })

  it('returns the linked ticket number to the round, so the checkpoint can name it', async () => {
    const deps = makeDeps()
    const service = makeService(deps)

    await service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' })

    // Обход показывает «Заявка #716». Номер обязан приходить с сервера:
    // после перезагрузки страницы локального состояния уже нет.
    const select = deps.prisma.inspectionRunItem.update.mock.calls[0][0].select
    expect(select.ticketId).toBe(true)
    expect(select.ticket.select).toEqual(
      expect.objectContaining({ id: true, ticketNumber: true, status: true }),
    )
  })

  it('records the origin of the ticket on the timeline', async () => {
    const deps = makeDeps()
    const service = makeService(deps)

    await service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' })

    expect(deps.timeline.recordLegacy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'inspection.item_ticket_created',
        entityType: 'InspectionRunItem',
        entityId: ITEM.id,
        payload: expect.objectContaining({ runId: RUN.id, itemId: ITEM.id, ticketId: 'ticket-1' }),
      }),
    )
  })

  it('raises urgency for a critical checkpoint', async () => {
    const deps = makeDeps({ item: { ...ITEM, status: InspectionRunItemStatus.CRITICAL } })
    const service = makeService(deps)

    await service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' })

    expect(deps.tickets.create.mock.calls[0][2].urgency).toBe(TicketUrgency.URGENT)
  })

  it('refuses a second ticket for the same checkpoint', async () => {
    const deps = makeDeps({ item: { ...ITEM, ticketId: 'ticket-1' } })
    const service = makeService(deps)

    await expect(
      service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(deps.tickets.create).not.toHaveBeenCalled()
  })

  it('refuses a checkpoint that is not a problem', async () => {
    const deps = makeDeps({ item: { ...ITEM, status: InspectionRunItemStatus.OK } })
    const service = makeService(deps)

    await expect(
      service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(deps.tickets.create).not.toHaveBeenCalled()
  })

  it('refuses a run from another tenant', async () => {
    const deps = makeDeps({ run: null })
    const service = makeService(deps)

    await expect(
      service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(deps.tickets.create).not.toHaveBeenCalled()
  })

  it('refuses a checkpoint that does not belong to the run', async () => {
    const deps = makeDeps({ item: null })
    const service = makeService(deps)

    await expect(
      service.createTicketFromItem(technician, RUN.id, 'item-from-another-run', { categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(deps.tickets.create).not.toHaveBeenCalled()
    expect(deps.prisma.inspectionRunItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          runId: RUN.id,
          run: { companyId: technician.companyId },
        }),
      }),
    )
  })

  it('refuses a completed run', async () => {
    const deps = makeDeps({ run: { ...RUN, status: InspectionRunStatus.COMPLETED } })
    const service = makeService(deps)

    await expect(
      service.createTicketFromItem(technician, RUN.id, ITEM.id, { categoryId: 'cat-1' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(deps.tickets.create).not.toHaveBeenCalled()
  })

  it('refuses a role that cannot execute runs', async () => {
    const deps = makeDeps()
    const service = makeService(deps)

    await expect(
      service.createTicketFromItem({ ...technician, role: UserRole.CLIENT }, RUN.id, ITEM.id, {
        categoryId: 'cat-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(deps.prisma.inspectionRun.findFirst).not.toHaveBeenCalled()
    expect(deps.tickets.create).not.toHaveBeenCalled()
  })
})
