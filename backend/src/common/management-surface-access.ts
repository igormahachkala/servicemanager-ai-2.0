import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UseGuards } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

export function canAccessManagementSurface(input: {
  role?: UserRole | string | null
  companyType?: CompanyType | string | null
}): boolean {
  if (input.role === UserRole.PLATFORM_ADMIN) return true

  if (input.companyType === CompanyType.CLIENT) {
    return input.role === UserRole.ADMIN || input.role === UserRole.CLIENT_ADMIN
  }

  if (input.companyType === CompanyType.PROVIDER) {
    return (
      input.role === UserRole.ADMIN ||
      input.role === UserRole.DISPATCHER ||
      input.role === UserRole.MASTER
    )
  }

  return false
}

@Injectable()
export class ManagementSurfaceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const actor = request.user as
      | { role?: UserRole | string; companyId?: string }
      | undefined

    if (actor?.role === UserRole.PLATFORM_ADMIN) return true

    if (!actor?.role || !actor.companyId) {
      throw this.denied()
    }

    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { type: true },
    })

    if (!company || !canAccessManagementSurface({ role: actor.role, companyType: company.type })) {
      throw this.denied()
    }

    return true
  }

  private denied() {
    return new ForbiddenException({
      code: 'MANAGEMENT_SURFACE_ACCESS_DENIED',
      message: 'Управленческая часть недоступна для вашей роли.',
    })
  }
}

export const ManagementSurface = () => UseGuards(ManagementSurfaceGuard)
