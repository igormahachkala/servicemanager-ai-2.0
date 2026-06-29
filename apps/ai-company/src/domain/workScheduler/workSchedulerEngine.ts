import type { Execution } from '../execution/execution'
import { getExecutionById, loadExecutions } from '../execution/executionEngine'
import { emitEvent } from '../events/eventStorage'
import { emitNotification } from '../notifications/notificationStorage'
import type { Report } from '../reports/report'
import { loadReports } from '../reports/reportStorage'
import { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID } from '../projects/aiPhotoLabIds'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { getRuntimeRunById } from '../runtime/runtimeOrchestrator'
import {
  createFollowUpTaskFromResult,
  getTaskResultById,
  sendTaskResultToCodex,
  sendTaskResultToQa,
  type TaskResult,
} from '../taskResults/taskResultStorage'
import { addDeliveryTask, getDeliveryTaskById, loadDeliveryTasks, saveDeliveryTasks } from '../tasks/taskStorage'
import type { DeliveryTask } from '../tasks/task'
import { suggestModeForEmployee } from '../taskRunner/taskRunnerTemplates'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  countWorkSuggestionsByStatus,
  getWorkSchedulerPlanByTaskResultId,
  loadWorkSchedulerPlans,
  patchWorkSuggestion,
  upsertWorkSchedulerPlan,
} from './workSchedulerStorage'
import type {
  WorkSchedulerPlan,
  WorkSchedulerStats,
  WorkSuggestion,
  WorkSuggestionKind,
} from './workSchedulerTypes'

const OWNER_ID = 'owner'

function nowIso(): string {
  return new Date().toISOString()
}

function createSuggestionId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function createPlanId(): string {
  return `wsp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

type AnalysisContext = {
  result: TaskResult
  run: RuntimeRun | null
  report: Report | null
  task: DeliveryTask | null
  execution: Execution | null
}

function loadAnalysisContext(taskResultId: string): AnalysisContext | null {
  const result = getTaskResultById(taskResultId)
  if (!result) return null
  const run = result.runtimeRunId ? getRuntimeRunById(result.runtimeRunId) : null
  const report = result.reportId
    ? (loadReports().find((item) => item.id === result.reportId) ?? null)
    : null
  const task = result.taskId ? getDeliveryTaskById(result.taskId) : null
  const execution =
    loadExecutions().find(
      (item) =>
        item.taskId === result.taskId ||
        (result.runtimeRunId && item.runtimeRunId === result.runtimeRunId),
    ) ?? (result.taskId ? getExecutionById(`exec-${result.taskId}`) : null)

  return { result, run, report, task, execution }
}

function buildAnalysisSummary(ctx: AnalysisContext): string {
  const employee = resolveEmployee(ctx.result.employeeId)
  const parts = [
    `${employee?.codename ?? ctx.result.employeeId} completed runtime.`,
    ctx.task ? `Task "${ctx.task.title}" is ${ctx.task.status}.` : 'No linked delivery task.',
    ctx.execution ? `Execution ${ctx.execution.status}.` : 'Execution not linked.',
    ctx.report ? `Report draft: ${ctx.report.summary.slice(0, 120)}` : ctx.result.summary.slice(0, 120),
  ]
  if (ctx.result.findings.length > 0) {
    parts.push(`Findings: ${ctx.result.findings.slice(0, 2).join(' · ')}`)
  }
  return parts.join(' ')
}

function baseSuggestion(
  ctx: AnalysisContext,
  kind: WorkSuggestionKind,
  title: string,
  rationale: string,
  priority: WorkSuggestion['priority'],
  payload: Record<string, string | null> = {},
): WorkSuggestion {
  return {
    id: createSuggestionId(),
    kind,
    title,
    rationale,
    priority,
    status: 'pending_approval',
    employeeId: ctx.result.employeeId,
    taskResultId: ctx.result.id,
    runtimeRunId: ctx.result.runtimeRunId,
    taskId: ctx.result.taskId,
    projectId: ctx.result.projectId,
    workspaceId: ctx.result.workspaceId,
    payload,
    createdAt: nowIso(),
    decidedAt: null,
    decidedBy: null,
  }
}

function buildSuggestions(ctx: AnalysisContext): WorkSuggestion[] {
  const suggestions: WorkSuggestion[] = []
  const employeeId = ctx.result.employeeId
  const projectId = ctx.result.projectId ?? AI_PHOTO_LAB_PROJECT_ID
  const workspaceId = ctx.result.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID
  const nextMode = suggestModeForEmployee(employeeId)

  suggestions.push(
    baseSuggestion(
      ctx,
      'next_task',
      'Continue with next planning step',
      'Employee finished one run — propose the next scoped task without waiting for Owner paste.',
      'high',
      {
        employeeId,
        projectId,
        workspaceId,
        mode: nextMode,
        taskText: `Follow-up after "${ctx.result.title}": ${ctx.result.outputPreview ?? ctx.result.summary}`.slice(
          0,
          280,
        ),
      },
    ),
  )

  if (employeeId === 'ag-cto' || employeeId === 'ag-arch') {
    suggestions.push(
      baseSuggestion(
        ctx,
        'send_max',
        'Route technical audit to MAX',
        'Planning output should be validated by MAX before Codex or QA.',
        'high',
        { targetEmployeeId: 'ag-max' },
      ),
    )
  }

  if (employeeId !== 'ag-qa') {
    suggestions.push(
      baseSuggestion(
        ctx,
        'send_qa',
        'Send to QA review',
        'Runtime output is ready for Sentinel QA checklist validation.',
        'medium',
        {},
      ),
    )
  }

  if (employeeId === 'ag-max' || ctx.result.findings.some((item) => /codex|implement|code/i.test(item))) {
    suggestions.push(
      baseSuggestion(
        ctx,
        'send_codex',
        'Prepare Codex handoff',
        'Implementation work should go to Codex after Owner approval.',
        'high',
        {},
      ),
    )
  }

  const hasBlockers = ctx.result.findings.some((item) =>
    /blocker|risk|fix|changes/i.test(item),
  )
  if (hasBlockers || ctx.result.status === 'changes_requested') {
    suggestions.push(
      baseSuggestion(
        ctx,
        'create_follow_up',
        'Create follow-up task',
        'Findings mention risks or changes — track remediation as a follow-up.',
        'medium',
        { title: `Follow-up · ${ctx.result.title}` },
      ),
    )
  }

  if (ctx.task && ctx.task.status !== 'done') {
    suggestions.push(
      baseSuggestion(
        ctx,
        'complete_sprint_item',
        'Mark sprint item done',
        'Delivery task reached review — close sprint board item after Owner confirms output.',
        'medium',
        { taskId: ctx.task.id },
      ),
    )
  }

  return suggestions.slice(0, 5)
}

function emitSchedulerNotification(plan: WorkSchedulerPlan, message: string): void {
  const employee = resolveEmployee(plan.employeeId)
  const event = emitEvent({
    type: 'task.completed',
    sourceType: 'task_result',
    sourceId: plan.taskResultId,
    employeeId: plan.employeeId,
    workspaceId: plan.suggestions[0]?.workspaceId ?? null,
    reportId: null,
    metadata: {
      title: plan.suggestions[0]?.title ?? 'Work scheduler',
      message,
      planId: plan.id,
      source: 'work-scheduler',
    },
    severity: 'info',
  })

  emitNotification({
    type: 'task',
    severity: 'info',
    employeeId: plan.employeeId,
    projectId: plan.suggestions[0]?.projectId ?? null,
    workspaceId: plan.suggestions[0]?.workspaceId ?? null,
    title: `${employee?.codename ?? 'Employee'} · Next suggested actions`,
    summary: message,
    action: { href: `/ops/task-results/${encodeURIComponent(plan.taskResultId)}`, label: 'Review suggestions' },
    eventId: event.id,
  })
}

/** Analyze completed runtime output and propose Owner-approved next steps. */
export function generateWorkSchedulerPlan(taskResultId: string): WorkSchedulerPlan | null {
  const existing = getWorkSchedulerPlanByTaskResultId(taskResultId)
  if (existing) return existing

  const ctx = loadAnalysisContext(taskResultId)
  if (!ctx || !ctx.result.runtimeRunId) return null

  const plan: WorkSchedulerPlan = {
    id: createPlanId(),
    taskResultId: ctx.result.id,
    runtimeRunId: ctx.result.runtimeRunId,
    employeeId: ctx.result.employeeId,
    analysisSummary: buildAnalysisSummary(ctx),
    suggestions: buildSuggestions(ctx),
    createdAt: nowIso(),
  }

  upsertWorkSchedulerPlan(plan)
  emitSchedulerNotification(
    plan,
    `${plan.suggestions.length} next actions waiting for Owner approval.`,
  )
  return plan
}

function markDeliveryTaskDone(taskId: string): void {
  const tasks = loadDeliveryTasks()
  const index = tasks.findIndex((item) => item.id === taskId)
  if (index === -1) return
  const next = [...tasks]
  next[index] = { ...next[index], status: 'done', updatedAt: nowIso() }
  saveDeliveryTasks(next)
}

function executeSuggestionAction(
  plan: WorkSchedulerPlan,
  suggestion: WorkSuggestion,
  ownerComment?: string,
): void {
  const resultId = plan.taskResultId
  switch (suggestion.kind) {
    case 'send_qa':
      sendTaskResultToQa(resultId, ownerComment)
      break
    case 'send_codex':
      sendTaskResultToCodex(resultId, ownerComment)
      break
    case 'send_max': {
      const result = getTaskResultById(resultId)
      if (!result) break
      addDeliveryTask({
        projectId: result.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
        workspaceId: result.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
        title: `MAX audit · ${result.title}`,
        description: `Owner approved scheduler route to MAX.\n\n${result.summary}`,
        assigneeId: 'ag-max',
        priority: 'high',
        status: 'backlog',
        expectedOutput: 'Technical audit notes and handoff recommendations.',
      })
      break
    }
    case 'create_follow_up':
      createFollowUpTaskFromResult(resultId, suggestion.payload.title ?? undefined)
      break
    case 'complete_sprint_item':
      if (suggestion.payload.taskId) markDeliveryTaskDone(suggestion.payload.taskId)
      else if (suggestion.taskId) markDeliveryTaskDone(suggestion.taskId)
      break
    case 'next_task':
      break
    default:
      break
  }
}

export function approveWorkSuggestion(
  planId: string,
  suggestionId: string,
  ownerComment?: string,
): WorkSchedulerPlan | null {
  const plan = loadWorkSchedulerPlans().find((item) => item.id === planId)
  if (!plan) return null
  const suggestion = plan.suggestions.find((item) => item.id === suggestionId)
  if (!suggestion || suggestion.status !== 'pending_approval') return null

  executeSuggestionAction(plan, suggestion, ownerComment)

  return patchWorkSuggestion(planId, suggestionId, {
    status: 'executed',
    decidedAt: nowIso(),
    decidedBy: OWNER_ID,
  })
}

export function dismissWorkSuggestion(planId: string, suggestionId: string): WorkSchedulerPlan | null {
  const plan = loadWorkSchedulerPlans().find((item) => item.id === planId)
  if (!plan) return null
  const suggestion = plan.suggestions.find((item) => item.id === suggestionId)
  if (!suggestion || suggestion.status !== 'pending_approval') return null

  return patchWorkSuggestion(planId, suggestionId, {
    status: 'dismissed',
    decidedAt: nowIso(),
    decidedBy: OWNER_ID,
  })
}

export function computeWorkSchedulerStats(): WorkSchedulerStats {
  return {
    pending: countWorkSuggestionsByStatus('pending_approval'),
    executed: countWorkSuggestionsByStatus('executed'),
    dismissed: countWorkSuggestionsByStatus('dismissed'),
    totalPlans: loadWorkSchedulerPlans().length,
  }
}

export function buildRunTaskHref(suggestion: WorkSuggestion): string | null {
  if (suggestion.kind !== 'next_task') return null
  const params = new URLSearchParams()
  if (suggestion.payload.employeeId) params.set('employee', suggestion.payload.employeeId)
  if (suggestion.payload.projectId) params.set('project', suggestion.payload.projectId)
  if (suggestion.payload.workspaceId) params.set('workspace', suggestion.payload.workspaceId)
  if (suggestion.payload.mode) params.set('mode', suggestion.payload.mode)
  if (suggestion.payload.taskText) params.set('text', suggestion.payload.taskText)
  return `/ops/run-task?${params.toString()}`
}

export {
  getWorkSchedulerPlanByTaskResultId,
  listPendingWorkSuggestions,
  loadWorkSchedulerPlans,
} from './workSchedulerStorage'

export type { WorkSchedulerPlan, WorkSchedulerStats, WorkSuggestion, WorkSuggestionKind }
