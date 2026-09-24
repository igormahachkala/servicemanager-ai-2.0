import { ConflictException, ForbiddenException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type { AllowDecision, PolicyDecision } from './policy.types'

export function assertAllowed<T>(d: PolicyDecision<T>): asserts d is AllowDecision<T> {
  if (d.allowed) return

  if (d.denyCode === 'precondition') {
    throw new ConflictException(d.reason)
  }

  throw new ForbiddenException(d.reason)
}

export function resolveObserverScopeCompanyId(params: {
  actorCompanyId: string
  actorRole: UserRole
  requestedCompanyId?: string | null
}) {
  const requestedCompanyId = params.requestedCompanyId?.trim()
  if (params.actorRole === UserRole.PLATFORM_ADMIN && requestedCompanyId) {
    return requestedCompanyId
  }

  return params.actorCompanyId
}

export function isPlatformObserverScope(params: {
  actorCompanyId: string
  actorRole: UserRole
  scopeCompanyId: string
}) {
  return params.actorRole === UserRole.PLATFORM_ADMIN && params.scopeCompanyId !== params.actorCompanyId
}