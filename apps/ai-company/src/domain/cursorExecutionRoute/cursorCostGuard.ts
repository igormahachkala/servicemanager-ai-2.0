/**
 * Cursor Cost Guard — blocks unknown/additional cost paths (AI-COMPANY-109).
 * No billing API, no credit purchase, no Max Mode toggles.
 */

import type {
  CostClassification,
  CursorCostGuardInput,
  CursorCostGuardResult,
  CursorExecutionReasonCode,
} from './cursorExecutionRouteTypes'

function block(
  reasonCode: CursorExecutionReasonCode,
  explanation: string,
  requiresOwnerApproval = false,
): CursorCostGuardResult {
  return { allowed: false, requiresOwnerApproval, reasonCode, explanation }
}

function allow(
  reasonCode: CursorExecutionReasonCode,
  explanation: string,
  requiresOwnerApproval = false,
): CursorCostGuardResult {
  return { allowed: true, requiresOwnerApproval, reasonCode, explanation }
}

export function evaluateCursorCostGuard(input: CursorCostGuardInput): CursorCostGuardResult {
  const { route, costClassification, ownerApprovalGranted, environment, requiresRepositoryWrite } =
    input

  if (costClassification === 'BLOCKED_BY_COST_POLICY') {
    return block(
      'BLOCKED_BY_COST_POLICY',
      `Route ${route} is blocked by cost policy — no dispatch permitted.`,
    )
  }

  if (costClassification === 'UNKNOWN_COST') {
    return block(
      'COST_UNKNOWN',
      `Route ${route} has unknown cost — automatic dispatch is forbidden.`,
    )
  }

  if (costClassification === 'ADDITIONAL_COST_REQUIRED') {
    return block(
      'ADDITIONAL_COST_REQUIRED',
      `Route ${route} requires additional cost — automatic dispatch and credit purchase are forbidden.`,
    )
  }

  if (environment === 'production' && requiresRepositoryWrite && !ownerApprovalGranted) {
    return block(
      'PRODUCTION_POLICY_BLOCK',
      'Production repository changes require Owner approval before dispatch.',
      true,
    )
  }

  if (route === 'MANUAL_CLOUD_AGENT' && !ownerApprovalGranted) {
    return block(
      'OWNER_APPROVAL_REQUIRED',
      'Manual Cloud Agent route requires Owner approval before execution.',
      true,
    )
  }

  if (
    route === 'CURSOR_AUTOMATION_WEBHOOK' &&
    requiresRepositoryWrite &&
    !ownerApprovalGranted
  ) {
    return block(
      'OWNER_APPROVAL_REQUIRED',
      'Automation webhook with repository write requires Owner approval.',
      true,
    )
  }

  if (environment === 'production' && route === 'CURSOR_AUTOMATION_WEBHOOK') {
    return block(
      'PRODUCTION_POLICY_BLOCK',
      'Automation webhook is not permitted in production without confirmed completion path.',
    )
  }

  return allow(
    'COST_INCLUDED',
    `Route ${route} cost is included in subscription — dispatch permitted by cost guard.`,
  )
}

export function isAutomaticDispatchBlockedByCost(cost: CostClassification): boolean {
  return (
    cost === 'UNKNOWN_COST' ||
    cost === 'ADDITIONAL_COST_REQUIRED' ||
    cost === 'BLOCKED_BY_COST_POLICY'
  )
}
