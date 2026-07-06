/**
 * Cursor Automation Workflow V1 — snapshot builder (AI-COMPANY-097C).
 */

import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { MaxWorkerLoopRecord } from '../maxWorkerLoop/maxWorkerLoop'
import { buildWorkerLoopToolBranchSnapshot } from '../toolRegistry/toolRegistryWorkerLoopBridge'
import type { WorkerLoopToolBranchSnapshot } from '../toolRegistry/toolRegistryWorkerLoopBridge'
import { buildCursorAutomationHandoff } from './cursorAutomationHandoff'
import { ingestCursorAutomationMockResult } from './cursorAutomationMockIngestion'
import {
  buildCursorAutomationPlan,
  detectExternalExecutorNeed,
} from './cursorAutomationPlan'
import {
  CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
  CURSOR_AUTOMATION_WORKFLOW_VERSION,
  type CursorAutomationExpectedResult,
  type CursorAutomationHandoff,
  type CursorAutomationMockIngestion,
  type CursorAutomationPlan,
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

function resolveWorkflowStatus(input: {
  externalRequired: boolean
  loopStatus: MaxWorkerLoopRecord['status']
  mockIngestion: CursorAutomationMockIngestion | null
  handoff: CursorAutomationHandoff | null
  plan: CursorAutomationPlan | null
}): CursorAutomationWorkflowStatus {
  if (!input.externalRequired) return 'not_applicable'
  if (input.loopStatus === 'running' || input.loopStatus === 'queued') return 'analyzing'
  if (!input.plan) return 'external_executor_required'
  if (!input.handoff) return 'plan_ready'
  if (input.loopStatus !== 'completed') return 'awaiting_owner_approval'
  if (!input.mockIngestion) return 'handoff_ready'
  if (input.mockIngestion.ok) return 'mock_result_ready'
  return 'completed'
}

function buildDisplayToolBranch(input: {
  loop: MaxWorkerLoopRecord
  run: RuntimeRun | null
  externalRequired: boolean
  needReason: string | null
}): WorkerLoopToolBranchSnapshot | null {
  if (!input.externalRequired) return null

  const reasoning = {
    toolNeeded: true,
    toolNeededReason: input.needReason,
  }

  const branch = buildWorkerLoopToolBranchSnapshot({
    reasoning,
    safeMode: false,
    suggestedToolId: CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
    employeeId: input.loop.employeeId,
    runtimeRunId: input.run?.id ?? input.loop.runtimeRunId,
    maxWorkerLoopId: input.loop.id,
    workspaceId: input.loop.input.workspaceId,
    projectId: input.loop.input.projectId,
    taskId: input.loop.deliveryTaskId,
  })

  return {
    ...branch,
    ownerApproval: {
      required: true,
      status: input.loop.status === 'completed' ? 'pending' : 'pending',
      reason: input.needReason ?? 'Cursor Automation — одобрение Owner обязательно (V1 mock).',
      toolId: CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
      toolRequestId: null,
      approvalPagePath: '/ops/approvals',
      decidedAt: null,
      decidedBy: null,
    },
    invokeResult: branch.invokeResult
      ? {
          ...branch.invokeResult,
          phase: 'blocked_v1',
          ok: false,
          error: 'V1 mock — Cursor API не вызывается. Handoff подготовлен для Owner.',
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

  const handoff = buildCursorAutomationHandoff({
    loop: input.loop,
    plan,
    runtimeRunId: input.run?.id ?? input.loop.runtimeRunId,
  })
  workflowLog.push(
    logEntry('handoff_prepared', `Handoff ${handoff.handoffId} — prompt markdown готов (mock_v1).`),
  )

  workflowLog.push(
    logEntry(
      'owner_approval',
      'Ожидается одобрение Owner перед отправкой в Cursor Automation.',
    ),
  )

  let mockIngestion: CursorAutomationMockIngestion | null = null
  let expectedResult: CursorAutomationExpectedResult | null = null

  if (input.loop.status === 'completed') {
    workflowLog.push(
      logEntry(
        'cursor_automation_mock',
        'Mock: Cursor Automation «получил» handoff без реального API.',
      ),
    )
    mockIngestion = ingestCursorAutomationMockResult({ handoff, loop: input.loop })
    expectedResult = mockIngestion.result
    workflowLog.push(
      logEntry(
        'mock_pr_ingested',
        `Mock PR: ${expectedResult.pullRequest.url}`,
      ),
    )
    workflowLog.push(logEntry('max_acceptance', 'MAX принял mock-результат для Runtime Report.'))
    if (input.report) {
      workflowLog.push(logEntry('runtime_report', `Runtime Report ${input.report.id} связан с циклом.`))
    }
    workflowLog.push(logEntry('memory_evolution', 'Черновик Memory Evolution доступен в snapshot.'))
    workflowLog.push(logEntry('knowledge_candidate', 'Knowledge Candidate drafts сформированы.'))
  }

  const toolBranch = buildDisplayToolBranch({
    loop: input.loop,
    run: input.run,
    externalRequired,
    needReason,
  })

  const status = resolveWorkflowStatus({
    externalRequired,
    loopStatus: input.loop.status,
    mockIngestion,
    handoff,
    plan,
  })

  return {
    version: CURSOR_AUTOMATION_WORKFLOW_VERSION,
    status,
    externalExecutorRequired: true,
    needReason,
    suggestedToolId: CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
    plan,
    handoff,
    expectedResult,
    mockIngestion,
    ownerApprovalRequired: true,
    ownerApprovalStatus: 'pending',
    toolBranch,
    workflowLog,
  }
}
