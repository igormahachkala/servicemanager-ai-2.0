import { createCursorAutomationPlan, type CursorAutomationTask } from '../cursorAutomation'
import type { ToolRegistryInvokePlan } from './toolRegistryInvoke'
import { planToolRegistryInvoke } from './toolRegistryInvoke'
import type { ToolNeedSignalSource } from './toolRegistry'

/**
 * Bridge: Tool Registry invoke plan → Cursor Automation task draft.
 * V1: plan only — no Cursor API, no shell/git/docker.
 */
export function planCursorAutomationHandoff(params: {
  title: string
  instructions: string
  requestedByEmployeeId: string
  runtimeRunId?: string | null
  maxWorkerLoopId?: string | null
  projectId?: string | null
  workspaceId?: string | null
  needSignal?: ToolNeedSignalSource
  needReason?: string | null
}): { task: CursorAutomationTask; invokePlan: ToolRegistryInvokePlan } {
  const task = createCursorAutomationPlan({
    title: params.title,
    instructions: params.instructions,
    requestedByEmployeeId: params.requestedByEmployeeId,
    runtimeRunId: params.runtimeRunId ?? null,
    maxWorkerLoopId: params.maxWorkerLoopId ?? null,
    projectId: params.projectId ?? null,
    workspaceId: params.workspaceId ?? null,
    requiresOwnerApproval: true,
  })

  const invokePlan = planToolRegistryInvoke({
    toolId: 'cursor-automation',
    action: 'handoff',
    input: {
      cursorAutomationTaskId: task.id,
      title: task.title,
      repository: task.repository,
      trigger: task.trigger,
    },
    context: {
      employeeId: params.requestedByEmployeeId,
      runtimeRunId: params.runtimeRunId ?? null,
      maxWorkerLoopId: params.maxWorkerLoopId ?? null,
      workspaceId: params.workspaceId ?? null,
      projectId: params.projectId ?? null,
      taskId: null,
    },
    needSignal: params.needSignal ?? 'reasoning',
    needReason: params.needReason ?? 'Cursor Automation handoff after local Ollama reasoning',
  })

  return { task, invokePlan }
}
