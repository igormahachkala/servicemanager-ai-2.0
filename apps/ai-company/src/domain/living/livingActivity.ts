import { getExecutionQueue } from '../execution'
import type { Execution, ExecutionStatus } from '../execution/execution'
import { getPresenceByEmployeeId, type EmployeePresence, type PresenceStatus } from '../presence/presence'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { RuntimePipelineStep } from '../runtime/runtimeState'
import { getDeliveryTaskById } from '../tasks/taskStorage'
import type { DeliveryTask } from '../tasks/task'
import type { TaskResult, TaskResultStatus } from '../taskResults/taskResult'

export type LivingPhase = 'working' | 'thinking' | 'waiting' | 'reviewing' | 'completed' | 'idle'

export type LivingActivitySource =
  | 'runtime'
  | 'execution'
  | 'task'
  | 'presence'
  | 'approval'
  | 'report'
  | 'task_result'

/** Structured activity derived from platform data — UI localizes via livingCompany i18n. */
export type LivingActivitySnapshot = {
  phase: LivingPhase
  source: LivingActivitySource
  employeeId: string | null
  taskId: string | null
  runId: string | null
  /** Task title or primary context label — never invented. */
  context: string
  /** Active runtime pipeline step id when source is runtime. */
  stepId: string | null
  detail: string | null
  progress: number | null
  since: string | null
}

const THINKING_STEPS = new Set([
  'load_employee',
  'load_workspace',
  'load_memory',
  'load_knowledge',
  'load_competencies',
  'load_runtime_profile',
  'run_model_router',
])

const WAITING_STEPS = new Set(['approval_check'])

function taskTitle(taskId: string | null | undefined): string | null {
  if (!taskId) return null
  return getDeliveryTaskById(taskId)?.title ?? taskId
}

function activePipelineStep(steps: RuntimePipelineStep[]): RuntimePipelineStep | null {
  const active = steps.find((step) => step.status === 'active')
  if (active) return active
  const pending = steps.find((step) => step.status === 'pending')
  return pending ?? null
}

export function pipelineProgress(steps: RuntimePipelineStep[]): number | null {
  if (steps.length === 0) return null
  const done = steps.filter((step) => step.status === 'done' || step.status === 'skipped').length
  return Math.round((done / steps.length) * 100)
}

function phaseFromRunStatus(status: RuntimeRun['status']): LivingPhase {
  if (status === 'completed') return 'completed'
  if (status === 'waiting_approval') return 'waiting'
  if (status === 'failed' || status === 'cancelled') return 'idle'
  if (status === 'queued' || status === 'preparing_context') return 'thinking'
  return 'working'
}

function phaseFromExecutionStatus(status: ExecutionStatus): LivingPhase {
  if (status === 'completed') return 'completed'
  if (status === 'waiting_approval') return 'waiting'
  if (status === 'review') return 'reviewing'
  if (status === 'preparing' || status === 'queued') return 'thinking'
  if (status === 'failed' || status === 'cancelled') return 'idle'
  return 'working'
}

function phaseFromPresenceStatus(status: PresenceStatus): LivingPhase {
  if (status === 'waiting_approval') return 'waiting'
  if (status === 'reviewing') return 'reviewing'
  if (status === 'in_discussion' || status === 'learning') return 'thinking'
  if (status === 'working' || status === 'busy') return 'working'
  if (status === 'available' || status === 'break' || status === 'offline') return 'idle'
  return 'working'
}

function phaseFromTaskResultStatus(status: TaskResultStatus): LivingPhase {
  if (status === 'ready_for_review') return 'waiting'
  if (status === 'changes_requested') return 'reviewing'
  if (status === 'approved') return 'completed'
  if (status === 'rejected') return 'idle'
  if (status === 'archived') return 'completed'
  return 'working'
}

function phaseFromPipelineStep(step: RuntimePipelineStep | null, runStatus: RuntimeRun['status']): LivingPhase {
  if (!step) return phaseFromRunStatus(runStatus)
  if (WAITING_STEPS.has(step.id) || step.status === 'pending' && step.id === 'approval_check') {
    return 'waiting'
  }
  if (THINKING_STEPS.has(step.id)) return 'thinking'
  if (step.id === 'create_report') return 'reviewing'
  if (step.status === 'done' && step.id === 'complete') return 'completed'
  return 'working'
}

function verbBucket(employeeId: string | null, context: string): string {
  const haystack = `${employeeId ?? ''} ${context}`.toLowerCase()
  if (employeeId === 'ag-cto' || haystack.includes('architect') || haystack.includes('architecture')) {
    return 'atlas'
  }
  if (
    employeeId === 'ag-max' ||
    haystack.includes('upload') ||
    haystack.includes('code audit') ||
    haystack.includes('handoff')
  ) {
    return 'max'
  }
  if (employeeId === 'ag-qa' || haystack.includes('qa') || haystack.includes('checklist') || haystack.includes('regression')) {
    return 'qa'
  }
  if (
    employeeId === 'ag-devops' ||
    haystack.includes('deploy') ||
    haystack.includes('devops') ||
    haystack.includes('health') ||
    haystack.includes('environment')
  ) {
    return 'devops'
  }
  return 'default'
}

export function resolveLivingActivityFromRun(run: RuntimeRun): LivingActivitySnapshot {
  const title = taskTitle(run.taskId)
  const step = activePipelineStep(run.pipeline)
  const phase = step ? phaseFromPipelineStep(step, run.status) : phaseFromRunStatus(run.status)
  const progress =
    run.status === 'completed'
      ? 100
      : run.status === 'failed' || run.status === 'cancelled'
        ? null
        : pipelineProgress(run.pipeline)

  return {
    phase,
    source: 'runtime',
    employeeId: run.employeeId,
    taskId: run.taskId,
    runId: run.id,
    context: title ?? step?.id ?? run.id,
    stepId: step?.id ?? null,
    detail: step?.detail ?? null,
    progress,
    since: run.startedAt,
  }
}

export function resolveLivingActivityFromExecution(execution: Execution): LivingActivitySnapshot {
  const title = taskTitle(execution.taskId)
  return {
    phase: phaseFromExecutionStatus(execution.status),
    source: 'execution',
    employeeId: execution.employeeId,
    taskId: execution.taskId,
    runId: execution.runtimeRunId,
    context: title ?? execution.taskId,
    stepId: null,
    detail: null,
    progress: execution.status === 'completed' ? 100 : null,
    since: execution.startedAt ?? execution.updatedAt,
  }
}

export function resolveLivingActivityFromTask(task: DeliveryTask): LivingActivitySnapshot {
  let phase: LivingPhase = 'idle'
  if (task.status === 'in_progress') phase = 'working'
  if (task.status === 'review') phase = 'reviewing'
  if (task.status === 'done') phase = 'completed'
  if (task.status === 'blocked') phase = 'waiting'

  return {
    phase,
    source: 'task',
    employeeId: task.assigneeId,
    taskId: task.id,
    runId: null,
    context: task.title,
    stepId: null,
    detail: task.expectedOutput,
    progress: task.status === 'done' ? 100 : task.status === 'review' ? 85 : null,
    since: task.updatedAt,
  }
}

export function resolveLivingActivityFromTaskResult(result: TaskResult): LivingActivitySnapshot {
  return {
    phase: phaseFromTaskResultStatus(result.status),
    source: 'task_result',
    employeeId: result.employeeId,
    taskId: result.taskId,
    runId: result.runtimeRunId,
    context: result.title,
    stepId: null,
    detail: result.outputPreview,
    progress: result.status === 'approved' ? 100 : result.status === 'ready_for_review' ? 90 : null,
    since: result.updatedAt,
  }
}

export function resolveLivingActivityFromPresence(presence: EmployeePresence): LivingActivitySnapshot {
  if (presence.currentRunId) {
    const run = loadRuntimeRuns().find((item) => item.id === presence.currentRunId)
    if (run) return resolveLivingActivityFromRun(run)
  }

  if (presence.currentTaskId) {
    const task = getDeliveryTaskById(presence.currentTaskId)
    if (task) return resolveLivingActivityFromTask(task)
  }

  return {
    phase: phaseFromPresenceStatus(presence.status),
    source: 'presence',
    employeeId: presence.employeeId,
    taskId: presence.currentTaskId,
    runId: presence.currentRunId,
    context: presence.activity,
    stepId: null,
    detail: null,
    progress: null,
    since: presence.startedAt,
  }
}

export function resolveLivingActivityForEmployee(employeeId: string): LivingActivitySnapshot | null {
  const runs = loadRuntimeRuns().filter((item) => item.employeeId === employeeId)
  const activeRun =
    runs.find((item) => item.status === 'running' || item.status === 'waiting_approval') ??
    runs.find((item) => item.status === 'preparing_context' || item.status === 'queued') ??
    null
  if (activeRun) return resolveLivingActivityFromRun(activeRun)

  const execution = getExecutionQueue({ kind: 'employee', employeeId }).find((item) =>
    ['running', 'preparing', 'waiting_approval', 'review', 'queued'].includes(item.status),
  )
  if (execution) return resolveLivingActivityFromExecution(execution)

  const presence = getPresenceByEmployeeId(employeeId)
  if (presence && presence.status !== 'offline' && presence.status !== 'available') {
    return resolveLivingActivityFromPresence(presence)
  }

  return null
}

export function livingVerbBucket(snapshot: LivingActivitySnapshot): string {
  return verbBucket(snapshot.employeeId, snapshot.context)
}

export function presenceActivityFromLiving(snapshot: LivingActivitySnapshot): string {
  if (snapshot.phase === 'waiting') return `Waiting: ${snapshot.context}`
  if (snapshot.phase === 'thinking' && snapshot.stepId) {
    return `Preparing: ${snapshot.stepId.replace(/_/g, ' ')}`
  }
  if (snapshot.phase === 'reviewing' && snapshot.stepId === 'create_report') {
    return `Report: ${snapshot.context}`
  }
  if (snapshot.phase === 'completed') return `Completed: ${snapshot.context}`
  return snapshot.context
}

export function formatLivingRelativeTime(iso: string | null): string | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return null
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
