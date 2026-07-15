import { UserAccessLocationMode } from '@prisma/client'

export type ConstructorLocationMode = 'LEGACY_AUTO' | 'SELECTED_LOCATIONS' | 'RESTRICTED_EMPTY'
export type RuntimeLocationScopeMode = 'tenant_wide' | 'bound_locations' | 'restricted_empty'

export const RESTRICTED_EMPTY_LOCATION_SENTINEL = '__restricted_empty_location_scope__'

export type InterpretedLocationScope = {
  locationMode: ConstructorLocationMode
  runtimeMode: RuntimeLocationScopeMode
  locationIds: string[]
}

export function uniqueLocationIds(locationIds: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      locationIds
        .map((locationId) => (typeof locationId === 'string' ? locationId.trim() : ''))
        .filter((locationId) => locationId.length > 0),
    ),
  )
}

export function resolveConstructorLocationMode(params: {
  explicitLocationMode?: UserAccessLocationMode | null
  effectiveLocationCount: number
  staleLocationCount?: number
}): ConstructorLocationMode {
  if (params.explicitLocationMode === UserAccessLocationMode.RESTRICTED_EMPTY) return 'RESTRICTED_EMPTY'
  if (params.explicitLocationMode === UserAccessLocationMode.SELECTED_LOCATIONS) return 'SELECTED_LOCATIONS'
  if (params.effectiveLocationCount > 0 || (params.staleLocationCount ?? 0) > 0) return 'SELECTED_LOCATIONS'
  return 'LEGACY_AUTO'
}

export function interpretUserAccessLocationScope(params: {
  explicitLocationMode?: UserAccessLocationMode | null
  locationIds?: Array<string | null | undefined>
  hasAnyLegacyBinding?: boolean
}): InterpretedLocationScope {
  const locationIds = uniqueLocationIds(params.locationIds ?? [])

  if (params.explicitLocationMode === UserAccessLocationMode.RESTRICTED_EMPTY) {
    return { locationMode: 'RESTRICTED_EMPTY', runtimeMode: 'restricted_empty', locationIds: [] }
  }

  if (params.explicitLocationMode === UserAccessLocationMode.SELECTED_LOCATIONS) {
    return { locationMode: 'SELECTED_LOCATIONS', runtimeMode: 'bound_locations', locationIds }
  }

  if (locationIds.length > 0 || params.hasAnyLegacyBinding) {
    return { locationMode: 'SELECTED_LOCATIONS', runtimeMode: 'bound_locations', locationIds }
  }

  return { locationMode: 'LEGACY_AUTO', runtimeMode: 'tenant_wide', locationIds: [] }
}

export function isFailClosedLocationScope(params: {
  locationMode: ConstructorLocationMode
  locationIds?: Array<string | null | undefined>
}) {
  const locationIds = uniqueLocationIds(params.locationIds ?? [])
  return params.locationMode === 'RESTRICTED_EMPTY' || (params.locationMode === 'SELECTED_LOCATIONS' && locationIds.length === 0)
}
