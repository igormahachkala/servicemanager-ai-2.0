import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsPolicy, type UserCtx } from '../policy/tickets.policy';

@Injectable()
export class TimelineService {
  private readonly ticketsPolicy = new TicketsPolicy();

  constructor(private prisma: PrismaService) {}

  /**
   * Timeline (история) тикета.
   * Важно: перед чтением событий проверяем scope через Policy.
   * Если scope не позволяет — возвращаем 404 (не раскрываем существование тикета).
   */
  async getTicketTimeline(user: UserCtx, ticketId: string) {
    const decision = this.ticketsPolicy.getOneWhere(user, ticketId);

    if (!decision.allowed) {
      throw new NotFoundException('Ticket not found');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: decision.where,
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.prisma.domainEvent.findMany({
      where: {
        companyId: user.companyId,
        entityType: 'Ticket',
        entityId: ticketId,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
