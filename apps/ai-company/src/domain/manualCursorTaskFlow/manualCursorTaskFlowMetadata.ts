/**
 * Manual Cursor Task Flow — metadata on ToolExecutionRun (AI-COMPANY-112).
 */

import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  MANUAL_CURSOR_TASK_FLOW_VERSION,
  type ManualCursorTaskFlowMetadata,
} from './manualCursorTaskFlowTypes'

const METADATA_KEY = 'manualCursorTaskFlow'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readManualCursorTaskFlowMetadata(
  run: ToolExecutionRun,
): ManualCursorTaskFlowMetadata | null {
  const output = run.result?.output
  if (!isRecord(output)) return null
  const raw = output[METADATA_KEY]
  if (!isRecord(raw) || raw.version !== MANUAL_CURSOR_TASK_FLOW_VERSION) return null

  if (typeof raw.repository !== 'string' || typeof raw.baseBranch !== 'string') return null
  if (typeof raw.assignedEmployeeId !== 'string') return null
  if (raw.environment !== 'dev') return null

  return {
    version: MANUAL_CURSOR_TASK_FLOW_VERSION,
    repository: raw.repository,
    baseBranch: raw.baseBranch,
    requiresRepositoryWrite: raw.requiresRepositoryWrite === true,
    requiresCommitOrPullRequest: raw.requiresCommitOrPullRequest === true,
    requiresReliableCompletion: raw.requiresReliableCompletion === true,
    environment: 'dev',
    assignedEmployeeId: raw.assignedEmployeeId,
    ownerApprovedAt: typeof raw.ownerApprovedAt === 'string' ? raw.ownerApprovedAt : null,
    taskPackageGeneratedAt:
      typeof raw.taskPackageGeneratedAt === 'string' ? raw.taskPackageGeneratedAt : null,
    resultImportedAt: typeof raw.resultImportedAt === 'string' ? raw.resultImportedAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : run.createdAt,
  }
}

export function readRouteDecisionFromRunOutput(
  run: ToolExecutionRun,
): ExecutionRouteDecision | null {
  const output = run.result?.output
  if (!isRecord(output)) return null
  const raw = output.routeDecision
  if (!isRecord(raw)) return null
  if (typeof raw.selectedRoute !== 'string') return null

  return {
    selectedRoute: raw.selectedRoute as ExecutionRouteDecision['selectedRoute'],
    allowed: raw.allowed === true,
    requiresOwnerApproval: raw.requiresOwnerApproval === true,
    costClassification: raw.costClassification as ExecutionRouteDecision['costClassification'],
    reasonCode: raw.reasonCode as ExecutionRouteDecision['reasonCode'],
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    alternatives: Array.isArray(raw.alternatives)
      ? (raw.alternatives as ExecutionRouteDecision['alternatives'])
      : [],
  }
}

export function buildManualCursorTaskFlowMetadata(
  input: Omit<
    ManualCursorTaskFlowMetadata,
    'ownerApprovedAt' | 'taskPackageGeneratedAt' | 'resultImportedAt' | 'createdAt' | 'version'
  >,
  now = new Date().toISOString(),
): ManualCursorTaskFlowMetadata {
  return {
    version: MANUAL_CURSOR_TASK_FLOW_VERSION,
    ...input,
    ownerApprovedAt: null,
    taskPackageGeneratedAt: null,
    resultImportedAt: null,
    createdAt: now,
  }
}

export function mergeRunOutput(
  run: ToolExecutionRun,
  patch: Record<string, unknown>,
  plannedOnly = true,
): ToolExecutionRun['result'] {
  const prior = isRecord(run.result?.output) ? run.result.output : {}
  return {
    plannedOnly,
    output: { ...prior, ...patch },
    deliveryMode: run.result?.deliveryMode ?? 'planned_v1',
    cursorAutomationTaskId: run.result?.cursorAutomationTaskId ?? null,
    registryInvokePlanId: run.result?.registryInvokePlanId ?? null,
    receivedAt: run.result?.receivedAt ?? null,
  }
}

export function patchManualCursorTaskFlowMetadata(
  metadata: ManualCursorTaskFlowMetadata,
  extraOutput: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extraOutput,
    [METADATA_KEY]: metadata,
  }
}
