import type { MaxWorkerLoopReasoningResult } from './maxWorkerLoopReasoning'

export const OWNER_APPROVAL_GATE_STATUSES = [
  'none',
  'pending',
  'approved',
  'rejected',
] as const

export type OwnerApprovalGateStatus = (typeof OWNER_APPROVAL_GATE_STATUSES)[number]

/**
 * Placeholder for V2 tool branch.
 * V1 safe mode never requires approval — tools are not invoked.
 */
export type OwnerApprovalGate = {
  required: boolean
  status: OwnerApprovalGateStatus
  reason: string | null
  toolId: string | null
  toolRequestId: string | null
  approvalPagePath: '/ops/approvals'
  decidedAt: string | null
  decidedBy: 'owner' | null
}

export function resolveOwnerApprovalGate(
  reasoning: Pick<MaxWorkerLoopReasoningResult, 'toolNeeded' | 'toolNeededReason'>,
  safeMode: true,
): OwnerApprovalGate {
  if (safeMode || !reasoning.toolNeeded) {
    return {
      required: false,
      status: 'none',
      reason: safeMode
        ? 'V1 safe mode — инструменты не вызываются, только reasoning и отчёт.'
        : null,
      toolId: null,
      toolRequestId: null,
      approvalPagePath: '/ops/approvals',
      decidedAt: null,
      decidedBy: null,
    }
  }

  return {
    required: true,
    status: 'pending',
    reason: reasoning.toolNeededReason ?? 'MAX запросил инструмент — требуется одобрение Owner.',
    toolId: null,
    toolRequestId: null,
    approvalPagePath: '/ops/approvals',
    decidedAt: null,
    decidedBy: null,
  }
}
