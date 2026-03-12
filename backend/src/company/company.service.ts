import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        autoAssignEnabled: true,
        timezone: true,
        allowTechnicianClaim: true,
        slaStrictMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(companyId: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.autoAssignEnabled !== undefined
          ? { autoAssignEnabled: dto.autoAssignEnabled }
          : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.allowTechnicianClaim !== undefined
          ? { allowTechnicianClaim: dto.allowTechnicianClaim }
          : {}),
        ...(dto.slaStrictMode !== undefined
          ? { slaStrictMode: dto.slaStrictMode }
          : {}),
      },
      select: {
        id: true,
        name: true,
        autoAssignEnabled: true,
        timezone: true,
        allowTechnicianClaim: true,
        slaStrictMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return company;
  }

  async setAutoAssign(companyId: string, enabled: boolean) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { autoAssignEnabled: enabled },
      select: {
        id: true,
        name: true,
        autoAssignEnabled: true,
        timezone: true,
        allowTechnicianClaim: true,
        slaStrictMode: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
