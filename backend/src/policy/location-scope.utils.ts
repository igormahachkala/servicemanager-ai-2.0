import { PrismaService } from '../prisma/prisma.service'
import { UserRole } from '@prisma/client'

export type UserLocationScope = {
  enabled: boolean
  allowAll: boolean
  locationIds: string[]
}

const LOCATION_SCOPED_ROLES = new Set<UserRole>([
  UserRole.CLIENT,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
])

export async function resolveUserLocationScope(params: {
  prisma: PrismaService
  actorCompanyId: string
  userId: string
  role: UserRole
  scopeCompanyId?: string
}): Promise<UserLocationScope> {
  const { prisma, actorCompanyId, userId, role, scopeCompanyId } = params

  if (!LOCATION_SCOPED_ROLES.has(role)) {
    return { enabled: false, allowAll: true, locationIds: [] }
  }

  if (scopeCompanyId && scopeCompanyId !== actorCompanyId) {
    return { enabled: false, allowAll: true, locationIds: [] }
  }

  const bindings = await prisma.technicianClientBinding.findMany({
    where: {
      providerCompanyId: actorCompanyId,
      clientCompanyId: actorCompanyId,
      technicianUserId: userId,
    },
    select: {
      locationId: true,
    },
  })

  if (bindings.length === 0) {
    return { enabled: true, allowAll: false, locationIds: [] }
  }

  const hasAllLocationsBinding = bindings.some((binding) => !binding.locationId)
  if (hasAllLocationsBinding) {
    return { enabled: true, allowAll: true, locationIds: [] }
  }

  const locationIds = Array.from(new Set(bindings.map((binding) => binding.locationId).filter(Boolean))) as string[]
  return { enabled: true, allowAll: false, locationIds }
}

export function applyLocationScopeToWhere(
  where: any,
  locationScope: UserLocationScope,
  fieldName: string = 'locationId',
) {
  if (!locationScope.enabled || locationScope.allowAll) return where
  if (locationScope.locationIds.length === 0) {
    return {
      ...where,
      AND: [...(Array.isArray(where?.AND) ? where.AND : where?.AND ? [where.AND] : []), { [fieldName]: { in: [] } }],
    }
  }

  return {
    ...where,
    AND: [...(Array.isArray(where?.AND) ? where.AND : where?.AND ? [where.AND] : []), { [fieldName]: { in: locationScope.locationIds } }],
  }
}

export function isLocationAllowedByScope(locationScope: UserLocationScope, locationId?: string | null) {
  if (!locationScope.enabled || locationScope.allowAll) return true
  if (!locationId) return false
  return locationScope.locationIds.includes(locationId)
}
