import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { ServiceContractRole } from '@prisma/client'

import { type UserCtx } from '../policy/tickets.policy'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveReadableTicketAccess } from '../tickets/ticket-access.utils'

/**
 * Отметка прочтения берётся из показанного клиенту сообщения, но не позже
 * времени сервера: часы клиента не могут отметить прочитанным будущее.
 */
export function resolveChatReadAt(upTo: string | undefined, now: Date): Date {
  if (!upTo) return now
  const at = new Date(upTo)
  if (Number.isNaN(at.getTime())) return now
  return at.getTime() < now.getTime() ? at : now
}

@Injectable()
export class TicketChatReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  /**
   * Доступ тот же, что у чтения ленты: отметить прочитанным можно только
   * чат, который пользователь вправе открыть.
   *
   * Отметка только растёт. Два параллельных запроса (компьютер и телефон,
   * или старый ответ сети после нового) не откатывают её назад. Создание и
   * сдвиг — один INSERT … ON CONFLICT: второй запрос ждёт строку первого и
   * сдвигает её, только если его отметка позже. Пара updateMany + createMany
   * при первом прочтении теряла более позднюю отметку: оба не находили
   * строки, вставка второго молча пропускалась.
   */
  async markRead(
    user: UserCtx,
    ticketId: string,
    upTo?: string,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: user.id,
        role: user.role,
        companyId: user.companyId,
        accessFlags: user.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    const lastReadAt = resolveChatReadAt(upTo, new Date())
    await this.prisma.$executeRaw`
      INSERT INTO "TicketChatRead" ("id", "userId", "ticketId", "lastReadAt", "updatedAt")
      VALUES (${randomUUID()}, ${user.id}, ${ticketId}, ${lastReadAt}, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "ticketId") DO UPDATE
        SET "lastReadAt" = EXCLUDED."lastReadAt", "updatedAt" = CURRENT_TIMESTAMP
        WHERE "TicketChatRead"."lastReadAt" < EXCLUDED."lastReadAt"
    `

    return { ok: true, ticketId }
  }
}
