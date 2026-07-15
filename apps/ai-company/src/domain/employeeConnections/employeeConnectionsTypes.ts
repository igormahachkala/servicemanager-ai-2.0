/**
 * Employee Connections Center — domain types (AI-COMPANY-115).
 */

import type { CostClassification } from '../cursorExecutionRoute/cursorExecutionRouteTypes'

export const CONNECTION_CATEGORIES = [
  'DEVELOPMENT',
  'AI_MODELS',
  'COMMUNICATION',
  'CALENDAR',
  'DOCUMENTS',
  'DESIGN',
  'AUTOMATION',
  'CORPORATE_SYSTEMS',
  'MESSAGING',
  'OTHER',
] as const

export type ConnectionCategory = (typeof CONNECTION_CATEGORIES)[number]

export const CONNECTION_STATUSES = [
  'NOT_CONFIGURED',
  'CONFIGURED',
  'VERIFYING',
  'CONNECTED',
  'DEGRADED',
  'AUTH_REQUIRED',
  'ERROR',
  'DISABLED',
] as const

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export const CONNECTION_HEALTH_VALUES = ['UNKNOWN', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE'] as const

export type ConnectionHealth = (typeof CONNECTION_HEALTH_VALUES)[number]

export const CONNECTION_AUTH_METHODS = [
  'OAUTH',
  'API_KEY',
  'BEARER_TOKEN',
  'WEBHOOK_SECRET',
  'PERSONAL_ACCESS_TOKEN',
  'SERVICE_ACCOUNT',
  'LOCAL_SESSION',
  'LOCAL_RUNTIME',
  'ENDPOINT_ONLY',
  'NONE',
] as const

export type ConnectionAuthMethod = (typeof CONNECTION_AUTH_METHODS)[number]

export const CONNECTION_MODES = ['CLOUD', 'LOCAL', 'HYBRID'] as const

export type ConnectionMode = (typeof CONNECTION_MODES)[number]

export const CONNECTION_ENVIRONMENTS = ['DEV', 'STAGE', 'PRODUCTION'] as const

export type ConnectionEnvironment = (typeof CONNECTION_ENVIRONMENTS)[number]

export const CONNECTION_PERMISSION_LEVELS = [
  'READ_ONLY',
  'READ_WRITE',
  'EXECUTE',
  'ADMIN',
] as const

export type ConnectionPermissionLevel = (typeof CONNECTION_PERMISSION_LEVELS)[number]

export const CONNECTION_COST_MODELS = [
  'INCLUDED_IN_SUBSCRIPTION',
  'USAGE_BASED',
  'FIXED_SUBSCRIPTION',
  'FREE',
  'UNKNOWN',
] as const

export type ConnectionCostModel = (typeof CONNECTION_COST_MODELS)[number]

export const CONNECTION_SPENDING_POLICIES = [
  'INCLUDED_ONLY',
  'OWNER_APPROVAL_REQUIRED',
  'BLOCK_ALL_PAID_USAGE',
] as const

export type ConnectionSpendingPolicy = (typeof CONNECTION_SPENDING_POLICIES)[number]

export const EMPLOYEE_CONNECTION_REASON_CODES = [
  'CONNECTION_AVAILABLE',
  'CONNECTION_NOT_FOUND',
  'CONNECTION_NOT_CONFIGURED',
  'CONNECTION_DISABLED',
  'CONNECTION_UNHEALTHY',
  'EMPLOYEE_GRANT_NOT_FOUND',
  'CAPABILITY_NOT_GRANTED',
  'ENVIRONMENT_NOT_ALLOWED',
  'OWNER_APPROVAL_REQUIRED',
  'COST_UNKNOWN',
  'ADDITIONAL_COST_REQUIRED',
  'BLOCKED_BY_COST_POLICY',
  'AUTH_REQUIRED',
  'SECRET_UNAVAILABLE',
] as const

export type EmployeeConnectionReasonCode = (typeof EMPLOYEE_CONNECTION_REASON_CODES)[number]

export type ConnectionCapabilityDefinition = {
  id: string
  label: string
  description: string
  permissionLevel: ConnectionPermissionLevel
  defaultEnabled: boolean
}

export type ConnectionProviderDefinition = {
  id: string
  name: string
  description: string
  iconKey: string
  category: ConnectionCategory
  authMethods: ConnectionAuthMethod[]
  supportedCapabilities: ConnectionCapabilityDefinition[]
  environments: ConnectionEnvironment[]
  costModel: ConnectionCostModel
  connectionMode: ConnectionMode
  documentationUrl?: string
  enabled: boolean
  implemented: boolean
}

export type CompanyConnection = {
  id: string
  providerId: string
  displayName: string
  status: ConnectionStatus
  authMethod: ConnectionAuthMethod
  environment: ConnectionEnvironment
  configuration: Record<string, unknown>
  secretRef: string | null
  secretMask: string | null
  health: ConnectionHealth
  costClassification: CostClassification
  createdAt: string
  updatedAt: string
  lastCheckedAt: string | null
  lastUsedAt: string | null
  createdBy: string
}

export type EmployeeConnectionGrant = {
  id: string
  employeeId: string
  connectionId: string
  capabilityIds: string[]
  permissionLevel: ConnectionPermissionLevel
  requiresOwnerApproval: boolean
  allowedEnvironments: ConnectionEnvironment[]
  spendingPolicy: ConnectionSpendingPolicy
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type ConnectionTestResult = {
  success: boolean
  status: ConnectionStatus
  health: ConnectionHealth
  checkedAt: string
  latencyMs: number | null
  reasonCode: string
  message: string
  availableCapabilities: string[]
}

export type ResolveEmployeeCapabilityInput = {
  employeeId: string
  capabilityId: string
  environment: ConnectionEnvironment
  estimatedCostClassification?: CostClassification
  ownerApproved?: boolean
}

export type ResolveEmployeeCapabilityResult = {
  allowed: boolean
  employeeId: string
  connectionId: string | null
  providerId: string | null
  capabilityId: string
  requiresOwnerApproval: boolean
  costClassification: CostClassification
  reasonCode: EmployeeConnectionReasonCode
  explanation: string
}

export type ConnectionSecretPayload = {
  type: ConnectionAuthMethod
  value: string
  metadata?: Record<string, unknown>
}

export type EmployeeConnectionAuditEventType =
  | 'connection_created'
  | 'connection_updated'
  | 'connection_verified'
  | 'connection_verification_failed'
  | 'connection_disabled'
  | 'connection_deleted'
  | 'employee_connection_granted'
  | 'employee_connection_revoked'
  | 'capability_resolution_allowed'
  | 'capability_resolution_blocked'
  | 'connection_secret_created'
  | 'connection_secret_rotated'
  | 'connection_secret_deleted'

export type EmployeeConnectionAuditEvent = {
  id: string
  type: EmployeeConnectionAuditEventType
  at: string
  actorId: string
  employeeId: string | null
  connectionId: string | null
  providerId: string | null
  capabilityIds: string[]
  environment: ConnectionEnvironment | null
  reasonCode: string | null
  metadata?: Record<string, unknown>
}

export type EmployeeConnectionsStore = {
  version: 'v1'
  connections: CompanyConnection[]
  grants: EmployeeConnectionGrant[]
  auditEvents: EmployeeConnectionAuditEvent[]
  updatedAt: string
}

export type LegacyRuntimeConnectionHint = {
  providerId: string
  displayName: string
  detected: boolean
  message: string
  suggestedAuthMethod: ConnectionAuthMethod
  configurationPreview: Record<string, unknown>
}

export const EMPLOYEE_CONNECTIONS_STORE_VERSION = 'v1' as const
