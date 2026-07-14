/**
 * Cursor execution route — policy + cost guard preflight (AI-COMPANY-109).
 */

import { evaluateCursorCostGuard } from './cursorCostGuard'
import { decideCursorExecutionRoute } from './cursorExecutionRoutePolicy'
import { buildCursorExecutionRouteEvents } from './cursorExecutionRouteObservability'
import type {
  CursorExecutionDispatchDecision,
  CursorExecutionReasonCode,
  CursorRoutePolicyInput,
  ExecutionRouteDecision,
} from './cursorExecutionRouteTypes'

function mergeDecision(
  routeDecision: ExecutionRouteDecision,
  reasonCode: CursorExecutionReasonCode,
  explanation: string,
  allowed: boolean,
  requiresOwnerApproval: boolean,
): ExecutionRouteDecision {
  return {
    ...routeDecision,
    allowed,
    requiresOwnerApproval,
    reasonCode,
    explanation,
  }
}

export function evaluateCursorExecutionDispatch(
  input: CursorRoutePolicyInput,
): CursorExecutionDispatchDecision {
  const routeDecision = decideCursorExecutionRoute(input)

  if (!routeDecision.selectedRoute) {
    const events = buildCursorExecutionRouteEvents(input, routeDecision)
    return { routeDecision, costGuard: null, events }
  }

  const costGuard = evaluateCursorCostGuard({
    route: routeDecision.selectedRoute,
    costClassification: routeDecision.costClassification,
    ownerApprovalGranted: input.ownerApprovalGranted,
    environment: input.environment,
    requiresRepositoryWrite: input.requiresRepositoryWrite,
  })

  let finalDecision = routeDecision

  if (!costGuard.allowed) {
    finalDecision = mergeDecision(
      routeDecision,
      costGuard.reasonCode,
      costGuard.explanation,
      false,
      costGuard.requiresOwnerApproval || routeDecision.requiresOwnerApproval,
    )
  } else if (costGuard.requiresOwnerApproval) {
    finalDecision = mergeDecision(
      routeDecision,
      costGuard.reasonCode,
      costGuard.explanation,
      false,
      true,
    )
  } else if (routeDecision.requiresOwnerApproval) {
    finalDecision = mergeDecision(
      routeDecision,
      'OWNER_APPROVAL_REQUIRED',
      'Selected route requires Owner approval before dispatch.',
      false,
      true,
    )
  } else {
    finalDecision = mergeDecision(
      routeDecision,
      routeDecision.reasonCode,
      routeDecision.explanation,
      true,
      false,
    )
  }

  const events = buildCursorExecutionRouteEvents(input, finalDecision)
  return { routeDecision: finalDecision, costGuard, events }
}
