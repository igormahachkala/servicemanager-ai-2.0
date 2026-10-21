/**
 * Tool Execution Run bridge — tool-neutral entry point (block 4a).
 *
 * The point of these tests is the negative one: decoupling toolId must change
 * behaviour for a non-cursor tool and for nothing else, so the cursor
 * assertions here are the regression guard.
 */

import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { EMPLOYEE_ROUTE_IDS, resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver.ts'
import { createEmployeeWorkItem } from '../employeeWorkQueue/employeeWorkQueueStorage.ts'
import {
  requestBuilderCursorToolExecution,
  requestToolExecution,
} from './toolExecutionRunBridge.ts'

function installStorageMock(): void {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }

  ;(globalThis as { window?: Window; localStorage?: Storage }).window = {
    localStorage: storage as Storage,
    dispatchEvent: () => true,
    location: { origin: 'http://localhost:5174' },
  } as unknown as Window
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

let workItemId = ''

describe('requestToolExecution', () => {
  before(() => {
    installStorageMock()
    // assertWorkItemBinding demands a real work item owned by the builder.
    const workItem = createEmployeeWorkItem({
      employeeId: resolveCanonicalEmployeeId(EMPLOYEE_ROUTE_IDS.builder),
      title: 'Bridge test work item',
      companyId: 'company-default',
    })
    workItemId = workItem.id
  })

  function baseInput() {
    return {
      workItemId,
      title: 'Review the dispatcher',
      instructions: 'Look at toolDispatcherDispatch.ts and report problems',
      companyId: 'company-default',
    }
  }

  it('the cursor wrapper dispatches exactly as before', () => {
    const { run, dispatch } = requestBuilderCursorToolExecution(baseInput())

    assert.equal(dispatch.request.toolId, 'cursor')
    assert.equal(dispatch.request.action, 'handoff')
    assert.equal(run.toolId, 'cursor')
    assert.equal(run.status, 'awaiting_owner')
  })

  it('cursor still goes through the route preflight', () => {
    const { dispatch } = requestBuilderCursorToolExecution(baseInput())

    // A planned result with a routeDecision proves the cursor-only branch of the
    // dispatcher still runs — decoupling toolId must not bypass it.
    assert.equal(dispatch.result.status, 'planned')
    const output = dispatch.result.output as Record<string, unknown>
    assert.ok(output.routeDecision)
  })

  it('an explicit ollama toolId creates an ollama run with the analyze action', () => {
    const { run, dispatch } = requestToolExecution({ ...baseInput(), toolId: 'ollama' })

    assert.equal(dispatch.request.toolId, 'ollama')
    // Without the per-tool default this would fail validation as an
    // unsupported action before reaching the ollama branch.
    assert.equal(dispatch.request.action, 'analyze')
    assert.equal(dispatch.result.status, 'accepted')

    const output = dispatch.result.output as Record<string, unknown>
    assert.equal(output.executionPending, true)
    assert.equal(output.plannedRoute, 'LOCAL_OLLAMA_ANALYSIS')

    assert.equal(run.toolId, 'ollama')
    assert.equal(run.status, 'awaiting_owner')
  })

  it('an explicit action overrides the per-tool default', () => {
    const { dispatch } = requestToolExecution({
      ...baseInput(),
      toolId: 'cursor',
      action: 'plan',
    })

    assert.equal(dispatch.request.action, 'plan')
  })

  it('omitting toolId keeps the historical cursor default', () => {
    const { run } = requestToolExecution(baseInput())

    assert.equal(run.toolId, 'cursor')
  })

  describe('capability.requiresOwnerApproval + autonomy switch', () => {
    const KEY = 'AI_COMPANY_AUTO_APPROVE_SAFE_TOOLS'

    it('switch OFF: ollama still waits for the Owner (default lifecycle)', () => {
      delete process.env[KEY]
      const { run } = requestToolExecution({ ...baseInput(), toolId: 'ollama' })
      assert.equal(run.status, 'awaiting_owner')
    })

    it('switch ON: ollama (requiresOwnerApproval:false) is approved at creation', () => {
      process.env[KEY] = '1'
      try {
        const { run } = requestToolExecution({ ...baseInput(), toolId: 'ollama' })
        assert.equal(run.status, 'approved')
        assert.ok(run.history.some((h) => /Auto-approved/.test(h.message ?? '')))
      } finally {
        delete process.env[KEY]
      }
    })

    it('switch ON: cursor (requiresOwnerApproval:true) still waits for the Owner', () => {
      process.env[KEY] = '1'
      try {
        const { run } = requestBuilderCursorToolExecution(baseInput())
        assert.equal(run.status, 'awaiting_owner')
      } finally {
        delete process.env[KEY]
      }
    })
  })
})
