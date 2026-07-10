/**
 * Cursor Local Bridge — sync bridge state → ToolExecutionRun (AI-COMPANY-113E).
 */

import {
  getToolExecutionRun,
  markToolExecutionQueued,
  markToolExecutionRunning,
  recordToolExecutionResultFromBridge,
} from '../toolExecution/toolExecutionRunStorage'
import { TOOL_EXECUTION_RUN_SYNC_EVENT } from '../toolExecution/toolExecutionRunTypes'
import {
  enqueueCursorLocalBridgeRun,
  fetchCursorLocalBridgeRuns,
} from './cursorLocalBridgeClient'
import { CURSOR_BRIDGE_SYNC_EVENT } from './cursorLocalBridgeTypes'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CURSOR_BRIDGE_SYNC_EVENT))
  window.dispatchEvent(new Event(TOOL_EXECUTION_RUN_SYNC_EVENT))
}

export type QueueToolExecutionRunForBridgeInput = {
  runId: string
  title: string
  instructions: string
  expectedResult?: string
  fileScope?: string[]
  checks?: string[]
  employeeId?: string | null
  workItemId?: string | null
  companyId?: string | null
}

export async function queueToolExecutionRunForCursorBridge(
  input: QueueToolExecutionRunForBridgeInput,
): Promise<{ ok: boolean; error: string | null }> {
  const existing = getToolExecutionRun(input.runId)
  if (!existing || existing.status !== 'approved') {
    return { ok: false, error: `ToolExecutionRun ${input.runId} must be approved.` }
  }

  const outcome = await enqueueCursorLocalBridgeRun({
    runId: input.runId,
    title: input.title,
    instructions: input.instructions,
    expectedResult: input.expectedResult,
    fileScope: input.fileScope,
    checks: input.checks,
    employeeId: input.employeeId ?? existing.employeeId,
    workItemId: input.workItemId ?? existing.workItemId,
    companyId: input.companyId ?? existing.companyId,
  })

  if (!outcome.ok) {
    return { ok: false, error: outcome.error }
  }

  if (outcome.run && (outcome.run.status === 'queued' || outcome.run.status === 'opened')) {
    markToolExecutionQueued(input.runId, 'Queued via Cursor Local Bridge.')
  }

  emitSync()
  return { ok: true, error: null }
}

export async function syncCursorLocalBridgeToDomain(): Promise<number> {
  const bridgeRuns = await fetchCursorLocalBridgeRuns()
  let updated = 0

  for (const bridgeRun of bridgeRuns) {
    const toolRun = getToolExecutionRun(bridgeRun.runId)
    if (!toolRun) continue

    if (
      toolRun.status === 'approved' &&
      (bridgeRun.status === 'queued' || bridgeRun.status === 'opened')
    ) {
      if (markToolExecutionQueued(toolRun.id, 'Queued via Cursor Local Bridge.')) {
        updated += 1
      }
    }

    if (toolRun.status === 'queued' && bridgeRun.status === 'opened') {
      if (
        markToolExecutionRunning(
          toolRun.id,
          'Task package opened in Cursor; execution requires active Cursor session.',
        )
      ) {
        updated += 1
      }
    }

    if (bridgeRun.status === 'result_received' && bridgeRun.result) {
      const terminal =
        toolRun.status === 'result_received' ||
        toolRun.status === 'awaiting_employee_review' ||
        toolRun.status === 'accepted'
      if (!terminal) {
        const recorded = recordToolExecutionResultFromBridge({
          runId: toolRun.id,
          output: bridgeRun.result as unknown as Record<string, unknown>,
          deliveryMode: 'cursor_v1',
        })
        if (recorded) updated += 1
      }
    }
  }

  if (updated > 0) emitSync()
  return updated
}
