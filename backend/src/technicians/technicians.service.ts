import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        technicianSpecializations: {
          include: {
            specialization: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMe(companyId: string, userId: string) {
    const tech = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        technicianSpecializations: {
          select: {
            specialization: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
      },
    });

    if (!tech) {
      throw new NotFoundException('Technician not found');
    }

    return {
      id: tech.id,
      email: tech.email,
      role: tech.role,
      companyId: tech.companyId,
      createdAt: tech.createdAt,
      specializations: tech.technicianSpecializations.map((x) => x.specialization),
      specializationCount: tech.technicianSpecializations.length,
    };
  }

  async setSpecializations(companyId: string, technicianId: string, specializationIds: string[]) {
    const normalizedIds = [...new Set(
      (specializationIds ?? [])
        .map((id) => (id ?? '').trim())
        .filter((id) => id.length > 0),
    )];

    const tech = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
      },
    });

    if (!tech) {
      throw new NotFoundException('Technician not found');
    }

    const specs = await this.prisma.specialization.findMany({
      where: {
        companyId,
        id: { in: normalizedIds },
      },
      select: {
        id: true,
      },
    });

    if (specs.length !== normalizedIds.length) {
      throw new BadRequestException('Some specializationIds are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.technicianSpecialization.deleteMany({
        where: {
          userId: technicianId,
          user: {
            companyId,
          },
        },
      });

      if (normalizedIds.length > 0) {
        await tx.technicianSpecialization.createMany({
          data: normalizedIds.map((specializationId) => ({
            userId: technicianId,
            specializationId,
          })),
        });
      }
    });

    return this.prisma.user.findFirst({
      where: {
        id: technicianId,
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        technicianSpecializations: {
          include: {
            specialization: true,
          },
        },
      },
    });
  }
}
