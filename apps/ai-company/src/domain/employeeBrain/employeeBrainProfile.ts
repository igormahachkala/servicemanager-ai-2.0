/**
 * Employee Brain profile — compact shape for Decision Plan engine (101E WIP).
 * Canonical storage in 101D is EmployeeBrainV1 — see employeeBrain.ts.
 */

import type { ReasoningLevel } from '../runtime/runtimeProfile'

export const EMPLOYEE_BRAIN_VERSION = 'v1' as const

export const EMPLOYEE_BRAIN_AUTONOMY_LEVELS = ['supervised', 'guided', 'semi_autonomous'] as const
export type EmployeeBrainAutonomyLevel = (typeof EMPLOYEE_BRAIN_AUTONOMY_LEVELS)[number]

export const EMPLOYEE_BRAIN_RISK_LEVELS = ['low', 'medium', 'high'] as const
export type EmployeeBrainRiskLevel = (typeof EMPLOYEE_BRAIN_RISK_LEVELS)[number]

export const EMPLOYEE_BRAIN_DECISION_STYLES = ['conservative', 'balanced', 'pragmatic'] as const
export type EmployeeBrainDecisionStyle = (typeof EMPLOYEE_BRAIN_DECISION_STYLES)[number]

export const EMPLOYEE_BRAIN_MODEL_STRATEGIES = ['single_best', 'multi_step', 'fast_first'] as const
export type EmployeeBrainModelStrategy = (typeof EMPLOYEE_BRAIN_MODEL_STRATEGIES)[number]

export const EMPLOYEE_BRAIN_TOOL_STRATEGIES = ['minimal', 'registry_first', 'external_when_needed'] as const
export type EmployeeBrainToolStrategy = (typeof EMPLOYEE_BRAIN_TOOL_STRATEGIES)[number]

export type EmployeeBrainReasoningPreferences = {
  level: ReasoningLevel
  preferVerification: boolean
  preferStructuredOutput: boolean
}

export type EmployeeBrainProfile = {
  id: string
  employeeId: string
  version: typeof EMPLOYEE_BRAIN_VERSION
  specialization: string
  decisionStyle: EmployeeBrainDecisionStyle
  modelSelectionStrategy: EmployeeBrainModelStrategy
  toolSelectionStrategy: EmployeeBrainToolStrategy
  autonomyLevel: EmployeeBrainAutonomyLevel
  acceptableRisk: EmployeeBrainRiskLevel
  reasoningPreferences: EmployeeBrainReasoningPreferences
  constraints: string[]
  ownerApprovalTriggers: string[]
  createdAt: string
  updatedAt: string
}

export type EmployeeBrainTaskInput = {
  taskId?: string | null
  title?: string | null
  taskText: string
  workspaceId?: string | null
  projectId?: string | null
  requestedModelMode?: import('../runtime/runtimeModelRouting').RuntimeModelMode | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseEmployeeBrainProfile(value: unknown): EmployeeBrainProfile | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    value.version !== EMPLOYEE_BRAIN_VERSION ||
    typeof value.specialization !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  const decisionStyle = EMPLOYEE_BRAIN_DECISION_STYLES.includes(
    value.decisionStyle as EmployeeBrainDecisionStyle,
  )
    ? (value.decisionStyle as EmployeeBrainDecisionStyle)
    : null
  const modelSelectionStrategy = EMPLOYEE_BRAIN_MODEL_STRATEGIES.includes(
    value.modelSelectionStrategy as EmployeeBrainModelStrategy,
  )
    ? (value.modelSelectionStrategy as EmployeeBrainModelStrategy)
    : null
  const toolSelectionStrategy = EMPLOYEE_BRAIN_TOOL_STRATEGIES.includes(
    value.toolSelectionStrategy as EmployeeBrainToolStrategy,
  )
    ? (value.toolSelectionStrategy as EmployeeBrainToolStrategy)
    : null
  const autonomyLevel = EMPLOYEE_BRAIN_AUTONOMY_LEVELS.includes(
    value.autonomyLevel as EmployeeBrainAutonomyLevel,
  )
    ? (value.autonomyLevel as EmployeeBrainAutonomyLevel)
    : null
  const acceptableRisk = EMPLOYEE_BRAIN_RISK_LEVELS.includes(value.acceptableRisk as EmployeeBrainRiskLevel)
    ? (value.acceptableRisk as EmployeeBrainRiskLevel)
    : null

  if (!decisionStyle || !modelSelectionStrategy || !toolSelectionStrategy || !autonomyLevel || !acceptableRisk) {
    return null
  }

  const reasoningRaw = isRecord(value.reasoningPreferences) ? value.reasoningPreferences : null
  const reasoningLevel =
    reasoningRaw?.level === 'minimal' ||
    reasoningRaw?.level === 'standard' ||
    reasoningRaw?.level === 'deep'
      ? reasoningRaw.level
      : 'standard'

  const constraints = Array.isArray(value.constraints)
    ? value.constraints.filter((item): item is string => typeof item === 'string')
    : []
  const ownerApprovalTriggers = Array.isArray(value.ownerApprovalTriggers)
    ? value.ownerApprovalTriggers.filter((item): item is string => typeof item === 'string')
    : []

  return {
    id: value.id,
    employeeId: value.employeeId,
    version: EMPLOYEE_BRAIN_VERSION,
    specialization: value.specialization,
    decisionStyle,
    modelSelectionStrategy,
    toolSelectionStrategy,
    autonomyLevel,
    acceptableRisk,
    reasoningPreferences: {
      level: reasoningLevel,
      preferVerification: reasoningRaw?.preferVerification === true,
      preferStructuredOutput: reasoningRaw?.preferStructuredOutput !== false,
    },
    constraints,
    ownerApprovalTriggers,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function createEmployeeBrainProfileId(employeeId: string): string {
  return `brain-${employeeId}-${Date.now().toString(36)}`
}
