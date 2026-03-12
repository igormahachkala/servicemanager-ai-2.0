import { Injectable } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TechniciansWorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(companyId: string) {
    const technicians = await this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        technicianSpecializations: {
          include: {
            specialization: true,
          },
        },
        assignedTickets: {
          where: {
            status: {
              in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
            },
          },
          select: {
            id: true,
            status: true,
            urgency: true,
            slaDueAt: true,
            problemCategory: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return technicians.map((t) => {
      const assignedCount = t.assignedTickets.filter(
        (x) => x.status === TicketStatus.ASSIGNED,
      ).length;

      const inProgressCount = t.assignedTickets.filter(
        (x) => x.status === TicketStatus.IN_PROGRESS,
      ).length;

      return {
        technicianId: t.id,
        email: t.email,
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
        specializations: t.technicianSpecializations.map((x) => ({
          id: x.specialization.id,
          name: x.specialization.name,
          isActive: x.specialization.isActive,
        })),
        tickets: t.assignedTickets.map((ticket) => ({
          id: ticket.id,
          status: ticket.status,
          urgency: ticket.urgency,
          slaDueAt: ticket.slaDueAt,
          category: ticket.problemCategory,
        })),
      };
    });
  }
}
