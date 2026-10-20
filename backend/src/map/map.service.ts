import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

type DominantStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'NONE';

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async listLocations(companyId: string) {
    const startOfToday = this.startOfToday();

    const locations = await this.prisma.location.findMany({
      where: {
        clientCompanyId: companyId,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        tickets: {
          where: {
            companyId,
            createdAt: { gte: startOfToday },
          },
          select: {
            status: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return locations.map((location) => {
      const summary = this.summarizeStatuses(location.tickets.map((ticket) => ticket.status));

      return {
        locationId: location.id,
        name: location.name,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        ticketsToday: summary.total,
        newCount: summary.newCount,
        inProgressCount: summary.inProgressCount,
        doneCount: summary.doneCount,
        dominantStatus: summary.dominantStatus,
      };
    });
  }

  async getLocation(companyId: string, locationId: string) {
    const startOfToday = this.startOfToday();

    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: companyId,
      },
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        tickets: {
          where: {
            companyId,
            createdAt: { gte: startOfToday },
          },
          select: {
            status: true,
          },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const recentTickets = await this.prisma.ticket.findMany({
      where: {
        companyId,
        locationId,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        problemCategory: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    const summary = this.summarizeStatuses(location.tickets.map((ticket) => ticket.status));

    return {
      locationId: location.id,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      summary: {
        total: summary.total,
        newCount: summary.newCount,
        inProgressCount: summary.inProgressCount,
        doneCount: summary.doneCount,
      },
      recentTickets: recentTickets.map((ticket) => ({
        id: ticket.id,
        title: ticket.problemCategory.name,
        status: ticket.status,
        createdAt: ticket.createdAt,
      })),
    };
  }

  private startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private summarizeStatuses(statuses: TicketStatus[]) {
    const newCount = statuses.filter((status) => status === TicketStatus.NEW).length;
    const inProgressCount = statuses.filter((status) => status === TicketStatus.IN_PROGRESS).length;
    const doneCount = statuses.filter((status) => status === TicketStatus.DONE).length;

    return {
      total: statuses.length,
      newCount,
      inProgressCount,
      doneCount,
      dominantStatus: this.getDominantStatus({ newCount, inProgressCount, doneCount }),
    };
  }

  private getDominantStatus(input: {
    newCount: number;
    inProgressCount: number;
    doneCount: number;
  }): DominantStatus {
    if (input.newCount > 0) return 'NEW';
    if (input.inProgressCount > 0) return 'IN_PROGRESS';
    if (input.doneCount > 0) return 'DONE';
    return 'NONE';
  }
}