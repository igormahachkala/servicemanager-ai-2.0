/**
 * Tool Registry V1 — domain types (AI-COMPANY-096).
 * No real execution. Adapters connect in V2.
 */

export const TOOL_REGISTRY_V1_VERSION = 'v1' as const

/** Canonical V1 tool ids — external executors (Cursor/Claude/Codex) are tools, not employees. */
export const TOOL_REGISTRY_V1_TOOL_IDS = [
  'filesystem',
  'terminal',
  'git',
  'docker',
  'playwright',
  'cursor-automation',
  'claude-code-cli',
  'codex-cli',
  'browser',
  'github',
] as const

export type ToolRegistryV1ToolId = (typeof TOOL_REGISTRY_V1_TOOL_IDS)[number]

export const TOOL_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const

export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number]

export type ToolRegistryTransport =
  | 'local'
  | 'cli'
  | 'mcp'
  | 'rest-api'
  | 'native'
  | 'browser-automation'
  | 'cursor-automation'

export type ToolRegistryIoContract = {
  description: string
  /** Human-readable schema hint until JSON Schema in V2. */
  schemaHint: string
  example?: Record<string, unknown>
}

export type ToolRegistryHistoryPolicy = {
  /** V1: localStorage via toolExecution; V2: server DB. */
  persisted: boolean
  storageSurface: 'toolExecution' | 'toolRegistryInvoke' | 'server-api'
  retentionDays: number | null
}

export type ToolRegistryLoggingPolicy = {
  auditEvents: boolean
  runtimeLogs: boolean
  executionLogPage: '/ops/tool-executions'
  approvalEvents: boolean
}

/**
 * How a digital employee surfaces tool need to Owner / Runtime.
 * - reasoning: MAX / model sets toolNeeded + reason
 * - policy: registry risk + requiresOwnerApproval
 * - capability: task template flags requiresExternalTools
 */
export type ToolNeedSignalSource = 'reasoning' | 'policy' | 'capability' | 'manual'

export type ToolRegistryEntryV1 = {
  id: ToolRegistryV1ToolId
  name: string
  description: string
  purpose: string
  riskLevel: ToolRiskLevel
  requiresOwnerApproval: boolean
  transport: ToolRegistryTransport
  /** Link to Mission Control catalog (`registryTools`). */
  registryToolId: string
  input: ToolRegistryIoContract
  output: ToolRegistryIoContract
  history: ToolRegistryHistoryPolicy
  errorHandling: string
  logging: ToolRegistryLoggingPolicy
  /** Hint shown when employee proposes this tool. */
  employeeNeedHint: string
}

export function isToolRegistryV1ToolId(value: string): value is ToolRegistryV1ToolId {
  return (TOOL_REGISTRY_V1_TOOL_IDS as readonly string[]).includes(value)
}

export function compareToolRisk(a: ToolRiskLevel, b: ToolRiskLevel): number {
  const order: Record<ToolRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  }
  return order[a] - order[b]
}

export function resolveRequiresOwnerApproval(
  entry: Pick<ToolRegistryEntryV1, 'requiresOwnerApproval' | 'riskLevel'>,
  actionRisk: ToolRiskLevel = entry.riskLevel,
): boolean {
  if (entry.requiresOwnerApproval) return true
  return compareToolRisk(actionRisk, 'high') >= 0
}
