import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class TechniciansService {
  constructor(private prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, role: UserRole.TECHNICIAN },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        technicianSpecializations: {
          include: { specialization: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setSpecializations(companyId: string, technicianId: string, specializationIds: string[]) {
    const tech = await this.prisma.user.findFirst({
      where: { id: technicianId, companyId, role: UserRole.TECHNICIAN },
      select: { id: true },
    });
    if (!tech) throw new NotFoundException('Technician not found');

    const specs = await this.prisma.specialization.findMany({
      where: { companyId, id: { in: specializationIds } },
      select: { id: true },
    });
    if (specs.length !== specializationIds.length) {
      throw new BadRequestException('Some specializationIds are invalid');
    }

    await this.prisma.technicianSpecialization.deleteMany({
      where: { userId: technicianId },
    });

    if (specializationIds.length > 0) {
      await this.prisma.technicianSpecialization.createMany({
        data: specializationIds.map((sid) => ({ userId: technicianId, specializationId: sid })),
      });
    }

    return this.prisma.user.findUnique({
      where: { id: technicianId },
      select: {
        id: true,
        email: true,
        role: true,
        technicianSpecializations: { include: { specialization: true } },
      },
    });
  }
}
