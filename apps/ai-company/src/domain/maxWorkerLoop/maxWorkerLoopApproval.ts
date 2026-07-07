import type { MaxWorkerLoopReasoningResult } from './maxWorkerLoopReasoning'
import type { DecisionPlan } from '../decisionPlan'

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
  decisionPlan?: DecisionPlan | null,
): OwnerApprovalGate {
  const planReason =
    decisionPlan?.ownerApprovalRequired && decisionPlan.ownerApprovalReasons.length > 0
      ? decisionPlan.ownerApprovalReasons.join(' · ')
      : null

  if (safeMode) {
    if (decisionPlan?.ownerApprovalRequired || decisionPlan?.cursorAutomationRequired) {
      return {
        required: true,
        status: 'pending',
        reason:
          planReason ??
          decisionPlan?.cursorAutomationReason ??
          'Decision Plan: требуется Owner Approval — V1 safe mode не вызывает инструменты.',
        toolId: decisionPlan?.cursorAutomationRequired ? 'cursor-automation' : null,
        toolRequestId: null,
        approvalPagePath: '/ops/approvals',
        decidedAt: null,
        decidedBy: null,
      }
    }
    return {
      required: false,
      status: 'none',
      reason: 'V1 safe mode — инструменты не вызываются, только reasoning и отчёт.',
      toolId: null,
      toolRequestId: null,
      approvalPagePath: '/ops/approvals',
      decidedAt: null,
      decidedBy: null,
    }
  }

  if (!reasoning.toolNeeded && !decisionPlan?.ownerApprovalRequired) {
    return {
      required: false,
      status: 'none',
      reason: null,
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
    reason:
      planReason ??
      reasoning.toolNeededReason ??
      'MAX запросил инструмент — требуется одобрение Owner.',
    toolId: decisionPlan?.cursorAutomationRequired ? 'cursor-automation' : null,
    toolRequestId: null,
    approvalPagePath: '/ops/approvals',
    decidedAt: null,
    decidedBy: null,
  }
}
