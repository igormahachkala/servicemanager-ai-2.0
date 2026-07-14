/**
 * Cursor execution route policy + cost guard — unit tests (AI-COMPANY-109 / 109F).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateCursorCostGuard } from './cursorCostGuard.ts'
import {
  decideCursorExecutionRoute,
  defaultExpectedCostByRoute,
} from './cursorExecutionRoutePolicy.ts'
import { evaluateCursorExecutionDispatch } from './cursorExecutionRoutePreflight.ts'
import { buildCursorRoutePolicyInputFromDispatch } from './routePolicyFromDispatchInput.ts'
import type { CursorRoutePolicyInput } from './cursorExecutionRouteTypes.ts'
import type { DispatchToolRequestInput } from '../toolDispatcher/toolDispatcherTypes.ts'

function baseInput(overrides: Partial<CursorRoutePolicyInput> = {}): CursorRoutePolicyInput {
  return {
    taskType: 'code_change',
    requiresAutomaticExecution: true,
    requiresRepositoryWrite: true,
    requiresCommitOrPullRequest: false,
    requiresReliableCompletion: true,
    eventDriven: false,
    localBridgeAvailable: true,
    manualOperatorAvailable: true,
    automationWebhookAvailable: false,
    ownerApprovalGranted: true,
    expectedCostClassificationByRoute: defaultExpectedCostByRoute(),
    environment: 'dev',
    ...overrides,
  }
}

const nodeTestConfig = {
  environment: 'dev' as const,
  automationWebhookAvailable: false,
  localBridgeAvailable: true,
  manualOperatorAvailable: true,
  expectedCostClassificationByRoute: defaultExpectedCostByRoute(),
}

describe('cursorExecutionRoutePolicy', () => {
  it('1. selects Local Bridge in DEV', () => {
    const decision = decideCursorExecutionRoute(baseInput({ environment: 'dev' }))
    assert.equal(decision.selectedRoute, 'LOCAL_CURSOR_BRIDGE')
    assert.equal(decision.allowed, true)
    assert.equal(decision.reasonCode, 'LOCAL_AUTOMATION_PREFERRED')
  })

  it('2. Local Bridge unavailable → Manual Cloud Agent requires approval', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        localBridgeAvailable: false,
        requiresCommitOrPullRequest: true,
        ownerApprovalGranted: false,
      }),
    ).routeDecision

    assert.equal(decision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(decision.allowed, false)
    assert.equal(decision.requiresOwnerApproval, true)
    assert.equal(decision.reasonCode, 'OWNER_APPROVAL_REQUIRED')
  })

  it('3. event-driven non-critical task allows Automation Webhook', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        requiresAutomaticExecution: false,
        requiresReliableCompletion: false,
        eventDriven: true,
        manualOperatorAvailable: false,
        automationWebhookAvailable: true,
        requiresRepositoryWrite: false,
        ownerApprovalGranted: true,
      }),
    ).routeDecision

    assert.equal(decision.selectedRoute, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(decision.allowed, true)
    assert.equal(decision.reasonCode, 'COST_INCLUDED')
  })

  it('4. reliable completion rejects Automation Webhook with semantic reason', () => {
    const decision = decideCursorExecutionRoute(
      baseInput({
        requiresAutomaticExecution: false,
        requiresReliableCompletion: true,
        eventDriven: true,
        automationWebhookAvailable: true,
        manualOperatorAvailable: false,
      }),
    )

    assert.notEqual(decision.selectedRoute, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(decision.reasonCode, 'RELIABLE_COMPLETION_REQUIRED')
  })

  it('5. UNKNOWN_COST blocks automatic dispatch', () => {
    const costs = defaultExpectedCostByRoute()
    costs.LOCAL_CURSOR_BRIDGE = 'UNKNOWN_COST'
    costs.MANUAL_CLOUD_AGENT = 'UNKNOWN_COST'
    costs.CURSOR_AUTOMATION_WEBHOOK = 'UNKNOWN_COST'

    const decision = evaluateCursorExecutionDispatch(
      baseInput({ expectedCostClassificationByRoute: costs }),
    ).routeDecision

    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'NO_COST_SAFE_ROUTE')
  })

  it('6. ADDITIONAL_COST_REQUIRED blocks automatic dispatch', () => {
    const costs = defaultExpectedCostByRoute()
    costs.LOCAL_CURSOR_BRIDGE = 'ADDITIONAL_COST_REQUIRED'
    costs.MANUAL_CLOUD_AGENT = 'ADDITIONAL_COST_REQUIRED'
    costs.CURSOR_AUTOMATION_WEBHOOK = 'ADDITIONAL_COST_REQUIRED'

    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        expectedCostClassificationByRoute: costs,
        localBridgeAvailable: false,
        requiresCommitOrPullRequest: true,
      }),
    ).routeDecision

    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'NO_COST_SAFE_ROUTE')
  })

  it('7. BLOCKED_BY_COST_POLICY excludes route', () => {
    const costs = defaultExpectedCostByRoute()
    costs.LOCAL_CURSOR_BRIDGE = 'BLOCKED_BY_COST_POLICY'
    costs.MANUAL_CLOUD_AGENT = 'BLOCKED_BY_COST_POLICY'
    costs.CURSOR_AUTOMATION_WEBHOOK = 'BLOCKED_BY_COST_POLICY'

    const decision = evaluateCursorExecutionDispatch(
      baseInput({ expectedCostClassificationByRoute: costs }),
    ).routeDecision

    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'NO_COST_SAFE_ROUTE')
  })

  it('8. manual route without approval requires approval', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        localBridgeAvailable: false,
        requiresCommitOrPullRequest: true,
        ownerApprovalGranted: false,
      }),
    ).routeDecision

    assert.equal(decision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(decision.requiresOwnerApproval, true)
    assert.equal(decision.reasonCode, 'OWNER_APPROVAL_REQUIRED')
  })

  it('9. production repository write without approval is blocked', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        environment: 'production',
        requiresRepositoryWrite: true,
        ownerApprovalGranted: false,
      }),
    ).routeDecision

    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'PRODUCTION_POLICY_BLOCK')
  })

  it('10. no safe route returns NO_COST_SAFE_ROUTE', () => {
    const costs = defaultExpectedCostByRoute()
    costs.LOCAL_CURSOR_BRIDGE = 'UNKNOWN_COST'
    costs.MANUAL_CLOUD_AGENT = 'UNKNOWN_COST'
    costs.CURSOR_AUTOMATION_WEBHOOK = 'UNKNOWN_COST'

    const decision = decideCursorExecutionRoute(
      baseInput({ expectedCostClassificationByRoute: costs }),
    )

    assert.equal(decision.selectedRoute, null)
    assert.equal(decision.reasonCode, 'NO_COST_SAFE_ROUTE')
  })

  it('11. automation unavailable selects Local Bridge alternative', () => {
    const decision = decideCursorExecutionRoute(
      baseInput({
        eventDriven: true,
        automationWebhookAvailable: false,
        requiresReliableCompletion: false,
      }),
    )

    assert.equal(decision.selectedRoute, 'LOCAL_CURSOR_BRIDGE')
    assert.equal(decision.reasonCode, 'LOCAL_AUTOMATION_PREFERRED')
  })

  it('12. cost included but all routes unavailable is blocked', () => {
    const decision = decideCursorExecutionRoute(
      baseInput({
        localBridgeAvailable: false,
        manualOperatorAvailable: false,
        automationWebhookAvailable: false,
      }),
    )

    assert.equal(decision.selectedRoute, null)
    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'ROUTE_UNAVAILABLE')
  })
})

describe('cursorExecutionRoutePolicy 109F review fixes', () => {
  it('109F-1. MANUAL + ownerApprovalGranted absent → approval required', () => {
    const input = baseInput({
      localBridgeAvailable: false,
      requiresCommitOrPullRequest: true,
    })
    delete (input as { ownerApprovalGranted?: boolean }).ownerApprovalGranted

    const policyInput: CursorRoutePolicyInput = { ...input, ownerApprovalGranted: false }
    const decision = evaluateCursorExecutionDispatch(policyInput).routeDecision

    assert.equal(decision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(decision.requiresOwnerApproval, true)
    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'OWNER_APPROVAL_REQUIRED')
  })

  it('109F-2. MANUAL + ownerApprovalGranted false → awaiting_owner path', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        localBridgeAvailable: false,
        requiresCommitOrPullRequest: true,
        ownerApprovalGranted: false,
      }),
    ).routeDecision

    assert.equal(decision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(decision.requiresOwnerApproval, true)
    assert.equal(decision.allowed, false)
  })

  it('109F-3. MANUAL + ownerApprovalGranted true → route allowed', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        localBridgeAvailable: false,
        requiresCommitOrPullRequest: true,
        ownerApprovalGranted: true,
      }),
    ).routeDecision

    assert.equal(decision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(decision.allowed, true)
    assert.equal(decision.requiresOwnerApproval, false)
    assert.equal(decision.reasonCode, 'MANUAL_OPERATOR_REQUIRED')
  })

  it('109F-4. production repository write + approval absent → PRODUCTION_POLICY_BLOCK', () => {
    const dispatchInput: DispatchToolRequestInput = {
      toolId: 'cursor',
      action: 'handoff',
      title: 'Prod change',
      instructions: 'Change prod file',
      requestedByEmployeeId: 'ag-builder',
      decidedByEmployeeId: 'ag-max',
      payload: {
        environment: 'production',
        requiresRepositoryWrite: true,
      },
    }

    const policyInput = buildCursorRoutePolicyInputFromDispatch(dispatchInput, {
      ...nodeTestConfig,
      environment: 'production',
    })

    assert.equal(policyInput.ownerApprovalGranted, false)

    const decision = evaluateCursorExecutionDispatch(policyInput).routeDecision
    assert.equal(decision.reasonCode, 'PRODUCTION_POLICY_BLOCK')
    assert.equal(decision.allowed, false)
  })

  it('109F-5. production repository write + approval false → blocked', () => {
    const decision = evaluateCursorExecutionDispatch(
      baseInput({
        environment: 'production',
        requiresRepositoryWrite: true,
        ownerApprovalGranted: false,
      }),
    ).routeDecision

    assert.equal(decision.allowed, false)
    assert.equal(decision.reasonCode, 'PRODUCTION_POLICY_BLOCK')
  })

  it('109F-6. reliable completion + webhook candidate → RELIABLE_COMPLETION_REQUIRED', () => {
    const decision = decideCursorExecutionRoute(
      baseInput({
        requiresAutomaticExecution: false,
        requiresReliableCompletion: true,
        eventDriven: true,
        automationWebhookAvailable: true,
        manualOperatorAvailable: false,
      }),
    )

    assert.equal(decision.reasonCode, 'RELIABLE_COMPLETION_REQUIRED')
    const webhookAlt = decision.alternatives.find(
      (item) => item.route === 'CURSOR_AUTOMATION_WEBHOOK',
    )
    assert.equal(webhookAlt?.reasonCode, 'RELIABLE_COMPLETION_REQUIRED')
  })

  it('109F-7. no dead branch — webhook never selected when reliable completion required', () => {
    const decision = decideCursorExecutionRoute(
      baseInput({
        requiresAutomaticExecution: false,
        requiresReliableCompletion: true,
        eventDriven: true,
        automationWebhookAvailable: true,
        manualOperatorAvailable: false,
      }),
    )

    assert.notEqual(decision.selectedRoute, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(decision.reasonCode, 'RELIABLE_COMPLETION_REQUIRED')
  })

  it('109F-8. UNKNOWN_COST alternative receives COST_UNKNOWN', () => {
    const costs = defaultExpectedCostByRoute()
    costs.CURSOR_AUTOMATION_WEBHOOK = 'UNKNOWN_COST'

    const decision = decideCursorExecutionRoute(
      baseInput({
        eventDriven: true,
        automationWebhookAvailable: true,
        requiresReliableCompletion: false,
        expectedCostClassificationByRoute: costs,
      }),
    )

    const webhookAlt = decision.alternatives.find(
      (item) => item.route === 'CURSOR_AUTOMATION_WEBHOOK',
    )
    assert.equal(webhookAlt?.reasonCode, 'COST_UNKNOWN')
  })

  it('109F-9. ADDITIONAL_COST_REQUIRED alternative receives matching reason', () => {
    const costs = defaultExpectedCostByRoute()
    costs.CURSOR_AUTOMATION_WEBHOOK = 'ADDITIONAL_COST_REQUIRED'

    const decision = decideCursorExecutionRoute(
      baseInput({
        eventDriven: true,
        automationWebhookAvailable: true,
        requiresReliableCompletion: false,
        expectedCostClassificationByRoute: costs,
      }),
    )

    const webhookAlt = decision.alternatives.find(
      (item) => item.route === 'CURSOR_AUTOMATION_WEBHOOK',
    )
    assert.equal(webhookAlt?.reasonCode, 'ADDITIONAL_COST_REQUIRED')
  })

  it('109F-11. config injection works in Node test without import.meta.env', () => {
    const dispatchInput: DispatchToolRequestInput = {
      toolId: 'cursor',
      action: 'handoff',
      title: 'Config test',
      instructions: 'Verify injected config',
      requestedByEmployeeId: 'ag-builder',
      decidedByEmployeeId: 'ag-max',
      payload: {},
    }

    const stageConfig = {
      ...nodeTestConfig,
      environment: 'stage' as const,
      automationWebhookAvailable: true,
      localBridgeAvailable: false,
    }

    const policyInput = buildCursorRoutePolicyInputFromDispatch(dispatchInput, stageConfig)
    assert.equal(policyInput.environment, 'stage')
    assert.equal(policyInput.automationWebhookAvailable, true)
    assert.equal(policyInput.localBridgeAvailable, false)
    assert.equal(policyInput.ownerApprovalGranted, false)
  })

  it('109F-12. awaitingOwner does not imply ownerApprovalGranted', () => {
    const dispatchInput: DispatchToolRequestInput = {
      toolId: 'cursor',
      action: 'handoff',
      title: 'Approval inference test',
      instructions: 'Must not infer approval',
      requestedByEmployeeId: 'ag-builder',
      decidedByEmployeeId: 'ag-max',
      payload: { awaitingOwner: true },
    }

    const policyInput = buildCursorRoutePolicyInputFromDispatch(dispatchInput, nodeTestConfig)
    assert.equal(policyInput.ownerApprovalGranted, false)
  })
})

describe('cursorCostGuard', () => {
  it('blocks UNKNOWN_COST with COST_UNKNOWN reason', () => {
    const result = evaluateCursorCostGuard({
      route: 'LOCAL_CURSOR_BRIDGE',
      costClassification: 'UNKNOWN_COST',
      ownerApprovalGranted: true,
      environment: 'dev',
      requiresRepositoryWrite: false,
    })
    assert.equal(result.allowed, false)
    assert.equal(result.reasonCode, 'COST_UNKNOWN')
  })
})
