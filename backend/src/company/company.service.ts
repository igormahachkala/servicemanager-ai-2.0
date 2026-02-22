import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async get(companyId: string) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, autoAssignEnabled: true },
    });
  }

  async setAutoAssign(companyId: string, enabled: boolean) {
    return this.prisma.company.update({
      where: { id: companyId },
      data: { autoAssignEnabled: enabled },
      select: { id: true, autoAssignEnabled: true },
    });
  }
}
