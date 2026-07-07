/**
 * Cursor Automation Workflow V1 — snapshot builder (097C + 098A + 099A Submit).
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
import { buildCursorAutomationExpectedResult } from './cursorAutomationMockIngestion'
import { getCursorAutomationSubmitRunByLoopId } from './cursorAutomationSubmitStorage'
import { mapSubmitRunToWorkflowStatus } from './cursorAutomationSubmit'
import {
  CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
  CURSOR_AUTOMATION_WORKFLOW_VERSION,
  type CursorAutomationExpectedResult,
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
  submitStatus: CursorAutomationWorkflowStatus | null
}): CursorAutomationWorkflowStatus {
  if (input.submitStatus) return input.submitStatus
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
  submitStatus: CursorAutomationWorkflowStatus | null
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
  const submitted = Boolean(input.submitStatus)

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
          phase: submitted
            ? 'submitted'
            : approvalStatus === 'approved'
              ? 'approval_pending'
              : approvalStatus === 'rejected'
                ? 'cancelled'
                : 'blocked_v1',
          ok: submitted,
          error: submitted
            ? 'Handoff в submit pipeline (V1 stub — Cursor API не вызывается).'
            : approvalStatus === 'approved'
              ? 'Owner одобрил — нажмите «Отправить в Cursor Automation».'
              : approvalStatus === 'rejected'
                ? input.ownerApproval?.rejectionReason ?? 'Owner отклонил handoff.'
                : 'Ожидается решение Owner — Cursor API не вызывается.',
        }
      : null,
  }
}

function resolveExternalExecutorFromLoop(loop: MaxWorkerLoopRecord): {
  required: boolean
  reason: string | null
} {
  const plan = loop.decisionPlan
  if (plan) {
    if (plan.cursorAutomationRequired) {
      return {
        required: true,
        reason:
          plan.cursorAutomationReason ??
          plan.toolRegistryReason ??
          'Decision Plan: требуется Cursor Automation.',
      }
    }
    if (plan.toolRegistryRequired && plan.suggestedToolIds.includes('cursor-automation')) {
      return {
        required: true,
        reason: plan.toolRegistryReason ?? 'Decision Plan: Tool Registry → cursor-automation.',
      }
    }
    return { required: false, reason: null }
  }
  return detectExternalExecutorNeed(loop.input.taskText ?? '')
}

export function buildCursorAutomationWorkflowSnapshot(input: {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun | null
  report: Report | null
}): CursorAutomationWorkflowSnapshot {
  const { required: externalRequired, reason: needReason } = resolveExternalExecutorFromLoop(input.loop)
  const ownerApprovalFromPlan = input.loop.decisionPlan?.ownerApprovalRequired ?? false

  const workflowLog: CursorAutomationWorkflowLogEntry[] = [
    logEntry('owner_task', 'Задача Owner принята в MAX Worker Loop.'),
  ]

  if (input.loop.decisionPlan) {
    workflowLog.push(
      logEntry(
        'decision_plan',
        `Decision Plan · intent ${input.loop.decisionPlan.classifiedIntent} · ${input.loop.decisionPlan.primaryModel.label}`,
      ),
    )
    workflowLog.push(
      logEntry(
        'model_selection',
        `Model · ${input.loop.decisionPlan.primaryModel.ollamaTag}`,
      ),
    )
  }

  workflowLog.push(logEntry('max_ollama_analysis', 'MAX анализирует задачу через Local Ollama (Task Runner).'))

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
      submitRun: null,
      resultIntegration: null,
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
    workflowLog.push(logEntry('owner_approval', 'Owner одобрил — Ready for Cursor Automation.'))
  } else if (ownerApproval?.status === 'rejected') {
    workflowLog.push(
      logEntry('owner_approval', ownerApproval.rejectionReason ?? 'Owner отклонил handoff.', 'warn'),
    )
  }

  const submitRun =
    input.loop.status === 'completed' ? getCursorAutomationSubmitRunByLoopId(input.loop.id) : null

  const submitWorkflowStatus = mapSubmitRunToWorkflowStatus(submitRun)

  if (submitRun) {
    workflowLog.push(
      logEntry(
        'cursor_automation_mock',
        submitRun.adapterConnected
          ? `Submit ${submitRun.runId} — payload сохранён, ожидается adapter.`
          : `Submit ${submitRun.runId} — mock stub, payload готов к adapter.`,
      ),
    )
  }

  const expectedResult: CursorAutomationExpectedResult | null = handoff
    ? buildCursorAutomationExpectedResult(handoff.plan)
    : null

  const toolBranch = buildDisplayToolBranch({
    loop: input.loop,
    run: input.run,
    externalRequired,
    needReason,
    ownerApproval,
    submitStatus: submitWorkflowStatus,
  })

  const status = resolveWorkflowStatus({
    externalRequired,
    loopStatus: input.loop.status,
    ownerApproval,
    hasPlan: Boolean(plan),
    hasHandoff: Boolean(handoff),
    submitStatus: submitWorkflowStatus,
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
    expectedResult,
    mockIngestion: null,
    ownerApprovalRequired: ownerApprovalFromPlan || externalRequired,
    ownerApprovalStatus: mapOwnerApprovalStatus(ownerApproval),
    submitRun,
    resultIntegration: null,
    toolBranch,
    workflowLog,
  }
}
