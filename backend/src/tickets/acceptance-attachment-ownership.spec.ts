import { BadRequestException } from '@nestjs/common'
import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import { TicketsAcceptanceService } from './tickets.acceptance.service'
import * as ticketAccessUtils from './ticket-access.utils'
import { AcceptanceDecision } from './dto/ticket-acceptance.dto'

/**
 * SMA-ACCEPTANCE-ATTACHMENT-OWNERSHIP-P0-077.
 *
 * Приёмка помечает вложения как отчёт о работе или как материалы отказа.
 * Прежний отбор смотрел только на компанию, а компания у заявок одна и та же,
 * поэтому id вложения соседней заявки переподчинял её файл текущей.
 *
 * Здесь проверяется граница владения: что допускается, что закрывается,
 * и что при отказе решение не применяется частично — ни статуса, ни истории,
 * ни события приёмки, ни перепривязки чужого файла.
 */

jest.mock('./ticket-access.utils', () => ({
  resolveReadableTicketAccess: jest.fn(),
}))

const mockResolveReadable = ticketAccessUtils.resolveReadableTicketAccess as jest.MockedFunction<
  typeof ticketAccessUtils.resolveReadableTicketAccess
>

const CLIENT_ID = 'client-1'
const OTHER_COMPANY_ID = 'client-2'
const TICKET_ID = 'ticket-1'
const OTHER_TICKET_ID = 'ticket-2'
const ACTOR_ID = 'u-1'
const OTHER_USER_ID = 'u-2'

type AttachmentRow = {
  id: string
  companyId: string
  ticketId: string | null
  uploadedByUserId: string | null
}

const actor = { id: ACTOR_ID, role: UserRole.ADMIN, companyId: CLIENT_ID }

function makeSetup(attachments: AttachmentRow[]) {
  const txTicket = {
    id: TICKET_ID,
    companyId: CLIENT_ID,
    status: TicketStatus.AWAITING_ACCEPTANCE,
    slaDueAt: null,
    slaBreachedAt: null,
    closedAt: null,
    assignedTechnicianId: null,
    ticketNumber: 101,
  }

  const tx = {
    ticket: {
      findFirst: jest.fn().mockResolvedValue(txTicket),
      update: jest.fn().mockImplementation(async (args: any) => ({ ...txTicket, status: args.data.status })),
    },
    ticketAttachment: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      /*
       * Мок повторяет разбор where, а не отдаёт заготовленный ответ: иначе
       * тест проверял бы сам мок, и снятие условия в сервисе прошло бы мимо.
       */
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? []
        return attachments.filter((row) => {
          if (!ids.includes(row.id)) return false
          if (where?.companyId && row.companyId !== where.companyId) return false
          const or = where?.OR
          if (!or) return true
          return or.some((clause: any) => {
            if ('uploadedByUserId' in clause) {
              return row.ticketId === null && row.uploadedByUserId === clause.uploadedByUserId
            }
            return row.ticketId === clause.ticketId
          })
        })
      }),
    },
    ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  }

  const prisma = {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    user: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: where.id,
        companyId: where.companyId,
        role: UserRole.ADMIN,
        isActive: true,
        company: { id: where.companyId, type: CompanyType.CLIENT },
      })),
    },
    ticket: {
      findFirst: jest.fn().mockResolvedValue({
        id: TICKET_ID,
        companyId: CLIENT_ID,
        assignedTechnicianId: null,
        createdByUserId: null,
        assignedTechnician: null,
      }),
    },
  } as any

  const timeline = { recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }) }
  const serviceContracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue({ role: ServiceContractRole.PRIMARY }),
  }
  const notifications = { onTicketAccepted: jest.fn(), onTicketRejected: jest.fn() }

  const svc = new TicketsAcceptanceService(prisma, timeline as any, serviceContracts as any, notifications as any)
  return { svc, tx, timeline, notifications }
}

function accept(svc: TicketsAcceptanceService, attachmentIds: string[]) {
  return svc.decide(actor, TICKET_ID, { decision: AcceptanceDecision.ACCEPT, attachmentIds })
}

beforeEach(() => {
  mockResolveReadable.mockReset()
  mockResolveReadable.mockResolvedValue({
    ticket: { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null },
    scopeCompanyId: CLIENT_ID,
    visibilityMode: 'tenant',
  } as any)
})

describe('077 приёмка принимает только вложения этой заявки', () => {
  it('1. вложение текущей заявки допустимо', async () => {
    const { svc, tx } = makeSetup([
      { id: 'att-own', companyId: CLIENT_ID, ticketId: TICKET_ID, uploadedByUserId: ACTOR_ID },
    ])

    const result = await accept(svc, ['att-own'])

    expect(result.status).toBe(TicketStatus.DONE)
    expect(tx.ticketAttachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ purpose: 'WORK_REPORT' }) }),
    )
  })

  it('2. собственный неприкреплённый черновик актора допустим', async () => {
    /*
     * Модель черновика в проекте есть: uploadDraftAttachment создаёт вложение
     * с ticketId null. Условие взято тем же, что и у канонического связывания
     * при создании заявки: ничей файл, загруженный самим актором.
     */
    const { svc, tx } = makeSetup([
      { id: 'att-draft', companyId: CLIENT_ID, ticketId: null, uploadedByUserId: ACTOR_ID },
    ])

    await accept(svc, ['att-draft'])

    expect(tx.ticketAttachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: TICKET_ID }) }),
    )
  })
})

describe('077 отрицательные: чужое не принимается', () => {
  it('3. вложение другой заявки той же компании отклонено', async () => {
    const { svc } = makeSetup([
      { id: 'att-foreign', companyId: CLIENT_ID, ticketId: OTHER_TICKET_ID, uploadedByUserId: ACTOR_ID },
    ])

    await expect(accept(svc, ['att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
  })

  it('4. вложение заявки другой компании отклонено', async () => {
    const { svc } = makeSetup([
      { id: 'att-other-co', companyId: OTHER_COMPANY_ID, ticketId: OTHER_TICKET_ID, uploadedByUserId: ACTOR_ID },
    ])

    await expect(accept(svc, ['att-other-co'])).rejects.toBeInstanceOf(BadRequestException)
  })

  it('5. неизвестный id отклонён', async () => {
    const { svc } = makeSetup([])

    await expect(accept(svc, ['att-does-not-exist'])).rejects.toBeInstanceOf(BadRequestException)
  })

  it('6. чужой черновик той же компании отклонён: загрузил не актор', async () => {
    const { svc } = makeSetup([
      { id: 'att-draft-other', companyId: CLIENT_ID, ticketId: null, uploadedByUserId: OTHER_USER_ID },
    ])

    await expect(accept(svc, ['att-draft-other'])).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('077 смешанный список: решение не применяется частично', () => {
  const mixed = () =>
    makeSetup([
      { id: 'att-own', companyId: CLIENT_ID, ticketId: TICKET_ID, uploadedByUserId: ACTOR_ID },
      { id: 'att-foreign', companyId: CLIENT_ID, ticketId: OTHER_TICKET_ID, uploadedByUserId: ACTOR_ID },
    ])

  it('7. один свой и один чужой — отказ целиком', async () => {
    const { svc } = mixed()
    await expect(accept(svc, ['att-own', 'att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
  })

  it('8. при отказе статус заявки не меняется', async () => {
    const { svc, tx } = mixed()
    await expect(accept(svc, ['att-own', 'att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('9. при отказе история статуса не пишется', async () => {
    const { svc, tx } = mixed()
    await expect(accept(svc, ['att-own', 'att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.ticketStatusHistory.create).not.toHaveBeenCalled()
  })

  it('10. при отказе событие приёмки не пишется', async () => {
    const { svc, timeline } = mixed()
    await expect(accept(svc, ['att-own', 'att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
    expect(timeline.recordTx).not.toHaveBeenCalled()
  })

  it('11. при отказе ни одно вложение не перепривязано', async () => {
    const { svc, tx } = mixed()
    await expect(accept(svc, ['att-own', 'att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
    expect(tx.ticketAttachment.updateMany).not.toHaveBeenCalled()
  })

  it('12. при отказе уведомления не уходят', async () => {
    const { svc, notifications } = mixed()
    await expect(accept(svc, ['att-own', 'att-foreign'])).rejects.toBeInstanceOf(BadRequestException)
    expect(notifications.onTicketAccepted).not.toHaveBeenCalled()
    expect(notifications.onTicketRejected).not.toHaveBeenCalled()
  })
})

describe('077 проверка идёт до записи, а не после', () => {
  it('13. отказ наступает раньше обновления заявки', async () => {
    /*
     * Всё решение идёт одной транзакцией, и откат снял бы запись и так.
     * Но порядок важен сам по себе: проверка стоит до первой записи,
     * поэтому испорченного состояния не возникает даже внутри транзакции.
     */
    const { svc, tx } = makeSetup([
      { id: 'att-foreign', companyId: CLIENT_ID, ticketId: OTHER_TICKET_ID, uploadedByUserId: ACTOR_ID },
    ])

    await expect(accept(svc, ['att-foreign'])).rejects.toBeInstanceOf(BadRequestException)

    expect(tx.ticketAttachment.findMany).toHaveBeenCalled()
    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('14. пустой список вложений лишних запросов не делает', async () => {
    const { svc, tx } = makeSetup([])

    const result = await svc.decide(actor, TICKET_ID, { decision: AcceptanceDecision.ACCEPT })

    expect(result.status).toBe(TicketStatus.DONE)
    expect(tx.ticketAttachment.findMany).not.toHaveBeenCalled()
    expect(tx.ticketAttachment.updateMany).not.toHaveBeenCalled()
  })
})
