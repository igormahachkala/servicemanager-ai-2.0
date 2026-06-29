import { emitEvent } from '../events/eventStorage'
import {
  completeExecution,
  enqueueTask,
  linkRuntimeRun,
  markExecutionFailed,
  markExecutionRunning,
} from '../execution/executionEngine'
import { addDeliveryTask } from '../tasks/taskStorage'
import type { DeliveryTaskPriority } from '../tasks/task'
import { orchestrateRuntimeRun } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { TaskType } from '../runtime/runtimeStorage'
import {
  appendTaskRunnerRecord,
  parseTaskRunnerRecord,
  type TaskRunnerRecord,
  type TaskRunnerStatus,
} from './taskRunnerStorage'
import {
  buildTaskRunnerPrompt,
  extractTitleFromTaskText,
  mapModeToRuntimeTaskType,
  type TaskRunnerMode,
} from './taskRunnerTemplates'
import type { RuntimeModelMode } from '../runtime/runtimeModelRouting'

export type TaskRunnerInput = {
  taskText: string
  title?: string
  mode: TaskRunnerMode
  modelMode: RuntimeModelMode
  employeeId: string
  projectId: string
  workspaceId: string
  priority: DeliveryTaskPriority
  expectedOutput: string
  constraints: string
}

export type TaskRunnerStartResult = {
  record: TaskRunnerRecord
  run: RuntimeRun
}

function mapRunStatus(status: RuntimeRun['status']): TaskRunnerStatus {
  if (status === 'completed') return 'completed'
  if (status === 'waiting_approval') return 'waiting_approval'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'failed') return 'failed'
  return 'running'
}

function buildRecord(
  input: TaskRunnerInput,
  deliveryTaskId: string,
  executionId: string | null,
  run: RuntimeRun,
): TaskRunnerRecord {
  const now = new Date().toISOString()
  const title = (input.title?.trim() || extractTitleFromTaskText(input.taskText)).slice(0, 160)

  return {
    id: `task-runner-${run.id}`,
    title,
    taskText: input.taskText.trim(),
    mode: input.mode,
    employeeId: input.employeeId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    priority: input.priority,
    expectedOutput: input.expectedOutput.trim(),
    constraints: input.constraints.trim(),
    deliveryTaskId,
    executionId,
    runtimeRunId: run.id,
    reportId: run.reportId,
    status: mapRunStatus(run.status),
    createdAt: now,
    finishedAt: run.finishedAt,
  }
}

/** Launch a single employee task from Owner UI — delivery task + execution + runtime run. */
export async function startTaskRunner(input: TaskRunnerInput): Promise<TaskRunnerStartResult> {
  const taskText = input.taskText.trim()
  if (!taskText) {
    throw new Error('Task text is required')
  }

  const title = (input.title?.trim() || extractTitleFromTaskText(taskText)).slice(0, 160)
  const deliveryTaskId = `task-runner-${Date.now()}`
  const prompt = buildTaskRunnerPrompt(input)

  const task = addDeliveryTask({
    id: deliveryTaskId,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    title,
    description: taskText,
    assigneeId: input.employeeId,
    priority: input.priority,
    status: 'in_progress',
    expectedOutput: input.expectedOutput.trim() || `Deliver ${title} in ${input.mode} mode`,
  })

  emitEvent({
    type: 'task.created',
    sourceType: 'task',
    sourceId: task.id,
    employeeId: input.employeeId,
    workspaceId: input.workspaceId,
    reportId: null,
    metadata: {
      title,
      mode: input.mode,
      source: 'task-runner',
      projectId: input.projectId,
    },
    severity: 'info',
  })

  const execution = enqueueTask(task.id)
  if (execution) {
    markExecutionRunning(execution.id, '')
  }

  const run = await orchestrateRuntimeRun({
    employeeId: input.employeeId,
    workspaceId: input.workspaceId,
    taskId: task.id,
    taskType: mapModeToRuntimeTaskType(input.mode) as TaskType,
    modelMode: input.modelMode,
    prompt,
  })

  if (execution) {
    linkRuntimeRun(execution.id, run.id)
    if (run.status === 'completed') {
      completeExecution(execution.id)
    } else if (run.status === 'failed' || run.status === 'cancelled') {
      markExecutionFailed(execution.id)
    } else if (run.status === 'running') {
      markExecutionRunning(execution.id, run.id)
    }
  }

  if (run.status === 'completed') {
    emitEvent({
      type: 'task.completed',
      sourceType: 'task',
      sourceId: task.id,
      employeeId: input.employeeId,
      workspaceId: input.workspaceId,
      reportId: run.reportId,
      metadata: {
        title,
        mode: input.mode,
        runtimeRunId: run.id,
        source: 'task-runner',
      },
      severity: 'success',
    })
  }

  const record = buildRecord(input, task.id, execution?.id ?? null, run)
  appendTaskRunnerRecord(record)

  return { record, run }
}

export { parseTaskRunnerRecord, type TaskRunnerRecord, type TaskRunnerStatus, type TaskRunnerMode }
