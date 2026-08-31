/**
 * Tool Dispatcher — Ollama is routable (block 1 of the local analysis route).
 *
 * The adapter is not written yet; these tests pin the guarantee that a dispatch
 * reaches the ollama branch instead of dying as an unknown tool or falling into
 * the `default` arm of the switch.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dispatchToolRequest,
  dispatchToolRequestPlannedOnly,
} from '../toolDispatcher/toolDispatcherDispatch.ts'
import {
  getToolCapability,
  getToolDispatcherEntry,
  listToolDispatcherEntries,
} from '../toolDispatcher/toolDispatcherRegistry.ts'
import {
  TOOL_DISPATCHER_TOOL_IDS,
  type DispatchToolRequestInput,
} from '../toolDispatcher/toolDispatcherTypes.ts'

function ollamaDispatchInput(
  overrides: Partial<DispatchToolRequestInput> = {},
): DispatchToolRequestInput {
  return {
    toolId: 'ollama',
    action: 'analyze',
    title: 'Analyze dispatcher module',
    instructions: 'Read toolDispatcherDispatch.ts and report problems',
    requestedByEmployeeId: 'ag-builder',
    decidedByEmployeeId: 'ag-max',
    payload: { workItemId: 'wi-ollama-001' },
    context: { companyId: 'company-default', source: 'runtime' },
    ...overrides,
  }
}

describe('toolDispatcher accepts ollama', () => {
  it('ollama is a dispatcher tool id with a registry entry', () => {
    assert.ok(TOOL_DISPATCHER_TOOL_IDS.includes('ollama'))

    const entry = getToolDispatcherEntry('ollama')
    assert.ok(entry, 'ollama must be registered, otherwise dispatch fails as unknown tool')
    assert.equal(entry.status, 'available')
    assert.equal(entry.capability.isEmployee, false)
    assert.ok(entry.capability.supportedActions.includes('analyze'))

    // listToolDispatcherEntries() maps over the id list — a missing entry would
    // surface as undefined here rather than as a type error.
    assert.equal(listToolDispatcherEntries().filter(Boolean).length, TOOL_DISPATCHER_TOOL_IDS.length)
  })

  it('ollama capability resolves an endpoint instead of throwing on an unknown id', () => {
    const capability = getToolCapability('ollama')
    assert.ok(capability)
    assert.equal(capability.endpoint.configKey, 'VITE_TOOL_DISPATCHER_OLLAMA_BASE_URL')
    assert.match(capability.endpoint.submitPath, /^\/runtime\/ollama\//)
  })

  it('dispatchToolRequest routes ollama to its own branch, not to default', () => {
    const { request, result } = dispatchToolRequest(ollamaDispatchInput())

    assert.equal(request.toolId, 'ollama')
    assert.equal(result.toolId, 'ollama')
    assert.equal(result.status, 'accepted')
    assert.equal(result.error, null)

    // Accepted means dispatched, never analyzed: the result itself is the
    // envelope runOllamaAnalysis produces, so this output must stay pending.
    const output = result.output as Record<string, unknown>
    assert.equal(output.executionPending, true)
    assert.equal(output.plannedRoute, 'LOCAL_OLLAMA_ANALYSIS')
    assert.equal(output.analysisModel, 'qwen3-coder:30b')

    // The two failure modes block 1 removed — still gone.
    assert.doesNotMatch(result.error ?? '', /Unknown tool/)
    assert.doesNotMatch(result.error ?? '', /No dispatcher handler/)
  })

  it('dispatchToolRequestPlannedOnly accepts ollama without claiming an owner plan', () => {
    const { result } = dispatchToolRequestPlannedOnly(ollamaDispatchInput())

    assert.equal(result.status, 'accepted')
    assert.doesNotMatch(result.error ?? '', /Unknown tool/)

    // Ollama needs no Owner approval, so it must not land in the cursor plan shape.
    assert.notEqual(result.status, 'planned')
    const output = result.output as Record<string, unknown>
    assert.equal(output.lifecycleStatus, undefined)
    assert.equal(output.executionPending, true)
  })

  it('an explicit payload model overrides the default in the accepted result', () => {
    const { result } = dispatchToolRequest(
      ollamaDispatchInput({ payload: { model: 'deepseek-r1:8b' } }),
    )

    const output = result.output as Record<string, unknown>
    assert.equal(output.analysisModel, 'deepseek-r1:8b')
  })

  it('an unsupported ollama action still fails validation before the branch', () => {
    const { result } = dispatchToolRequest(ollamaDispatchInput({ action: 'handoff' }))

    assert.equal(result.status, 'failed')
    assert.match(result.error ?? '', /not supported by ollama/)
  })

  it('cursor dispatch is unchanged', () => {
    const { result } = dispatchToolRequest(
      ollamaDispatchInput({ toolId: 'cursor', action: 'handoff' }),
    )

    assert.equal(result.status, 'mock_completed')
    assert.equal(result.ok, true)
  })
})
