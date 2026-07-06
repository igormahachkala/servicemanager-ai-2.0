/**
 * Cursor Automation Workflow V1 — snapshot builder (AI-COMPANY-097C + 098A Owner Gate).
 */

import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import { buildWorkerLoopToolBranchSnapshot } from '../toolRegistry/toolRegistryWorkerLoopBridge'
import type { WorkerLoopToolBranchSnapshot } from '../toolRegistry/toolRegistryWorkerLoopBridge'
import { buildCursorAutomationHandoff } from './cursorAutomationHandoff'
import {
  getOrCreateCursorAutomationOwnerApproval,
  type CursorAutomationOwnerApprovalRecord,
} from './cursorAutomationOwnerApproval'
import {
  buildCursorAutomationPlan,
  detectExternalExecutorNeed,
} from './cursorAutomationPlan'
import {
  CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
  CURSOR_AUTOMATION_WORKFLOW_VERSION,
  type CursorAutomationWorkflowLogEntry,
  type CursorAutomationWorkflowSnapshot,
  type CursorAutomationWorkflowStatus,
} from './cursorAutomationTypes'

function logEntry(
  phase: CursorAutomationWorkflowLogEntry['phase'],
  message: string,
  level: CursorAutomationWorkflowLogEntry['level'] = 'info',
): CursorAutomationWorkflowLogEntry {
  return { at: new Date().toISOString(), phase, level, message }
}

function mapOwnerApprovalStatus(
  record: CursorAutomationOwnerApprovalRecord | null,
): CursorAutomationWorkflowSnapshot['ownerApprovalStatus'] {
  if (!record) return 'pending'
  return record.status
}

function resolveWorkflowStatus(input: {
  externalRequired: boolean
  loopStatus: MaxWorkerLoopRecord['status']
  ownerApproval: CursorAutomationOwnerApprovalRecord | null
  hasPlan: boolean
  hasHandoff: boolean
}): CursorAutomationWorkflowStatus {
  if (!input.externalRequired) return 'not_applicable'
  if (input.loopStatus === 'running' || input.loopStatus === 'queued') return 'analyzing'
  if (!input.hasPlan) return 'external_executor_required'
  if (input.ownerApproval?.status === 'rejected') return 'rejected'
  if (input.ownerApproval?.status === 'approved') return 'ready_for_cursor_automation'
  if (input.loopStatus === 'completed' && input.hasHandoff) return 'waiting_for_owner_approval'
  if (!input.hasHandoff) return 'plan_ready'
  return 'awaiting_owner_approval'
}

function buildDisplayToolBranch(input: {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun | null
  externalRequired: boolean
  needReason: string | null
  ownerApproval: CursorAutomationOwnerApprovalRecord | null
}): WorkerLoopToolBranchSnapshot | null {
  if (!input.externalRequired) return null

  const branch = buildWorkerLoopToolBranchSnapshot({
    reasoning: {
      toolNeeded: true,
      toolNeededReason: input.needReason,
    },
    safeMode: false,
    suggestedToolId: CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
    employeeId: input.loop.employeeId,
    runtimeRunId: input.run?.id ?? input.loop.runtimeRunId,
    maxWorkerLoopId: input.loop.id,
    workspaceId: input.loop.input.workspaceId,
    projectId: input.loop.input.projectId,
    taskId: input.loop.deliveryTaskId,
  })

  const approvalStatus = input.ownerApproval?.status ?? 'pending'

  return {
    ...branch,
    ownerApproval: {
      required: true,
      status: approvalStatus === 'approved' ? 'approved' : approvalStatus === 'rejected' ? 'rejected' : 'pending',
      reason: input.needReason ?? 'Cursor Automation — одобрение Owner обязательно.',
      toolId: CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
      toolRequestId: input.ownerApproval?.id ?? null,
      approvalPagePath: '/ops/approvals',
      decidedAt: input.ownerApproval?.decidedAt ?? null,
      decidedBy: input.ownerApproval?.decidedBy ?? null,
    },
    invokeResult: branch.invokeResult
      ? {
          ...branch.invokeResult,
          phase:
            approvalStatus === 'approved'
              ? 'approval_pending'
              : approvalStatus === 'rejected'
                ? 'cancelled'
                : 'blocked_v1',
          ok: false,
          error:
            approvalStatus === 'approved'
              ? 'Owner одобрил — готово к Cursor Automation (V2 adapter). API не вызывается.'
              : approvalStatus === 'rejected'
                ? input.ownerApproval?.rejectionReason ?? 'Owner отклонил handoff.'
                : 'Ожидается решение Owner — Cursor API не вызывается.',
        }
      : null,
  }
}

export function buildCursorAutomationWorkflowSnapshot(input: {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun | null
  report: Report | null
}): CursorAutomationWorkflowSnapshot {
  const taskText = input.loop.input.taskText ?? ''
  const { required: externalRequired, reason: needReason } = detectExternalExecutorNeed(taskText)

  const workflowLog: CursorAutomationWorkflowLogEntry[] = [
    logEntry('owner_task', 'Задача Owner принята в MAX Worker Loop.'),
    logEntry('max_ollama_analysis', 'MAX анализирует задачу через Local Ollama (Task Runner).'),
  ]

  if (!externalRequired) {
    workflowLog.push(
      logEntry(
        'external_executor_decision',
        'Внешний исполнитель не требуется — задача в пределах V1 safe reasoning.',
      ),
    )
    return {
      version: CURSOR_AUTOMATION_WORKFLOW_VERSION,
      status: 'not_applicable',
      externalExecutorRequired: false,
      needReason: null,
      suggestedToolId: null,
      plan: null,
      handoff: null,
      expectedResult: null,
      mockIngestion: null,
      ownerApprovalRequired: false,
      ownerApprovalStatus: 'none',
      toolBranch: null,
      workflowLog,
    }
  }

  workflowLog.push(
    logEntry(
      'external_executor_decision',
      needReason ?? 'MAX определил необходимость Cursor Automation.',
    ),
  )

  const plan = buildCursorAutomationPlan(input.loop)
  workflowLog.push(logEntry('automation_plan', `План Cursor Automation: ${plan.goal.slice(0, 80)}…`))

  const handoff =
    input.loop.status === 'completed'
      ? buildCursorAutomationHandoff({
          loop: input.loop,
          plan,
          runtimeRunId: input.run?.id ?? input.loop.runtimeRunId,
        })
      : null

  if (handoff) {
    workflowLog.push(
      logEntry('handoff_prepared', `Handoff ${handoff.handoffId} — prompt markdown готов.`),
    )
  }

  const ownerApproval =
    input.loop.status === 'completed'
      ? getOrCreateCursorAutomationOwnerApproval({
          maxWorkerLoopId: input.loop.id,
          runtimeRunId: input.run?.id ?? input.loop.runtimeRunId,
          handoffId: handoff?.handoffId ?? null,
        })
      : null

  if (ownerApproval?.status === 'pending') {
    workflowLog.push(
      logEntry(
        'owner_approval',
        'Waiting for Owner Approval — решение перед отправкой в Cursor Automation.',
      ),
    )
  } else if (ownerApproval?.status === 'approved') {
    workflowLog.push(
      logEntry(
        'owner_approval',
        'Owner одобрил — Ready for Cursor Automation (без вызова API в V1).',
      ),
    )
  } else if (ownerApproval?.status === 'rejected') {
    workflowLog.push(
      logEntry('owner_approval', ownerApproval.rejectionReason ?? 'Owner отклонил handoff.', 'warn'),
    )
  }

  const toolBranch = buildDisplayToolBranch({
    loop: input.loop,
    run: input.run,
    externalRequired,
    needReason,
    ownerApproval,
  })

  const status = resolveWorkflowStatus({
    externalRequired,
    loopStatus: input.loop.status,
    ownerApproval,
    hasPlan: Boolean(plan),
    hasHandoff: Boolean(handoff),
  })

  if (input.report && ownerApproval?.status === 'approved') {
    workflowLog.push(logEntry('runtime_report', `Runtime Report ${input.report.id} связан с циклом.`))
    workflowLog.push(logEntry('memory_evolution', 'Черновик Memory Evolution доступен в snapshot.'))
    workflowLog.push(logEntry('knowledge_candidate', 'Knowledge Candidate drafts сформированы.'))
  }

  return {
    version: CURSOR_AUTOMATION_WORKFLOW_VERSION,
    status,
    externalExecutorRequired: true,
    needReason,
    suggestedToolId: CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
    plan,
    handoff,
    expectedResult: null,
    mockIngestion: null,
    ownerApprovalRequired: true,
    ownerApprovalStatus: mapOwnerApprovalStatus(ownerApproval),
    toolBranch,
    workflowLog,
  }
}
