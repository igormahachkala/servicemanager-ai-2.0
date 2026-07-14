/**
 * Builder Automation Task Flow — Owner approval + autonomous dispatch (AI-COMPANY-113).
 */

import { getToolExecutionRun, upsertToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import { assignToolExecutionRunExecutionRoute } from '../manualCloudAgentImport/toolExecutionRunExecutionRoute'
import { runCursorAutomationWithDefaults } from '../cursorAutomationRunner/cursorAutomationRunnerDefaultDeps'
import type { RunCursorAutomationDeps } from '../cursorAutomationRunner/runCursorAutomation'
import {
  mergeRunOutput,
  patchBuilderAutomationTaskFlowMetadata,
  readBuilderAutomationTaskFlowMetadata,
  readRouteDecisionFromRunOutput,
} from './builderAutomationTaskFlowMetadata'
import { projectBuilderAutomationTaskFlowSnapshot } from './builderAutomationTaskFlowState'
import type { ApproveAndDispatchBuilderAutomationOutcome } from './builderAutomationTaskFlowTypes'

export async function approveAndDispatchBuilderAutomation(
  runId: string,
  runnerDeps?: Partial<RunCursorAutomationDeps>,
): Promise<ApproveAndDispatchBuilderAutomationOutcome> {
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

  const routeDecision = readRouteDecisionFromRunOutput(existing)
  if (routeDecision?.selectedRoute !== 'CURSOR_AUTOMATION_WEBHOOK') {
    return {
      ok: false,
      code: 'ROUTE_MISMATCH',
      message: `Route is ${routeDecision?.selectedRoute ?? 'unknown'} — CURSOR_AUTOMATION_WEBHOOK required.`,
    }
  }

  const metadata = readBuilderAutomationTaskFlowMetadata(existing)
  if (!metadata) {
    return {
      ok: false,
      code: 'METADATA_MISSING',
      message: 'Builder automation task metadata missing on ToolExecutionRun.',
    }
  }

  const now = new Date().toISOString()
  const approved = upsertToolExecutionRun({
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
        message: 'Owner approved autonomous Cursor Automation execution.',
      },
    ],
    updatedAt: now,
  })

  const routed =
    assignToolExecutionRunExecutionRoute(approved.id, 'CURSOR_AUTOMATION_WEBHOOK') ?? approved

  const nextMetadata = {
    ...metadata,
    ownerApprovedAt: now,
  }

  const prepared = upsertToolExecutionRun({
    ...routed,
    result: mergeRunOutput(
      routed,
      patchBuilderAutomationTaskFlowMetadata(nextMetadata, routed.result?.output ?? {}),
      false,
    ),
    updatedAt: now,
  })

  const dispatchOutcome = await runCursorAutomationWithDefaults(
    {
      run: prepared,
      routeDecision: {
        ...routeDecision,
        allowed: true,
        requiresOwnerApproval: false,
      },
      ownerApproved: true,
      repository: metadata.repository,
      baseBranch: metadata.baseBranch,
      environment: 'dev',
      constraints: [],
      requiredChecks: prepared.checks,
    },
    runnerDeps,
  )

  if (!dispatchOutcome.ok) {
    return {
      ok: false,
      code: dispatchOutcome.code,
      message: dispatchOutcome.message,
    }
  }

  const dispatchedMetadata = {
    ...nextMetadata,
    dispatchedAt: now,
  }

  const persisted = upsertToolExecutionRun({
    ...dispatchOutcome.run,
    result: mergeRunOutput(
      dispatchOutcome.run,
      patchBuilderAutomationTaskFlowMetadata(dispatchedMetadata, dispatchOutcome.run.result?.output ?? {}),
      false,
    ),
    updatedAt: now,
  })

  const snapshot = projectBuilderAutomationTaskFlowSnapshot({ run: persisted })

  return {
    ok: true,
    run: persisted,
    snapshot,
    backgroundComposerId: dispatchOutcome.backgroundComposerId,
  }
}
