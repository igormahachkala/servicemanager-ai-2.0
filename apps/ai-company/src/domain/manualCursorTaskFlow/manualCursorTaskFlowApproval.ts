/**
 * Manual Cursor Task Flow — Owner approval (AI-COMPANY-112).
 */

import { getToolExecutionRun, upsertToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import { assignToolExecutionRunExecutionRoute } from '../manualCloudAgentImport/toolExecutionRunExecutionRoute'
import { generateCursorTaskPackageText } from './manualCursorTaskPackage'
import {
  mergeRunOutput,
  patchManualCursorTaskFlowMetadata,
  readManualCursorTaskFlowMetadata,
  readRouteDecisionFromRunOutput,
} from './manualCursorTaskFlowMetadata'
import { projectManualCursorTaskFlowSnapshot } from './manualCursorTaskFlowState'
import type { ApproveManualCursorOwnerExecutionOutcome } from './manualCursorTaskFlowTypes'

function approveWithoutLocalBridge(runId: string, message: string | null): ToolExecutionRun | null {
  const existing = getToolExecutionRun(runId)
  if (!existing || existing.status !== 'awaiting_owner') return null

  const now = new Date().toISOString()
  return upsertToolExecutionRun({
    ...existing,
    status: 'approved',
    approvedAt: now,
    error: null,
    history: [
      ...existing.history,
      {
        id: `hist-${Date.now()}`,
        status: 'approved',
        at: now,
        message: message?.trim() ?? 'Owner approved manual Cloud Agent execution.',
      },
    ],
    updatedAt: now,
  })
}

export function approveManualCursorOwnerExecution(
  runId: string,
): ApproveManualCursorOwnerExecutionOutcome {
  const existing = getToolExecutionRun(runId)
  if (!existing) {
    return { ok: false, code: 'RUN_NOT_FOUND', message: `ToolExecutionRun ${runId} not found.` }
  }

  if (existing.status !== 'awaiting_owner') {
    return {
      ok: false,
      code: 'NOT_AWAITING_OWNER',
      message: `ToolExecutionRun is ${existing.status}, not awaiting_owner.`,
    }
  }

  const route = readRouteDecisionFromRunOutput(existing)
  if (route?.selectedRoute !== 'MANUAL_CLOUD_AGENT') {
    return {
      ok: false,
      code: 'ROUTE_MISMATCH',
      message: `Route is ${route?.selectedRoute ?? 'unknown'} — MANUAL_CLOUD_AGENT required.`,
    }
  }

  const metadata = readManualCursorTaskFlowMetadata(existing)
  if (!metadata) {
    return {
      ok: false,
      code: 'ROUTE_MISMATCH',
      message: 'Manual Cursor task metadata missing on ToolExecutionRun.',
    }
  }

  const approved = approveWithoutLocalBridge(
    runId,
    'Owner approved MANUAL_CLOUD_AGENT execution — ready for Cursor task package.',
  )
  if (!approved) {
    return { ok: false, code: 'APPROVAL_FAILED', message: 'Could not approve ToolExecutionRun.' }
  }

  const routed = assignToolExecutionRunExecutionRoute(approved.id, 'MANUAL_CLOUD_AGENT')
  const baseRun = routed ?? approved

  const now = new Date().toISOString()
  const nextMetadata = {
    ...metadata,
    ownerApprovedAt: now,
    taskPackageGeneratedAt: now,
  }

  const persisted = upsertToolExecutionRun({
    ...baseRun,
    result: mergeRunOutput(
      baseRun,
      patchManualCursorTaskFlowMetadata(nextMetadata, baseRun.result?.output ?? {}),
      true,
    ),
    updatedAt: now,
  })

  const taskPackage = generateCursorTaskPackageText(persisted, nextMetadata)
  const snapshot = projectManualCursorTaskFlowSnapshot({ run: persisted })

  return { ok: true, run: persisted, taskPackage, snapshot }
}
