/**
 * Cursor execution route — structured observability events (AI-COMPANY-109).
 * Logs are not source of truth; route decision domain result is canonical.
 */

import type {
  CursorExecutionRouteEvent,
  CursorExecutionRouteEventType,
  CursorRoutePolicyInput,
  ExecutionRouteDecision,
} from './cursorExecutionRouteTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function baseEvent(
  type: CursorExecutionRouteEventType,
  input: CursorRoutePolicyInput,
  decision: ExecutionRouteDecision,
): CursorExecutionRouteEvent {
  return {
    type,
    at: nowIso(),
    reasonCode: decision.reasonCode,
    selectedRoute: decision.selectedRoute,
    allowed: decision.allowed,
    requiresOwnerApproval: decision.requiresOwnerApproval,
    costClassification: decision.costClassification,
    environment: input.environment,
  }
}

export function buildCursorExecutionRouteEvents(
  input: CursorRoutePolicyInput,
  decision: ExecutionRouteDecision,
): CursorExecutionRouteEvent[] {
  const events: CursorExecutionRouteEvent[] = [
    baseEvent('route_decision_created', input, decision),
  ]

  if (decision.reasonCode === 'PRODUCTION_POLICY_BLOCK') {
    events.push(baseEvent('production_policy_blocked', input, decision))
  }

  if (
    decision.reasonCode === 'COST_UNKNOWN' ||
    decision.reasonCode === 'ADDITIONAL_COST_REQUIRED' ||
    decision.reasonCode === 'BLOCKED_BY_COST_POLICY' ||
    decision.reasonCode === 'NO_COST_SAFE_ROUTE'
  ) {
    events.push(baseEvent('route_blocked_by_cost', input, decision))
  }

  if (decision.requiresOwnerApproval) {
    events.push(baseEvent('owner_approval_required', input, decision))
  }

  if (decision.allowed) {
    events.push(baseEvent('route_allowed', input, decision))
  }

  return events
}

export function formatCursorExecutionRouteEvent(event: CursorExecutionRouteEvent): string {
  return `[cursor-route:${event.type}] route=${event.selectedRoute ?? 'none'} allowed=${event.allowed} reason=${event.reasonCode} env=${event.environment}`
}
