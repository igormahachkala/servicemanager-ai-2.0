/**
 * Cursor execution route policy + cost guard — unit tests (AI-COMPANY-109).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateCursorCostGuard } from './cursorCostGuard.ts'
import {
  decideCursorExecutionRoute,
  defaultExpectedCostByRoute,
} from './cursorExecutionRoutePolicy.ts'
import { evaluateCursorExecutionDispatch } from './cursorExecutionRoutePreflight.ts'
import type { CursorRoutePolicyInput } from './cursorExecutionRouteTypes.ts'

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

  it('4. reliable completion rejects Automation Webhook', () => {
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
    assert.equal(decision.reasonCode, 'ROUTE_UNAVAILABLE')
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
