/**
 * Employee Connections Center — service layer (AI-COMPANY-115).
 */

import { OWNER_ID } from '../organization/organizationStorage'
import { getConnectionProvider, getDefaultCapabilitiesForEmployee } from './connectionProviderCatalog'
import { createConnectionSecretStoreClient } from './connectionSecretStoreClient'
import { testConnectionViaBridge } from './connectionSecretStoreClient'
import { maskSecretValue, sanitizeConnectionConfiguration } from './employeeConnectionsSecretRedaction'
import {
  appendAuditEvent,
  getCompanyConnection,
  loadEmployeeConnectionsStore,
  removeCompanyConnection,
  removeEmployeeGrant,
  saveEmployeeConnectionsStore,
  upsertCompanyConnection,
  upsertEmployeeGrant,
} from './employeeConnectionsStorage'
import type {
  CompanyConnection,
  ConnectionAuthMethod,
  ConnectionEnvironment,
  ConnectionHealth,
  ConnectionSecretPayload,
  ConnectionSpendingPolicy,
  ConnectionStatus,
  ConnectionTestResult,
  EmployeeConnectionGrant,
  EmployeeConnectionsStore,
} from './employeeConnectionsTypes'

const secretStore = createConnectionSecretStoreClient()

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function initialStatus(providerImplemented: boolean, hasSecret: boolean, authMethod: ConnectionAuthMethod): ConnectionStatus {
  if (!providerImplemented) return 'AUTH_REQUIRED'
  if (authMethod === 'LOCAL_RUNTIME' || authMethod === 'LOCAL_SESSION' || authMethod === 'NONE') {
    return 'CONFIGURED'
  }
  return hasSecret ? 'CONFIGURED' : 'NOT_CONFIGURED'
}

export type CreateCompanyConnectionInput = {
  providerId: string
  displayName: string
  authMethod: ConnectionAuthMethod
  environment: ConnectionEnvironment
  configuration: Record<string, unknown>
  costClassification?: CompanyConnection['costClassification']
  createdBy?: string
  secret?: ConnectionSecretPayload | null
}

export type GrantConnectionToEmployeeInput = {
  employeeId: string
  connectionId: string
  capabilityIds: string[]
  permissionLevel?: EmployeeConnectionGrant['permissionLevel']
  requiresOwnerApproval?: boolean
  allowedEnvironments?: ConnectionEnvironment[]
  spendingPolicy?: ConnectionSpendingPolicy
  actorId?: string
}

export async function createCompanyConnection(
  input: CreateCompanyConnectionInput,
): Promise<{ ok: true; connection: CompanyConnection } | { ok: false; message: string }> {
  const provider = getConnectionProvider(input.providerId)
  if (!provider) return { ok: false, message: 'Provider not found.' }
  if (!provider.authMethods.includes(input.authMethod)) {
    return { ok: false, message: 'Auth method is not supported by provider.' }
  }

  const connectionId = createId('conn')
  let secretRef: string | null = null
  let secretMask: string | null = null
  let hasSecret = false

  if (input.secret?.value) {
    hasSecret = await secretStore.setSecret(connectionId, input.secret)
    if (!hasSecret) {
      return { ok: false, message: 'Could not store secret in trusted runtime. Start connections bridge.' }
    }
    secretRef = connectionId
    secretMask = maskSecretValue(input.secret.value)
  }

  const connection: CompanyConnection = {
    id: connectionId,
    providerId: input.providerId,
    displayName: input.displayName.trim(),
    status: initialStatus(provider.implemented, hasSecret, input.authMethod),
    authMethod: input.authMethod,
    environment: input.environment,
    configuration: sanitizeConnectionConfiguration(input.configuration),
    secretRef,
    secretMask,
    health: 'UNKNOWN',
    costClassification: input.costClassification ?? 'INCLUDED_IN_SUBSCRIPTION',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastCheckedAt: null,
    lastUsedAt: null,
    createdBy: input.createdBy ?? OWNER_ID,
  }

  let store = loadEmployeeConnectionsStore()
  store = upsertCompanyConnection(connection, store)
  store = appendAuditEvent(store, {
    type: 'connection_created',
    actorId: input.createdBy ?? OWNER_ID,
    employeeId: null,
    connectionId: connection.id,
    providerId: connection.providerId,
    capabilityIds: [],
    environment: connection.environment,
    reasonCode: null,
    metadata: { authMethod: connection.authMethod },
  })
  if (hasSecret) {
    store = appendAuditEvent(store, {
      type: 'connection_secret_created',
      actorId: input.createdBy ?? OWNER_ID,
      employeeId: null,
      connectionId: connection.id,
      providerId: connection.providerId,
      capabilityIds: [],
      environment: connection.environment,
      reasonCode: null,
    })
  }
  saveEmployeeConnectionsStore(store)

  return { ok: true, connection }
}

export async function rotateCompanyConnectionSecret(
  connectionId: string,
  secret: ConnectionSecretPayload,
  actorId = OWNER_ID,
): Promise<CompanyConnection | null> {
  const store = loadEmployeeConnectionsStore()
  const existing = getCompanyConnection(connectionId, store)
  if (!existing) return null

  const ok = await secretStore.rotateSecret(connectionId, secret)
  if (!ok) return null

  const updated: CompanyConnection = {
    ...existing,
    secretRef: connectionId,
    secretMask: maskSecretValue(secret.value),
    status: existing.status === 'NOT_CONFIGURED' ? 'CONFIGURED' : existing.status,
    updatedAt: nowIso(),
  }

  let next = upsertCompanyConnection(updated, store)
  next = appendAuditEvent(next, {
    type: 'connection_secret_rotated',
    actorId,
    employeeId: null,
    connectionId,
    providerId: existing.providerId,
    capabilityIds: [],
    environment: existing.environment,
    reasonCode: null,
  })
  saveEmployeeConnectionsStore(next)
  return updated
}

export function grantConnectionToEmployee(
  input: GrantConnectionToEmployeeInput,
): { ok: true; grant: EmployeeConnectionGrant } | { ok: false; message: string } {
  const store = loadEmployeeConnectionsStore()
  const connection = getCompanyConnection(input.connectionId, store)
  if (!connection) return { ok: false, message: 'Connection not found.' }

  const existing = store.grants.find(
    (grant) => grant.employeeId === input.employeeId && grant.connectionId === input.connectionId,
  )

  const grant: EmployeeConnectionGrant = existing
    ? {
        ...existing,
        capabilityIds: input.capabilityIds,
        permissionLevel: input.permissionLevel ?? existing.permissionLevel,
        requiresOwnerApproval: input.requiresOwnerApproval ?? existing.requiresOwnerApproval,
        allowedEnvironments: input.allowedEnvironments ?? existing.allowedEnvironments,
        spendingPolicy: input.spendingPolicy ?? existing.spendingPolicy,
        enabled: true,
        updatedAt: nowIso(),
      }
    : {
        id: createId('grant'),
        employeeId: input.employeeId,
        connectionId: input.connectionId,
        capabilityIds: input.capabilityIds,
        permissionLevel: input.permissionLevel ?? 'READ_WRITE',
        requiresOwnerApproval: input.requiresOwnerApproval ?? false,
        allowedEnvironments: input.allowedEnvironments ?? [connection.environment],
        spendingPolicy: input.spendingPolicy ?? 'INCLUDED_ONLY',
        enabled: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }

  let next = upsertEmployeeGrant(grant, store)
  next = appendAuditEvent(next, {
    type: existing ? 'connection_updated' : 'employee_connection_granted',
    actorId: input.actorId ?? OWNER_ID,
    employeeId: input.employeeId,
    connectionId: input.connectionId,
    providerId: connection.providerId,
    capabilityIds: input.capabilityIds,
    environment: connection.environment,
    reasonCode: null,
  })
  saveEmployeeConnectionsStore(next)
  return { ok: true, grant }
}

export function revokeEmployeeConnectionGrant(
  grantId: string,
  actorId = OWNER_ID,
): EmployeeConnectionGrant | null {
  const store = loadEmployeeConnectionsStore()
  const grant = store.grants.find((item) => item.id === grantId)
  if (!grant) return null

  const next = appendAuditEvent(removeEmployeeGrant(grantId, store), {
    type: 'employee_connection_revoked',
    actorId,
    employeeId: grant.employeeId,
    connectionId: grant.connectionId,
    providerId: getCompanyConnection(grant.connectionId, store)?.providerId ?? null,
    capabilityIds: grant.capabilityIds,
    environment: null,
    reasonCode: null,
  })
  saveEmployeeConnectionsStore(next)
  return grant
}

export async function deleteCompanyConnection(
  connectionId: string,
  actorId = OWNER_ID,
): Promise<boolean> {
  const store = loadEmployeeConnectionsStore()
  const connection = getCompanyConnection(connectionId, store)
  if (!connection) return false

  await secretStore.deleteSecret(connectionId)
  let next = removeCompanyConnection(connectionId, store)
  next = appendAuditEvent(next, {
    type: 'connection_deleted',
    actorId,
    employeeId: null,
    connectionId,
    providerId: connection.providerId,
    capabilityIds: [],
    environment: connection.environment,
    reasonCode: null,
  })
  next = appendAuditEvent(next, {
    type: 'connection_secret_deleted',
    actorId,
    employeeId: null,
    connectionId,
    providerId: connection.providerId,
    capabilityIds: [],
    environment: connection.environment,
    reasonCode: null,
  })
  saveEmployeeConnectionsStore(next)
  return true
}

export async function testCompanyConnection(connectionId: string): Promise<ConnectionTestResult | null> {
  const store = loadEmployeeConnectionsStore()
  const connection = getCompanyConnection(connectionId, store)
  if (!connection) return null

  const provider = getConnectionProvider(connection.providerId)
  if (!provider?.implemented) {
    return {
      success: false,
      status: 'AUTH_REQUIRED',
      health: 'UNAVAILABLE',
      checkedAt: nowIso(),
      latencyMs: null,
      reasonCode: 'PROVIDER_NOT_IMPLEMENTED',
      message: 'Provider adapter is not implemented in V1.',
      availableCapabilities: [],
    }
  }

  const result = await testConnectionViaBridge({
    connectionId: connection.id,
    providerId: connection.providerId,
    authMethod: connection.authMethod,
    environment: connection.environment,
    configuration: connection.configuration,
  })

  if (!result) return null

  const updated: CompanyConnection = {
    ...connection,
    status: result.status as ConnectionStatus,
    health: result.health as ConnectionHealth,
    lastCheckedAt: result.checkedAt,
    updatedAt: nowIso(),
  }

  let next = upsertCompanyConnection(updated, store)
  next = appendAuditEvent(next, {
    type: result.success ? 'connection_verified' : 'connection_verification_failed',
    actorId: OWNER_ID,
    employeeId: null,
    connectionId: connection.id,
    providerId: connection.providerId,
    capabilityIds: result.availableCapabilities,
    environment: connection.environment,
    reasonCode: result.reasonCode,
    metadata: { message: result.message },
  })
  saveEmployeeConnectionsStore(next)

  return {
    success: result.success,
    status: result.status as ConnectionStatus,
    health: result.health as ConnectionHealth,
    checkedAt: result.checkedAt,
    latencyMs: result.latencyMs,
    reasonCode: result.reasonCode,
    message: result.message,
    availableCapabilities: result.availableCapabilities,
  }
}

export function buildDefaultGrantCapabilities(
  employeeId: string,
  providerId: string,
): string[] {
  return getDefaultCapabilitiesForEmployee(employeeId, providerId)
}

export function getEmployeeConnectionsSnapshot(employeeId: string, store = loadEmployeeConnectionsStore()) {
  const grants = store.grants.filter((grant) => grant.employeeId === employeeId && grant.enabled)
  const connections = grants
    .map((grant) => {
      const connection = getCompanyConnection(grant.connectionId, store)
      return connection ? { grant, connection } : null
    })
    .filter((item): item is { grant: EmployeeConnectionGrant; connection: CompanyConnection } => Boolean(item))

  const issueCount = connections.filter(
    (item) =>
      item.connection.status === 'ERROR' ||
      item.connection.status === 'AUTH_REQUIRED' ||
      item.connection.health === 'UNAVAILABLE',
  ).length

  const capabilityCount = connections.reduce((sum, item) => sum + item.grant.capabilityIds.length, 0)

  return { connections, issueCount, capabilityCount, store }
}

export function saveStore(store: EmployeeConnectionsStore): void {
  saveEmployeeConnectionsStore(store)
}

export { secretStore as connectionSecretStoreClient }
