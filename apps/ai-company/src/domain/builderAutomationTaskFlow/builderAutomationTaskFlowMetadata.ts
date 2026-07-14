/**
 * Builder Automation Task Flow — metadata (AI-COMPANY-113).
 */

import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { readRouteDecisionFromRunOutput } from '../manualCursorTaskFlow/manualCursorTaskFlowMetadata'
import {
  BUILDER_AUTOMATION_TASK_FLOW_VERSION,
  type BuilderAutomationTaskFlowMetadata,
} from './builderAutomationTaskFlowTypes'

const METADATA_KEY = 'builderAutomationTaskFlow'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export { readRouteDecisionFromRunOutput }

export function readBuilderAutomationTaskFlowMetadata(
  run: ToolExecutionRun,
): BuilderAutomationTaskFlowMetadata | null {
  const output = run.result?.output
  if (!isRecord(output)) return null
  const raw = output[METADATA_KEY]
  if (!isRecord(raw) || raw.version !== BUILDER_AUTOMATION_TASK_FLOW_VERSION) return null
  if (typeof raw.repository !== 'string' || typeof raw.baseBranch !== 'string') return null
  if (raw.environment !== 'dev') return null

  return {
    version: BUILDER_AUTOMATION_TASK_FLOW_VERSION,
    repository: raw.repository,
    baseBranch: raw.baseBranch,
    requiresRepositoryWrite: raw.requiresRepositoryWrite === true,
    requiresCommitOrPullRequest: raw.requiresCommitOrPullRequest === true,
    environment: 'dev',
    assignedEmployeeId:
      typeof raw.assignedEmployeeId === 'string' ? raw.assignedEmployeeId : 'builder',
    ownerApprovedAt: typeof raw.ownerApprovedAt === 'string' ? raw.ownerApprovedAt : null,
    dispatchedAt: typeof raw.dispatchedAt === 'string' ? raw.dispatchedAt : null,
    resultDiscoveredAt:
      typeof raw.resultDiscoveredAt === 'string' ? raw.resultDiscoveredAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : run.createdAt,
  }
}

export function buildBuilderAutomationTaskFlowMetadata(
  input: Omit<
    BuilderAutomationTaskFlowMetadata,
    'ownerApprovedAt' | 'dispatchedAt' | 'resultDiscoveredAt' | 'createdAt' | 'version'
  >,
  now = new Date().toISOString(),
): BuilderAutomationTaskFlowMetadata {
  return {
    version: BUILDER_AUTOMATION_TASK_FLOW_VERSION,
    ...input,
    ownerApprovedAt: null,
    dispatchedAt: null,
    resultDiscoveredAt: null,
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

export function patchBuilderAutomationTaskFlowMetadata(
  metadata: BuilderAutomationTaskFlowMetadata,
  extraOutput: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extraOutput,
    [METADATA_KEY]: metadata,
  }
}
