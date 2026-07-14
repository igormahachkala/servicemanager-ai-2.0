/**
 * Cursor Execution Route Policy — Path C route selection (AI-COMPANY-109).
 * Pure, testable — no UI, no Cursor launch, no webhook calls.
 */

import { isAutomaticDispatchBlockedByCost } from './cursorCostGuard'
import type {
  CostClassification,
  CursorExecutionReasonCode,
  CursorRoutePolicyInput,
  ExecutionRoute,
  ExecutionRouteDecision,
  ExpectedCostByRoute,
  RouteAlternative,
} from './cursorExecutionRouteTypes'

const ROUTE_PRIORITY: ExecutionRoute[] = [
  'LOCAL_CURSOR_BRIDGE',
  'MANUAL_CLOUD_AGENT',
  'CURSOR_AUTOMATION_WEBHOOK',
]

export function defaultExpectedCostByRoute(): ExpectedCostByRoute {
  return {
    LOCAL_CURSOR_BRIDGE: 'INCLUDED_IN_SUBSCRIPTION',
    MANUAL_CLOUD_AGENT: 'INCLUDED_IN_SUBSCRIPTION',
    CURSOR_AUTOMATION_WEBHOOK: 'INCLUDED_IN_SUBSCRIPTION',
  }
}

function isProductionRepositoryWriteBlocked(input: CursorRoutePolicyInput): boolean {
  return (
    input.environment === 'production' &&
    input.requiresRepositoryWrite &&
    !input.ownerApprovalGranted
  )
}

function localBridgeEligible(input: CursorRoutePolicyInput): { ok: boolean; reason: string } {
  if (!input.requiresAutomaticExecution) {
    return { ok: false, reason: 'Automatic execution not required.' }
  }
  if (!input.localBridgeAvailable) {
    return { ok: false, reason: 'Local Cursor Bridge is unavailable.' }
  }
  if (input.requiresCommitOrPullRequest) {
    return { ok: false, reason: 'Commit/PR-only workflow is not satisfied by Local Bridge alone.' }
  }
  if (isAutomaticDispatchBlockedByCost(input.expectedCostClassificationByRoute.LOCAL_CURSOR_BRIDGE)) {
    return {
      ok: false,
      reason: `Local Bridge cost is ${input.expectedCostClassificationByRoute.LOCAL_CURSOR_BRIDGE}.`,
    }
  }
  return { ok: true, reason: 'Local automation preferred for controlled lifecycle.' }
}

function manualCloudAgentEligible(input: CursorRoutePolicyInput): { ok: boolean; reason: string } {
  if (!input.manualOperatorAvailable) {
    return { ok: false, reason: 'Manual operator is unavailable.' }
  }
  const needsManual =
    input.requiresCommitOrPullRequest ||
    !input.localBridgeAvailable ||
    !input.requiresAutomaticExecution
  if (!needsManual && localBridgeEligible(input).ok) {
    return { ok: false, reason: 'Local Bridge is preferred over manual operator.' }
  }
  if (
    input.expectedCostClassificationByRoute.MANUAL_CLOUD_AGENT === 'ADDITIONAL_COST_REQUIRED' ||
    input.expectedCostClassificationByRoute.MANUAL_CLOUD_AGENT === 'BLOCKED_BY_COST_POLICY'
  ) {
    return {
      ok: false,
      reason: `Manual route cost is ${input.expectedCostClassificationByRoute.MANUAL_CLOUD_AGENT}.`,
    }
  }
  if (isAutomaticDispatchBlockedByCost(input.expectedCostClassificationByRoute.MANUAL_CLOUD_AGENT)) {
    return {
      ok: false,
      reason: `Manual route cost is ${input.expectedCostClassificationByRoute.MANUAL_CLOUD_AGENT}.`,
    }
  }
  return { ok: true, reason: 'Manual Cloud Agent fits branch/commit/PR or operator-assisted work.' }
}

function automationWebhookEligible(input: CursorRoutePolicyInput): { ok: boolean; reason: string } {
  if (!input.eventDriven) {
    return { ok: false, reason: 'Task is not event-driven.' }
  }
  if (!input.automationWebhookAvailable) {
    return { ok: false, reason: 'Automation webhook is unavailable.' }
  }
  if (input.requiresReliableCompletion) {
    return { ok: false, reason: 'Reliable completion is required — webhook is not suitable.' }
  }
  if (isAutomaticDispatchBlockedByCost(input.expectedCostClassificationByRoute.CURSOR_AUTOMATION_WEBHOOK)) {
    return {
      ok: false,
      reason: `Automation webhook cost is ${input.expectedCostClassificationByRoute.CURSOR_AUTOMATION_WEBHOOK}.`,
    }
  }
  if (input.environment === 'production') {
    return { ok: false, reason: 'Automation webhook is blocked in production.' }
  }
  return { ok: true, reason: 'Non-critical event-driven task may use webhook enqueue.' }
}

function eligibilityForRoute(
  route: ExecutionRoute,
  input: CursorRoutePolicyInput,
): { ok: boolean; reason: string } {
  switch (route) {
    case 'LOCAL_CURSOR_BRIDGE':
      return localBridgeEligible(input)
    case 'MANUAL_CLOUD_AGENT':
      return manualCloudAgentEligible(input)
    case 'CURSOR_AUTOMATION_WEBHOOK':
      return automationWebhookEligible(input)
    default:
      return { ok: false, reason: 'Unknown route.' }
  }
}

function reasonCodeForRoute(route: ExecutionRoute): CursorExecutionReasonCode {
  switch (route) {
    case 'LOCAL_CURSOR_BRIDGE':
      return 'LOCAL_AUTOMATION_PREFERRED'
    case 'MANUAL_CLOUD_AGENT':
      return 'MANUAL_OPERATOR_REQUIRED'
    case 'CURSOR_AUTOMATION_WEBHOOK':
      return 'COST_INCLUDED'
    default:
      return 'ROUTE_UNAVAILABLE'
  }
}

function buildAlternatives(
  input: CursorRoutePolicyInput,
  selected: ExecutionRoute | null,
): RouteAlternative[] {
  return ROUTE_PRIORITY.filter((route) => route !== selected).map((route) => {
    const check = eligibilityForRoute(route, input)
    return {
      route,
      reasonCode: check.ok ? reasonCodeForRoute(route) : 'ROUTE_UNAVAILABLE',
      explanation: check.reason,
    }
  })
}

function blockedDecision(
  input: CursorRoutePolicyInput,
  reasonCode: CursorExecutionReasonCode,
  explanation: string,
  costClassification: CostClassification,
  selectedRoute: ExecutionRoute | null = null,
  requiresOwnerApproval = false,
): ExecutionRouteDecision {
  return {
    selectedRoute,
    allowed: false,
    requiresOwnerApproval,
    costClassification,
    reasonCode,
    explanation,
    alternatives: buildAlternatives(input, selectedRoute),
  }
}

export function decideCursorExecutionRoute(input: CursorRoutePolicyInput): ExecutionRouteDecision {
  if (isProductionRepositoryWriteBlocked(input)) {
    return blockedDecision(
      input,
      'PRODUCTION_POLICY_BLOCK',
      'Production repository write requires Owner approval before route selection.',
      input.expectedCostClassificationByRoute.LOCAL_CURSOR_BRIDGE,
      null,
      true,
    )
  }

  const eligibleRoutes = ROUTE_PRIORITY.filter(
    (route) => eligibilityForRoute(route, input).ok,
  )

  if (eligibleRoutes.length === 0) {
    const allCostsBlocked = ROUTE_PRIORITY.every((route) =>
      isAutomaticDispatchBlockedByCost(input.expectedCostClassificationByRoute[route]),
    )
    if (allCostsBlocked) {
      return blockedDecision(
        input,
        'NO_COST_SAFE_ROUTE',
        'No route has a cost-safe classification for automatic dispatch.',
        'UNKNOWN_COST',
      )
    }
    return blockedDecision(
      input,
      'ROUTE_UNAVAILABLE',
      'No execution route is available for the given task constraints.',
      'INCLUDED_IN_SUBSCRIPTION',
    )
  }

  const selectedRoute = eligibleRoutes[0]
  const costClassification = input.expectedCostClassificationByRoute[selectedRoute]
  const eligibility = eligibilityForRoute(selectedRoute, input)

  if (selectedRoute === 'CURSOR_AUTOMATION_WEBHOOK' && input.requiresReliableCompletion) {
    return blockedDecision(
      input,
      'AUTOMATION_NOT_SUITABLE',
      'Automation webhook cannot be selected when reliable completion is required.',
      costClassification,
      null,
    )
  }

  const requiresOwnerApproval =
    (selectedRoute === 'MANUAL_CLOUD_AGENT' && !input.ownerApprovalGranted) ||
    (selectedRoute === 'CURSOR_AUTOMATION_WEBHOOK' &&
      input.requiresRepositoryWrite &&
      !input.ownerApprovalGranted)

  const allowed = !requiresOwnerApproval && !isAutomaticDispatchBlockedByCost(costClassification)

  let reasonCode = reasonCodeForRoute(selectedRoute)
  if (!allowed && requiresOwnerApproval) {
    reasonCode = 'OWNER_APPROVAL_REQUIRED'
  } else if (!allowed && isAutomaticDispatchBlockedByCost(costClassification)) {
    reasonCode =
      costClassification === 'UNKNOWN_COST'
        ? 'COST_UNKNOWN'
        : costClassification === 'ADDITIONAL_COST_REQUIRED'
          ? 'ADDITIONAL_COST_REQUIRED'
          : 'BLOCKED_BY_COST_POLICY'
  }

  return {
    selectedRoute,
    allowed,
    requiresOwnerApproval,
    costClassification,
    reasonCode,
    explanation: eligibility.reason,
    alternatives: buildAlternatives(input, selectedRoute),
  }
}
