import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemCategoryDto } from './dto/create-problem-category.dto';
import { UpdateProblemCategoryDto } from './dto/update-problem-category.dto';

@Injectable()
export class ProblemCategoriesService {
  constructor(private prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.problemCategory.findMany({
      where: { companyId },
      include: {
        specializationLinks: {
          include: { specialization: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, dto: CreateProblemCategoryDto) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required');
    return this.prisma.problemCategory.create({
      data: {
        companyId,
        name: dto.name.trim(),
        instructions: dto.instructions?.trim() || null,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProblemCategoryDto) {
    const existing = await this.prisma.problemCategory.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Not found');

    return this.prisma.problemCategory.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        instructions: dto.instructions === undefined ? undefined : (dto.instructions?.trim() || null),
        isActive: typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
      },
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return this.update(companyId, id, { isActive });
  }

  async setSpecializations(companyId: string, id: string, specializationIds: string[]) {
    const category = await this.prisma.problemCategory.findFirst({ where: { id, companyId } });
    if (!category) throw new NotFoundException('Not found');

    // валидируем что специализации принадлежат компании
    const specs = await this.prisma.specialization.findMany({
      where: { companyId, id: { in: specializationIds } },
      select: { id: true },
    });
    if (specs.length !== specializationIds.length) {
      throw new BadRequestException('Some specializationIds are invalid');
    }

    await this.prisma.problemCategorySpecialization.deleteMany({
      where: { problemCategoryId: id },
    });

    await this.prisma.problemCategorySpecialization.createMany({
      data: specializationIds.map((sid) => ({ problemCategoryId: id, specializationId: sid })),
    });

    return this.prisma.problemCategory.findUnique({
      where: { id },
      include: { specializationLinks: { include: { specialization: true } } },
    });
  }
}
