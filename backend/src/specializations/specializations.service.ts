import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpecializationDto } from './dto/create-specialization.dto';
import { UpdateSpecializationDto } from './dto/update-specialization.dto';

@Injectable()
export class SpecializationsService {
  constructor(private prisma: PrismaService) {}

  list(companyId: string) {
    return this.prisma.specialization.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, dto: CreateSpecializationDto) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required');
    return this.prisma.specialization.create({
      data: { companyId, name: dto.name.trim() },
    });
  }

  async update(companyId: string, id: string, dto: UpdateSpecializationDto) {
    const existing = await this.prisma.specialization.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException('Not found');

    return this.prisma.specialization.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        isActive: typeof dto.isActive === 'boolean' ? dto.isActive : undefined,
      },
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return this.update(companyId, id, { isActive });
  }
}
