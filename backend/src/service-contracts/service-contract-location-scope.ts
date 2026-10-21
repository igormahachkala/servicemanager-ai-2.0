import { ServiceContractLocationMode } from '@prisma/client'

export type ServiceContractLocationRow = {
  locationId: string
}

export type ResolvedServiceContractLocationScope =
  | { mode: 'tenant_wide'; locationIds: string[] }
  | { mode: 'bound_locations'; locationIds: string[] }
  | { mode: 'restricted_empty'; locationIds: string[] }

export type ServiceContractLocationScopeCarrier = {
  locationMode?: ServiceContractLocationMode | null
  locations?: ServiceContractLocationRow[] | null
  effectiveLocationScope?: ResolvedServiceContractLocationScope | null
}

export function uniqueServiceContractLocationIds(values?: Array<string | null | undefined> | null) {
  return Array.from(new Set((values ?? []).map((value) => value?.trim()).filter((value): value is string => !!value)))
}

export function serviceContractLocationModeOrDefault(
  mode?: ServiceContractLocationMode | null,
): ServiceContractLocationMode {
  return mode ?? ServiceContractLocationMode.ALL_LOCATIONS
}

export function resolveServiceContractLocationScope(params: {
  locationMode?: ServiceContractLocationMode | null
  locationIds?: string[] | null
  inheritedLocationIds?: string[] | null
  hasPrimarySource?: boolean
}): ResolvedServiceContractLocationScope {
  const locationIds = uniqueServiceContractLocationIds(params.locationIds)
  const locationMode =
    params.locationMode ??
    (locationIds.length > 0
      ? ServiceContractLocationMode.SELECTED_LOCATIONS
      : ServiceContractLocationMode.ALL_LOCATIONS)

  if (locationMode === ServiceContractLocationMode.ALL_LOCATIONS) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  if (locationMode === ServiceContractLocationMode.SELECTED_LOCATIONS) {
    if (locationIds.length === 0) return { mode: 'restricted_empty', locationIds: [] }
    return { mode: 'bound_locations', locationIds }
  }

  if (params.hasPrimarySource === false) {
    return { mode: 'restricted_empty', locationIds: [] }
  }

  if (params.inheritedLocationIds === null) {
    return { mode: 'tenant_wide', locationIds: [] }
  }

  const inheritedIds = uniqueServiceContractLocationIds(params.inheritedLocationIds)
  if (inheritedIds.length === 0) return { mode: 'restricted_empty', locationIds: [] }
  return { mode: 'bound_locations', locationIds: inheritedIds }
}

export function serviceContractLocationRowsFromScope(
  scope: ResolvedServiceContractLocationScope,
): ServiceContractLocationRow[] {
  if (scope.mode === 'tenant_wide') return []
  return scope.locationIds.map((locationId) => ({ locationId }))
}

export function isServiceContractLocationScopeClosed(scope: ResolvedServiceContractLocationScope) {
  return scope.mode === 'restricted_empty' ||
    (scope.mode === 'bound_locations' && scope.locationIds.length === 0)
}

export function isServiceContractLocationAllowed(
  access: ServiceContractLocationScopeCarrier | null | undefined,
  locationId: string | null | undefined,
) {
  if (!access) return false
  const scope = access.effectiveLocationScope ?? resolveServiceContractLocationScope({
    locationMode: access.locationMode,
    locationIds: access.locations?.map((row) => row.locationId) ?? [],
  })
  if (scope.mode === 'tenant_wide') return true
  if (isServiceContractLocationScopeClosed(scope)) return false
  return !!locationId && scope.locationIds.includes(locationId)
}
