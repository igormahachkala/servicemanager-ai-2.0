/**
 * Cursor execution route + cost guard — domain types (AI-COMPANY-109).
 * Path C architecture — policy and guard only; no Cursor launch.
 */

export const EXECUTION_ROUTES = [
  'LOCAL_CURSOR_BRIDGE',
  'MANUAL_CLOUD_AGENT',
  'CURSOR_AUTOMATION_WEBHOOK',
] as const

export type ExecutionRoute = (typeof EXECUTION_ROUTES)[number]

export const COST_CLASSIFICATIONS = [
  'INCLUDED_IN_SUBSCRIPTION',
  'UNKNOWN_COST',
  'ADDITIONAL_COST_REQUIRED',
  'BLOCKED_BY_COST_POLICY',
] as const

export type CostClassification = (typeof COST_CLASSIFICATIONS)[number]

export const CURSOR_EXECUTION_ENVIRONMENTS = ['dev', 'stage', 'production'] as const

export type CursorExecutionEnvironment = (typeof CURSOR_EXECUTION_ENVIRONMENTS)[number]

export const CURSOR_EXECUTION_REASON_CODES = [
  'COST_INCLUDED',
  'COST_UNKNOWN',
  'ADDITIONAL_COST_REQUIRED',
  'BLOCKED_BY_COST_POLICY',
  'OWNER_APPROVAL_REQUIRED',
  'LOCAL_AUTOMATION_PREFERRED',
  'MANUAL_OPERATOR_REQUIRED',
  'RELIABLE_COMPLETION_REQUIRED',
  'AUTOMATION_NOT_SUITABLE',
  'ROUTE_UNAVAILABLE',
  'PRODUCTION_POLICY_BLOCK',
  'NO_COST_SAFE_ROUTE',
] as const

export type CursorExecutionReasonCode = (typeof CURSOR_EXECUTION_REASON_CODES)[number]

export type ExpectedCostByRoute = Record<ExecutionRoute, CostClassification>

export type CursorRoutePolicyInput = {
  taskType: string
  requiresAutomaticExecution: boolean
  requiresRepositoryWrite: boolean
  requiresCommitOrPullRequest: boolean
  requiresReliableCompletion: boolean
  eventDriven: boolean
  localBridgeAvailable: boolean
  manualOperatorAvailable: boolean
  automationWebhookAvailable: boolean
  ownerApprovalGranted: boolean
  expectedCostClassificationByRoute: ExpectedCostByRoute
  environment: CursorExecutionEnvironment
}

/** Injected dispatch config — no Vite/env reads in domain mapper (AI-COMPANY-109F). */
export type CursorRoutePolicyDispatchConfig = {
  environment: CursorExecutionEnvironment
  automationWebhookAvailable: boolean
  localBridgeAvailable: boolean
  manualOperatorAvailable: boolean
  expectedCostClassificationByRoute: ExpectedCostByRoute
}

export type RouteAlternative = {
  route: ExecutionRoute
  reasonCode: CursorExecutionReasonCode
  explanation: string
}

export type ExecutionRouteDecision = {
  selectedRoute: ExecutionRoute | null
  allowed: boolean
  requiresOwnerApproval: boolean
  costClassification: CostClassification
  reasonCode: CursorExecutionReasonCode
  explanation: string
  alternatives: RouteAlternative[]
}

export type CursorCostGuardInput = {
  route: ExecutionRoute
  costClassification: CostClassification
  ownerApprovalGranted: boolean
  environment: CursorExecutionEnvironment
  requiresRepositoryWrite: boolean
}

export type CursorCostGuardResult = {
  allowed: boolean
  requiresOwnerApproval: boolean
  reasonCode: CursorExecutionReasonCode
  explanation: string
}

export type CursorExecutionDispatchDecision = {
  routeDecision: ExecutionRouteDecision
  costGuard: CursorCostGuardResult | null
  events: CursorExecutionRouteEvent[]
}

export const CURSOR_EXECUTION_ROUTE_EVENT_TYPES = [
  'route_decision_created',
  'route_blocked_by_cost',
  'owner_approval_required',
  'route_allowed',
  'production_policy_blocked',
] as const

export type CursorExecutionRouteEventType = (typeof CURSOR_EXECUTION_ROUTE_EVENT_TYPES)[number]

export type CursorExecutionRouteEvent = {
  type: CursorExecutionRouteEventType
  at: string
  reasonCode: CursorExecutionReasonCode
  selectedRoute: ExecutionRoute | null
  allowed: boolean
  requiresOwnerApproval: boolean
  costClassification: CostClassification
  environment: CursorExecutionEnvironment
}
