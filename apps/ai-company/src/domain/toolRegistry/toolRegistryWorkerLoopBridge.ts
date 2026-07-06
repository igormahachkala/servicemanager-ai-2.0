import type { OwnerApprovalGate } from '../maxWorkerLoop/maxWorkerLoopApproval'
import type { MaxWorkerLoopReasoningResult } from '../maxWorkerLoop/maxWorkerLoopReasoning'
import type { ToolNeedSignalSource } from './toolRegistry'
import type { ToolRegistryInvokePlan, ToolRegistryInvokeResult } from './toolRegistryInvoke'
import { buildToolRegistryInvokeResult, planToolRegistryInvoke } from './toolRegistryInvoke'
import type { ToolRegistryV1ToolId } from './toolRegistry'
import { isToolRegistryV1ToolId } from './toolRegistry'

export type WorkerLoopToolBranchSnapshot = {
  needSignal: ToolNeedSignalSource
  needReason: string | null
  suggestedToolId: ToolRegistryV1ToolId | null
  ownerApproval: OwnerApprovalGate
  invokePlan: ToolRegistryInvokePlan | null
  invokeResult: ToolRegistryInvokeResult | null
}

/**
 * V1 bridge: reasoning → approval gate → invoke plan (blocked, no execution).
 * Called from MAX Worker Loop when safeMode is false (V2).
 */
export function buildWorkerLoopToolBranchSnapshot(params: {
  reasoning: Pick<
    MaxWorkerLoopReasoningResult,
    'toolNeeded' | 'toolNeededReason'
  >
  safeMode: boolean
  suggestedToolId?: string | null
  employeeId: string
  runtimeRunId: string | null
  maxWorkerLoopId: string | null
  workspaceId?: string | null
  projectId?: string | null
  taskId?: string | null
}): WorkerLoopToolBranchSnapshot {
  const needSignal: ToolNeedSignalSource = params.reasoning.toolNeeded ? 'reasoning' : 'policy'
  const needReason = params.reasoning.toolNeededReason

  const ownerApproval: OwnerApprovalGate = params.safeMode
    ? {
        required: false,
        status: 'none',
        reason: 'V1 safe mode — инструменты не вызываются.',
        toolId: null,
        toolRequestId: null,
        approvalPagePath: '/ops/approvals',
        decidedAt: null,
        decidedBy: null,
      }
    : {
        required: Boolean(params.reasoning.toolNeeded),
        status: params.reasoning.toolNeeded ? 'pending' : 'none',
        reason: needReason,
        toolId: params.suggestedToolId ?? null,
        toolRequestId: null,
        approvalPagePath: '/ops/approvals',
        decidedAt: null,
        decidedBy: null,
      }

  if (params.safeMode || !params.reasoning.toolNeeded) {
    return {
      needSignal,
      needReason,
      suggestedToolId: null,
      ownerApproval,
      invokePlan: null,
      invokeResult: null,
    }
  }

  const toolId =
    params.suggestedToolId && isToolRegistryV1ToolId(params.suggestedToolId)
      ? params.suggestedToolId
      : null

  if (!toolId) {
    return {
      needSignal,
      needReason,
      suggestedToolId: null,
      ownerApproval,
      invokePlan: null,
      invokeResult: null,
    }
  }

  const invokePlan = planToolRegistryInvoke({
    toolId,
    action: 'invoke',
    input: { reason: needReason ?? 'Worker loop tool branch' },
    context: {
      employeeId: params.employeeId,
      runtimeRunId: params.runtimeRunId,
      maxWorkerLoopId: params.maxWorkerLoopId,
      workspaceId: params.workspaceId ?? null,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
    },
    needSignal,
    needReason,
  })

  const invokeResult = buildToolRegistryInvokeResult(invokePlan, null)

  return {
    needSignal,
    needReason,
    suggestedToolId: toolId,
    ownerApproval,
    invokePlan,
    invokeResult,
  }
}
