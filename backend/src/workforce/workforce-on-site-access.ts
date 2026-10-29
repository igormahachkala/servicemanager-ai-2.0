import { ForbiddenException } from '@nestjs/common'
import { CompanyType, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'

const STAFF_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.MASTER, UserRole.DISPATCHER])

export type OnSiteActor = {
  id: string
  companyId: string
  role: UserRole
}

export async function requireProviderStaff(
  prisma: PrismaService,
  actor: OnSiteActor,
): Promise<{ timezone: string | null }> {
  if (!actor?.id || !actor.companyId || !STAFF_ROLES.has(actor.role)) {
    throw new ForbiddenException('Недостаточно прав')
  }

  const company = await prisma.company.findUnique({
    where: { id: actor.companyId },
    select: { type: true, timezone: true },
  })
  if (!company || company.type !== CompanyType.PROVIDER) {
    throw new ForbiddenException('Недостаточно прав')
  }

  return { timezone: company.timezone }
}
