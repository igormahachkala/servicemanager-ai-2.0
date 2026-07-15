/**
 * Employee Connections Center — capability resolver (AI-COMPANY-115).
 */

import type { CostClassification } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import { getConnectionProvider, isProviderCapabilitySupported } from './connectionProviderCatalog'
import {
  findGrantForEmployeeConnection,
  getCompanyConnection,
  listEmployeeGrants,
  loadEmployeeConnectionsStore,
} from './employeeConnectionsStorage'
import type {
  ConnectionEnvironment,
  EmployeeConnectionReasonCode,
  ResolveEmployeeCapabilityInput,
  ResolveEmployeeCapabilityResult,
} from './employeeConnectionsTypes'

function mapCostModelToClassification(costModel: string): CostClassification {
  if (costModel === 'INCLUDED_IN_SUBSCRIPTION' || costModel === 'FREE') {
    return 'INCLUDED_IN_SUBSCRIPTION'
  }
  if (costModel === 'USAGE_BASED' || costModel === 'FIXED_SUBSCRIPTION') {
    return 'ADDITIONAL_COST_REQUIRED'
  }
  return 'UNKNOWN_COST'
}

function blocked(
  input: ResolveEmployeeCapabilityInput,
  reasonCode: EmployeeConnectionReasonCode,
  explanation: string,
  partial: Partial<ResolveEmployeeCapabilityResult> = {},
): ResolveEmployeeCapabilityResult {
  return {
    allowed: false,
    employeeId: input.employeeId,
    connectionId: partial.connectionId ?? null,
    providerId: partial.providerId ?? null,
    capabilityId: input.capabilityId,
    requiresOwnerApproval: partial.requiresOwnerApproval ?? false,
    costClassification: partial.costClassification ?? 'UNKNOWN_COST',
    reasonCode,
    explanation,
  }
}

function allowed(
  input: ResolveEmployeeCapabilityInput,
  connectionId: string,
  providerId: string,
  costClassification: CostClassification,
  requiresOwnerApproval: boolean,
): ResolveEmployeeCapabilityResult {
  return {
    allowed: true,
    employeeId: input.employeeId,
    connectionId,
    providerId,
    capabilityId: input.capabilityId,
    requiresOwnerApproval,
    costClassification,
    reasonCode: 'CONNECTION_AVAILABLE',
    explanation: 'Capability is granted and connection is healthy.',
  }
}

function isConnectionHealthy(status: string, health: string): boolean {
  if (status === 'DISABLED') return false
  if (status === 'AUTH_REQUIRED' || status === 'NOT_CONFIGURED') return false
  if (health === 'UNAVAILABLE') return false
  return status === 'CONNECTED' || status === 'CONFIGURED' || status === 'DEGRADED'
}

export function resolveEmployeeCapability(
  input: ResolveEmployeeCapabilityInput,
  store = loadEmployeeConnectionsStore(),
): ResolveEmployeeCapabilityResult {
  const grants = listEmployeeGrants(input.employeeId, store).filter((grant) => grant.enabled)

  for (const grant of grants) {
    if (!grant.capabilityIds.includes(input.capabilityId)) continue
    if (!grant.allowedEnvironments.includes(input.environment)) {
      return blocked(input, 'ENVIRONMENT_NOT_ALLOWED', 'Environment is not allowed for this grant.', {
        connectionId: grant.connectionId,
      })
    }

    const connection = getCompanyConnection(grant.connectionId, store)
    if (!connection) {
      return blocked(input, 'CONNECTION_NOT_FOUND', 'Connection referenced by grant was not found.')
    }

    const provider = getConnectionProvider(connection.providerId)
    if (!provider) {
      return blocked(input, 'CONNECTION_NOT_FOUND', 'Provider definition missing.', {
        connectionId: connection.id,
        providerId: connection.providerId,
      })
    }

    if (!isProviderCapabilitySupported(connection.providerId, input.capabilityId)) {
      return blocked(input, 'CAPABILITY_NOT_GRANTED', 'Capability is not supported by provider.', {
        connectionId: connection.id,
        providerId: connection.providerId,
      })
    }

    if (connection.status === 'DISABLED') {
      return blocked(input, 'CONNECTION_DISABLED', 'Connection is disabled.', {
        connectionId: connection.id,
        providerId: connection.providerId,
      })
    }

    if (connection.status === 'AUTH_REQUIRED' || connection.status === 'NOT_CONFIGURED') {
      return blocked(input, 'AUTH_REQUIRED', 'Connection requires authentication.', {
        connectionId: connection.id,
        providerId: connection.providerId,
      })
    }

    if (!connection.secretRef && connection.authMethod !== 'LOCAL_RUNTIME' && connection.authMethod !== 'LOCAL_SESSION' && connection.authMethod !== 'NONE') {
      return blocked(input, 'SECRET_UNAVAILABLE', 'Connection secret is unavailable.', {
        connectionId: connection.id,
        providerId: connection.providerId,
      })
    }

    if (!isConnectionHealthy(connection.status, connection.health)) {
      return blocked(input, 'CONNECTION_UNHEALTHY', 'Connection health check failed.', {
        connectionId: connection.id,
        providerId: connection.providerId,
      })
    }

    const costClassification = connection.costClassification ?? mapCostModelToClassification(provider.costModel)

    if (costClassification === 'UNKNOWN_COST') {
      return blocked(input, 'COST_UNKNOWN', 'Cost classification is unknown.', {
        connectionId: connection.id,
        providerId: connection.providerId,
        costClassification,
      })
    }

    if (costClassification === 'BLOCKED_BY_COST_POLICY') {
      return blocked(input, 'BLOCKED_BY_COST_POLICY', 'Blocked by cost policy.', {
        connectionId: connection.id,
        providerId: connection.providerId,
        costClassification,
      })
    }

    if (
      costClassification === 'ADDITIONAL_COST_REQUIRED' ||
      grant.spendingPolicy === 'OWNER_APPROVAL_REQUIRED' ||
      grant.requiresOwnerApproval
    ) {
      if (!input.ownerApproved) {
        return blocked(input, 'OWNER_APPROVAL_REQUIRED', 'Owner approval is required.', {
          connectionId: connection.id,
          providerId: connection.providerId,
          costClassification,
          requiresOwnerApproval: true,
        })
      }
    }

    if (grant.spendingPolicy === 'BLOCK_ALL_PAID_USAGE' && costClassification === 'ADDITIONAL_COST_REQUIRED') {
      return blocked(input, 'BLOCKED_BY_COST_POLICY', 'Paid usage blocked by spending policy.', {
        connectionId: connection.id,
        providerId: connection.providerId,
        costClassification,
      })
    }

    if (input.estimatedCostClassification === 'UNKNOWN_COST') {
      return blocked(input, 'COST_UNKNOWN', 'Estimated cost is unknown.', {
        connectionId: connection.id,
        providerId: connection.providerId,
        costClassification,
      })
    }

    return allowed(
      input,
      connection.id,
      connection.providerId,
      costClassification,
      grant.requiresOwnerApproval || grant.spendingPolicy === 'OWNER_APPROVAL_REQUIRED',
    )
  }

  const hasAnyGrant = grants.length > 0
  if (!hasAnyGrant) {
    return blocked(input, 'EMPLOYEE_GRANT_NOT_FOUND', 'No connection grant found for employee.')
  }

  return blocked(input, 'CAPABILITY_NOT_GRANTED', 'Requested capability is not granted.')
}

export function findConnectionGrantForCapability(
  employeeId: string,
  capabilityId: string,
  environment: ConnectionEnvironment,
  store = loadEmployeeConnectionsStore(),
): { grant: ReturnType<typeof findGrantForEmployeeConnection>; connection: ReturnType<typeof getCompanyConnection> } {
  const grants = listEmployeeGrants(employeeId, store).filter(
    (grant) => grant.enabled && grant.capabilityIds.includes(capabilityId) && grant.allowedEnvironments.includes(environment),
  )
  for (const grant of grants) {
    const connection = getCompanyConnection(grant.connectionId, store)
    if (connection) return { grant, connection }
  }
  return { grant: null, connection: null }
}
