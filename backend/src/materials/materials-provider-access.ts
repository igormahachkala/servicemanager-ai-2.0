import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { CompanyType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaterialsProviderAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const actor = request.user as { companyId?: string } | undefined;

    if (!actor?.companyId) {
      throw this.denied();
    }

    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { type: true },
    });

    if (company?.type !== CompanyType.PROVIDER) {
      throw this.denied();
    }

    return true;
  }

  private denied() {
    return new ForbiddenException({
      code: 'MATERIALS_PROVIDER_ACCESS_DENIED',
      message: 'Материалы доступны только в контуре обслуживающей компании.',
    });
  }
}

export const MaterialsProviderAccess = () =>
  UseGuards(MaterialsProviderAccessGuard);
