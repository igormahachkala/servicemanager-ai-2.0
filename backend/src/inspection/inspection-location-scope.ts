import { NotFoundException } from '@nestjs/common'
import { ServiceContractRole } from '@prisma/client'

import {
  isServiceContractLocationAllowed,
  type ServiceContractLocationScopeCarrier,
} from '../service-contracts/service-contract-location-scope'

/**
 * SMA-ROUNDS-V1-PROVIDER-LOCATION-SCOPE-097.
 *
 * Rounds/Inspections were written for the client-owned case: every lookup filtered by
 * `user.companyId`, and the location lookup additionally assumed `Location.clientCompanyId`
 * equals the actor's company. That model cannot express the central ServiceManager case,
 * where a PROVIDER company services a CLIENT company's locations.
 *
 * This file deliberately contains NO access rules of its own. It composes the two canonical
 * primitives that already decide provider→client access for tickets, analytics, equipment,
 * locations, technicians and problem categories:
 *
 *   ServiceContractsService.getLinkedClientAccess  — is there an effective contract between
 *     this provider and this client right now (status ACTIVE, inside startsAt/endsAt), what
 *     role does the provider hold in it, and what is its resolved location scope? Returns a
 *     tenant-wide self-access record when provider and client are the same company, which is
 *     what keeps existing client-owned Inspection behaviour byte-for-byte unchanged.
 *
 *   isServiceContractLocationAllowed — does that contract's location scope cover this concrete
 *     location? Handles ALL_LOCATIONS (tenant_wide), SELECTED_LOCATIONS (bound_locations) and
 *     INHERIT_PRIMARY (already resolved upstream), plus the closed/empty restricted case.
 *
 * Adding a second Inspection-specific access resolver here would create the parallel access
 * architecture the task forbids. Calling a Ticket resolver would drag ticket lifecycle and
 * assignment semantics into Rounds. Composing the contract-level primitives does neither.
 */

/**
 * The slice of ServiceContractsService this module needs. Declared structurally so that the
 * scope helpers stay unit-testable without a Nest container, and so Inspection does not depend
 * on the full contracts service surface.
 */
export type InspectionLocationScopeContracts = {
  getLinkedClientAccess(
    providerCompanyId: string,
    clientCompanyId: string,
  ): Promise<(ServiceContractLocationScopeCarrier & { role?: ServiceContractRole | null }) | null>
}

export type InspectionLocationRef = {
  id: string
  clientCompanyId: string
}

export type InspectionLocationContext = {
  locationId: string
  /** Company that owns the physical site. For provider execution this is NOT the actor's company. */
  clientCompanyId: string
  /** True when the actor's company owns the location — the pre-097 single-tenant path. */
  isOwnCompanyLocation: boolean
  /** Provider's role in the contract that authorised this location. PRIMARY for self-access. */
  contractRole: ServiceContractRole
}

function normalizeId(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

/**
 * Resolves the provider/client context for one concrete location, or null when canonical
 * ServiceManager access does not permit the actor to work at it. Fails closed: any missing
 * input, absent contract, expired contract or out-of-scope location yields null.
 */
export async function resolveInspectionLocationAccess(params: {
  serviceContracts: InspectionLocationScopeContracts
  actorCompanyId: string
  location: InspectionLocationRef | null | undefined
}): Promise<InspectionLocationContext | null> {
  const actorCompanyId = normalizeId(params.actorCompanyId)
  const locationId = normalizeId(params.location?.id)
  const clientCompanyId = normalizeId(params.location?.clientCompanyId)

  if (!actorCompanyId || !locationId || !clientCompanyId) return null

  const access = await params.serviceContracts.getLinkedClientAccess(actorCompanyId, clientCompanyId)
  if (!access) return null

  if (!isServiceContractLocationAllowed(access, locationId)) return null

  return {
    locationId,
    clientCompanyId,
    isOwnCompanyLocation: clientCompanyId === actorCompanyId,
    contractRole: access.role ?? ServiceContractRole.PRIMARY,
  }
}

/**
 * Same as resolveInspectionLocationAccess, but throws instead of returning null.
 *
 * The message is caller-supplied so each Inspection path keeps the exact wording it used before
 * 097 ("Location not found" when resolving a target location, "Inspection run not found" when
 * re-validating an existing run). Denials stay indistinguishable from "does not exist", which is
 * the behaviour the pre-097 tenant filters already had.
 */
export async function assertInspectionLocationAccess(params: {
  serviceContracts: InspectionLocationScopeContracts
  actorCompanyId: string
  location: InspectionLocationRef | null | undefined
  notFoundMessage: string
}): Promise<InspectionLocationContext> {
  const context = await resolveInspectionLocationAccess(params)
  if (!context) throw new NotFoundException(params.notFoundMessage)
  return context
}
