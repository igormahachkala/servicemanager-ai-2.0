/**
 * Decision Plan — separate entity produced by Employee Brain (AI-COMPANY-101E).
 * Not a Run, not Runtime config, not Worker Loop state.
 */

import type { RuntimeModelMode } from '../runtime/runtimeModelRouting'
import type { ToolRegistryV1ToolId } from '../toolRegistry'

export const DECISION_PLAN_VERSION = 'v1' as const

export type DecisionPlanModelRole = 'primary' | 'secondary' | 'verification'

export type DecisionPlanModelChoice = {
  catalogModelId: string
  ollamaTag: string
  label: string
  modelMode: RuntimeModelMode
  role: DecisionPlanModelRole
  reason: string
}

export type DecisionPlanExpectedResult = {
  summary: string
  deliverables: string[]
  acceptanceCriteria: string[]
}

export type DecisionPlan = {
  id: string
  version: typeof DECISION_PLAN_VERSION
  employeeId: string
  brainProfileId: string
  taskId: string | null
  taskTitle: string | null
  taskTextDigest: string
  createdAt: string
  /** Best-fit local model for the first reasoning step. */
  primaryModel: DecisionPlanModelChoice
  useMultipleModels: boolean
  modelPipeline: DecisionPlanModelChoice[]
  toolRegistryRequired: boolean
  suggestedToolIds: ToolRegistryV1ToolId[]
  toolRegistryReason: string | null
  cursorAutomationRequired: boolean
  cursorAutomationReason: string | null
  ownerApprovalRequired: boolean
  ownerApprovalReasons: string[]
  expectedResult: DecisionPlanExpectedResult
  /** Human-readable trace of Brain reasoning (not LLM output). */
  rationale: string[]
  matchedTaskSignals: string[]
  classifiedIntent: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseModelChoice(value: unknown): DecisionPlanModelChoice | null {
  if (!isRecord(value)) return null
  if (
    typeof value.catalogModelId !== 'string' ||
    typeof value.ollamaTag !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.modelMode !== 'string' ||
    typeof value.role !== 'string' ||
    typeof value.reason !== 'string'
  ) {
    return null
  }
  const role =
    value.role === 'primary' || value.role === 'secondary' || value.role === 'verification'
      ? value.role
      : null
  if (!role) return null
  return {
    catalogModelId: value.catalogModelId,
    ollamaTag: value.ollamaTag,
    label: value.label,
    modelMode: value.modelMode as RuntimeModelMode,
    role,
    reason: value.reason,
  }
}

function parseExpectedResult(value: unknown): DecisionPlanExpectedResult | null {
  if (!isRecord(value)) return null
  if (typeof value.summary !== 'string') return null
  const deliverables = Array.isArray(value.deliverables)
    ? value.deliverables.filter((item): item is string => typeof item === 'string')
    : []
  const acceptanceCriteria = Array.isArray(value.acceptanceCriteria)
    ? value.acceptanceCriteria.filter((item): item is string => typeof item === 'string')
    : []
  return { summary: value.summary, deliverables, acceptanceCriteria }
}

export function parseDecisionPlan(value: unknown): DecisionPlan | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    value.version !== DECISION_PLAN_VERSION ||
    typeof value.employeeId !== 'string' ||
    typeof value.brainProfileId !== 'string' ||
    typeof value.taskTextDigest !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.classifiedIntent !== 'string'
  ) {
    return null
  }

  const primaryModel = parseModelChoice(value.primaryModel)
  const expectedResult = parseExpectedResult(value.expectedResult)
  if (!primaryModel || !expectedResult) return null

  const modelPipeline = Array.isArray(value.modelPipeline)
    ? value.modelPipeline.map(parseModelChoice).filter((item): item is DecisionPlanModelChoice => item !== null)
    : []

  const suggestedToolIds = Array.isArray(value.suggestedToolIds)
    ? value.suggestedToolIds.filter((item): item is ToolRegistryV1ToolId => typeof item === 'string')
    : []

  const ownerApprovalReasons = Array.isArray(value.ownerApprovalReasons)
    ? value.ownerApprovalReasons.filter((item): item is string => typeof item === 'string')
    : []

  const rationale = Array.isArray(value.rationale)
    ? value.rationale.filter((item): item is string => typeof item === 'string')
    : []

  const matchedTaskSignals = Array.isArray(value.matchedTaskSignals)
    ? value.matchedTaskSignals.filter((item): item is string => typeof item === 'string')
    : []

  return {
    id: value.id,
    version: DECISION_PLAN_VERSION,
    employeeId: value.employeeId,
    brainProfileId: value.brainProfileId,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    taskTitle: typeof value.taskTitle === 'string' ? value.taskTitle : null,
    taskTextDigest: value.taskTextDigest,
    createdAt: value.createdAt,
    primaryModel,
    useMultipleModels: value.useMultipleModels === true,
    modelPipeline,
    toolRegistryRequired: value.toolRegistryRequired === true,
    suggestedToolIds,
    toolRegistryReason: typeof value.toolRegistryReason === 'string' ? value.toolRegistryReason : null,
    cursorAutomationRequired: value.cursorAutomationRequired === true,
    cursorAutomationReason:
      typeof value.cursorAutomationReason === 'string' ? value.cursorAutomationReason : null,
    ownerApprovalRequired: value.ownerApprovalRequired === true,
    ownerApprovalReasons,
    expectedResult,
    rationale,
    matchedTaskSignals,
    classifiedIntent: value.classifiedIntent,
  }
}

export function createDecisionPlanId(): string {
  return `dplan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function digestTaskText(taskText: string, maxLen = 160): string {
  const normalized = taskText.trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLen) return normalized
  return `${normalized.slice(0, maxLen - 1)}…`
}
