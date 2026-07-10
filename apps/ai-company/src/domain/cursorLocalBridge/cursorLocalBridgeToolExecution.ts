/**
 * Approved ToolExecutionRun → Cursor Local Bridge (AI-COMPANY-113E).
 */

import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { queueToolExecutionRunForCursorBridge } from './cursorLocalBridgeSync'

export async function bridgeApprovedRunToCursorLocalBridge(
  run: ToolExecutionRun,
): Promise<{ ok: boolean; error: string | null }> {
  if (run.status !== 'approved') {
    return { ok: false, error: `ToolExecutionRun ${run.id} must be approved (status: ${run.status}).` }
  }

  return queueToolExecutionRunForCursorBridge({
    runId: run.id,
    title: run.title,
    instructions: run.instructions,
    expectedResult: run.expectedResult,
    fileScope: run.fileScope,
    checks: run.checks,
    employeeId: run.employeeId,
    workItemId: run.workItemId,
    companyId: run.companyId,
  })
}
