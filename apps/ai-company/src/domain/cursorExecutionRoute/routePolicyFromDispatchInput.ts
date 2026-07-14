/**
 * Map Tool Dispatcher request → Cursor route policy input (AI-COMPANY-109).
 */

import type { DispatchToolRequestInput } from '../toolDispatcher/toolDispatcherTypes'
import { defaultExpectedCostByRoute } from './cursorExecutionRoutePolicy'
import type {
  CursorExecutionEnvironment,
  CostClassification,
  CursorRoutePolicyInput,
  ExpectedCostByRoute,
  ExecutionRoute,
} from './cursorExecutionRouteTypes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key]
  return typeof value === 'boolean' ? value : undefined
}

function readEnvironment(payload: Record<string, unknown>): CursorExecutionEnvironment {
  const fromPayload = payload.environment
  if (fromPayload === 'dev' || fromPayload === 'stage' || fromPayload === 'production') {
    return fromPayload
  }

  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_COMPANY_ENVIRONMENT
      ? String(import.meta.env.VITE_AI_COMPANY_ENVIRONMENT).toLowerCase()
      : undefined

  if (fromEnv === 'stage' || fromEnv === 'production') return fromEnv
  return 'dev'
}

function readCostClassification(value: unknown): CostClassification | undefined {
  if (
    value === 'INCLUDED_IN_SUBSCRIPTION' ||
    value === 'UNKNOWN_COST' ||
    value === 'ADDITIONAL_COST_REQUIRED' ||
    value === 'BLOCKED_BY_COST_POLICY'
  ) {
    return value
  }
  return undefined
}

function readExpectedCostByRoute(payload: Record<string, unknown>): ExpectedCostByRoute {
  const defaults = defaultExpectedCostByRoute()
  const raw = payload.expectedCostClassificationByRoute
  if (!isRecord(raw)) return defaults

  const routes: ExecutionRoute[] = [
    'LOCAL_CURSOR_BRIDGE',
    'MANUAL_CLOUD_AGENT',
    'CURSOR_AUTOMATION_WEBHOOK',
  ]

  const merged = { ...defaults }
  for (const route of routes) {
    const cost = readCostClassification(raw[route])
    if (cost) merged[route] = cost
  }
  return merged
}

function inferRequiresRepositoryWrite(input: DispatchToolRequestInput): boolean {
  const payload = input.payload ?? {}
  if (readBoolean(payload, 'requiresRepositoryWrite') === true) return true
  if (input.action === 'code_change' || input.action === 'handoff') return true
  return Array.isArray(payload.fileScope) && payload.fileScope.length > 0
}

function inferRequiresCommitOrPullRequest(payload: Record<string, unknown>): boolean {
  if (readBoolean(payload, 'requiresCommitOrPullRequest') === true) return true
  if (readBoolean(payload, 'requiresPullRequest') === true) return true
  return false
}

function inferEventDriven(input: DispatchToolRequestInput, payload: Record<string, unknown>): boolean {
  if (readBoolean(payload, 'eventDriven') === true) return true
  return input.context?.source === 'scheduler'
}

function inferRequiresReliableCompletion(payload: Record<string, unknown>, eventDriven: boolean): boolean {
  const explicit = readBoolean(payload, 'requiresReliableCompletion')
  if (explicit !== undefined) return explicit
  return !eventDriven
}

function inferRequiresAutomaticExecution(payload: Record<string, unknown>): boolean {
  const explicit = readBoolean(payload, 'requiresAutomaticExecution')
  if (explicit !== undefined) return explicit
  if (readBoolean(payload, 'manualOnly') === true) return false
  return true
}

function inferAutomationWebhookAvailable(payload: Record<string, unknown>): boolean {
  const fromPayload = readBoolean(payload, 'automationWebhookAvailable')
  if (fromPayload !== undefined) return fromPayload

  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CURSOR_AUTOMATION_WEBHOOK_AVAILABLE
      ? String(import.meta.env.VITE_CURSOR_AUTOMATION_WEBHOOK_AVAILABLE).toLowerCase()
      : undefined

  return fromEnv === 'true' || fromEnv === '1'
}

function inferLocalBridgeAvailable(
  payload: Record<string, unknown>,
  environment: CursorExecutionEnvironment,
): boolean {
  const fromPayload = readBoolean(payload, 'localBridgeAvailable')
  if (fromPayload !== undefined) return fromPayload
  return environment === 'dev' || environment === 'stage'
}

export function buildCursorRoutePolicyInputFromDispatch(
  input: DispatchToolRequestInput,
): CursorRoutePolicyInput {
  const payload = input.payload ?? {}
  const environment = readEnvironment(payload)
  const eventDriven = inferEventDriven(input, payload)

  return {
    taskType: typeof payload.taskType === 'string' ? payload.taskType : input.action,
    requiresAutomaticExecution: inferRequiresAutomaticExecution(payload),
    requiresRepositoryWrite: inferRequiresRepositoryWrite(input),
    requiresCommitOrPullRequest: inferRequiresCommitOrPullRequest(payload),
    requiresReliableCompletion: inferRequiresReliableCompletion(payload, eventDriven),
    eventDriven,
    localBridgeAvailable: inferLocalBridgeAvailable(payload, environment),
    manualOperatorAvailable: readBoolean(payload, 'manualOperatorAvailable') ?? true,
    automationWebhookAvailable: inferAutomationWebhookAvailable(payload),
    ownerApprovalGranted:
      readBoolean(payload, 'ownerApprovalGranted') === true ||
      readBoolean(payload, 'awaitingOwner') !== true,
    expectedCostClassificationByRoute: readExpectedCostByRoute(payload),
    environment,
  }
}
