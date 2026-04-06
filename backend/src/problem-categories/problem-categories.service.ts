import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';

@Injectable()
export class ProblemCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    const categories = await this.prisma.problemCategory.findMany({
      where: { companyId },
      include: {
        specializationLinks: {
          include: {
            specialization: true,
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const technicians = await this.prisma.user.findMany({
      where: {
        companyId,
        role: 'TECHNICIAN',
      },
      select: {
        id: true,
        email: true,
        technicianSpecializations: {
          include: {
            specialization: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return categories.map((category) => {
      const requiredSpecializationIds = category.specializationLinks.map((link) => link.specializationId);
      const fallbackMode = requiredSpecializationIds.length === 0;

      const coverageTechnicians = technicians
        .map((tech) => {
          const matchedSpecializations = fallbackMode
            ? []
            : tech.technicianSpecializations
                .filter((link) => requiredSpecializationIds.includes(link.specializationId))
                .map((link) => ({
                  id: link.specialization.id,
                  name: link.specialization.name,
                  isActive: link.specialization.isActive,
                }))
                .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

          return {
            id: tech.id,
            email: tech.email,
            matchedSpecializations,
          };
        })
        .filter((tech) => fallbackMode || tech.matchedSpecializations.length > 0);

      const coverageStatus = fallbackMode
        ? 'no_specializations'
        : coverageTechnicians.length === 0
          ? 'no_technicians'
          : 'covered';

      return {
        ...category,
        coverage: {
          status: coverageStatus,
          techniciansCount: coverageTechnicians.length,
          requiredSpecializationsCount: requiredSpecializationIds.length,
          fallbackMode,
          note: fallbackMode
            ? '????????????? ?? ??????. ??? ?????? ?????????? ? claim ????? ?????????????? ?????????? fallback ?? ???????? ????????.'
            : coverageTechnicians.length === 0
              ? '? ????????? ???? ?????????? ?? ??????????????, ?? ?????? ??? ?????????? ????????.'
              : '????????? ??????? ????????? ?? ??????????????.',
          technicians: coverageTechnicians,
        },
      };
    });
  }

  async create(companyId: string, dto: CreateProblemCategoryDto) {
    const name = (dto.name ?? '').trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }

    return this.prisma.problemCategory.create({
      data: {
        companyId,
        name,
        instructions: dto.instructions?.trim() || null,
        isActive: typeof dto.isActive === 'boolean' ? dto.isActive : true,
      },
      include: {
        specializationLinks: {
          include: {
            specialization: true,
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProblemCategoryDto) {
    const existing = await this.prisma.problemCategory.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Not found');
    }

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestException('name cannot be empty');
    }

    return this.prisma.problemCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        instructions: dto.instructions === undefined ? undefined : dto.instructions.trim() || null,
        isActive: typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
      },
      include: {
        specializationLinks: {
          include: {
            specialization: true,
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
      },
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return this.update(companyId, id, { isActive });
  }

  async setSpecializations(companyId: string, id: string, specializationIds: string[]) {
    const normalizedIds = [
      ...new Set(
        (specializationIds ?? [])
          .map((value) => (value ?? '').trim())
          .filter((value) => value.length > 0),
      ),
    ];

    const category = await this.prisma.problemCategory.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Not found');
    }

    const specs = await this.prisma.specialization.findMany({
      where: {
        companyId,
        id: { in: normalizedIds },
      },
      select: { id: true },
    });

    if (specs.length !== normalizedIds.length) {
      throw new BadRequestException('Some specializationIds are invalid');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.problemCategorySpecialization.deleteMany({
        where: {
          problemCategoryId: id,
        },
      });

      if (normalizedIds.length > 0) {
        await tx.problemCategorySpecialization.createMany({
          data: normalizedIds.map((specializationId) => ({
            problemCategoryId: id,
            specializationId,
          })),
        });
      }
    });

    return this.prisma.problemCategory.findFirst({
      where: { id, companyId },
      include: {
        specializationLinks: {
          include: {
            specialization: true,
          },
          orderBy: {
            specialization: {
              name: 'asc',
            },
          },
        },
      },
    });
  }
}
