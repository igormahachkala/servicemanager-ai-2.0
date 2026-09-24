import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { resolveObserverScopeCompanyId } from '../policy/policy.utils';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import {
  isProblemCategoryAllowedBySpecializationScope,
  resolveActorSpecializationScope,
} from '../tickets/ticket-access.utils';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';

@Injectable()
export class ProblemCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  async list(actorCompanyId: string, actorRole: UserRole, actorUserId?: string, requestedCompanyId?: string) {
    let companyId = actorCompanyId;
    const requested = (requestedCompanyId || '').trim();
    if (requested && requested !== actorCompanyId) {
      const observerCompanyId = resolveObserverScopeCompanyId({
        actorCompanyId,
        actorRole,
        requestedCompanyId: requested,
      });
      if (observerCompanyId !== actorCompanyId) {
        companyId = observerCompanyId;
      } else {
        if ((this.serviceContractsService as any).getLinkedClientAccess) {
          const linkedAccess = await this.serviceContractsService.getLinkedClientAccess(actorCompanyId, requested);
          if (!linkedAccess) {
            throw new NotFoundException('Linked client not found');
          }
        } else {
          await this.serviceContractsService.assertPrimaryLinkedClientAccess(actorCompanyId, requested);
        }
        companyId = requested;
      }
    }

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

    const specializationScope = actorUserId && actorRole
      ? await resolveActorSpecializationScope({
          prisma: this.prisma,
          actor: {
            id: actorUserId,
            role: actorRole,
            companyId: actorCompanyId,
          },
        })
      : { mode: 'all_in_contract' as const, specializationIds: [], specializationNames: [] }

    return categories.filter((category) =>
      isProblemCategoryAllowedBySpecializationScope(category, specializationScope),
    ).map((category) => {
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
            ? 'Специализации не заданы. Для таких категорий в claim допускается fallback по отсутствию специализаций.'
            : coverageTechnicians.length === 0
              ? 'В компании есть специализации, но нет техников с нужными навыками.'
              : 'Категория покрыта техниками по специализациям.',
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

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.problemCategory.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Not found');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.problemCategorySpecialization.deleteMany({
          where: {
            problemCategoryId: id,
          },
        });

        await tx.problemCategory.delete({
          where: { id },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('????????? ?????? ???????: ??? ???????????? ? ???????');
      }
      throw error;
    }

    return { ok: true, id };
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
        isActive: true,
        id: { in: normalizedIds },
      },
      select: { id: true },
    });

    const found = new Set(specs.map((s) => s.id));
    const invalid = normalizedIds.filter((id) => !found.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Some specializationIds are invalid (inactive, wrong tenant, or unknown): ${invalid.join(', ')}`,
      );
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
