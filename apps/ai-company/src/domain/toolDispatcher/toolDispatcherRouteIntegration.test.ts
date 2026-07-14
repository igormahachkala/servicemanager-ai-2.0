/**
 * Tool Dispatcher route preflight integration — unit tests (AI-COMPANY-109 / 109F).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dispatchToolRequestPlannedOnly } from '../toolDispatcher/toolDispatcherDispatch.ts'
import type { DispatchToolRequestInput } from '../toolDispatcher/toolDispatcherTypes.ts'

function baseDispatchInput(
  overrides: Partial<DispatchToolRequestInput> = {},
): DispatchToolRequestInput {
  return {
    toolId: 'cursor',
    action: 'handoff',
    title: 'Test cursor task',
    instructions: 'Update component styling',
    requestedByEmployeeId: 'ag-builder',
    decidedByEmployeeId: 'ag-max',
    payload: {
      workItemId: 'wi-test-001',
      awaitingOwner: true,
      fileScope: ['apps/ai-company/src/mobile/components/Test.tsx'],
    },
    context: {
      companyId: 'company-default',
      source: 'runtime',
    },
    ...overrides,
  }
}

describe('toolDispatcher route integration', () => {
  it('13. existing Local Bridge planned flow remains compatible', () => {
    const { result } = dispatchToolRequestPlannedOnly(baseDispatchInput())

    assert.equal(result.ok, true)
    assert.equal(result.status, 'planned')
    assert.equal(result.deliveryMode, 'planned_v1')

    const output = result.output as Record<string, unknown>
    const routeDecision = output.routeDecision as Record<string, unknown>

    assert.equal(routeDecision.selectedRoute, 'LOCAL_CURSOR_BRIDGE')
    assert.equal(routeDecision.allowed, true)
    assert.equal(routeDecision.reasonCode, 'LOCAL_AUTOMATION_PREFERRED')
    assert.equal(output.lifecycleStatus, 'awaiting_owner')
  })

  it('109F-10. blocked ToolResult.output is null', () => {
    const { result } = dispatchToolRequestPlannedOnly(
      baseDispatchInput({
        payload: {
          expectedCostClassificationByRoute: {
            LOCAL_CURSOR_BRIDGE: 'UNKNOWN_COST',
            MANUAL_CLOUD_AGENT: 'UNKNOWN_COST',
            CURSOR_AUTOMATION_WEBHOOK: 'UNKNOWN_COST',
          },
        },
      }),
    )

    assert.equal(result.ok, false)
    assert.equal(result.status, 'failed')
    assert.equal(result.output, null)
    assert.match(result.error ?? '', /NO_COST_SAFE_ROUTE/)
  })

  it('109F-2 integration. MANUAL path without approval returns planned awaiting_owner', () => {
    const { result } = dispatchToolRequestPlannedOnly(
      baseDispatchInput({
        payload: {
          localBridgeAvailable: false,
          requiresCommitOrPullRequest: true,
          ownerApprovalGranted: false,
          manualOperatorAvailable: true,
        },
      }),
    )

    assert.equal(result.ok, true)
    assert.equal(result.status, 'planned')
    const output = result.output as Record<string, unknown>
    assert.equal(output.lifecycleStatus, 'awaiting_owner')
    const routeDecision = output.routeDecision as Record<string, unknown>
    assert.equal(routeDecision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(routeDecision.reasonCode, 'OWNER_APPROVAL_REQUIRED')
  })
})
