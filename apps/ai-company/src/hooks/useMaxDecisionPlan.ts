import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildMaxDecisionPlanView,
  type MaxDecisionPlanView,
} from '../domain/decisionPlan/decisionPlanViewModel'
import {
  DECISION_PLAN_SYNC_EVENT,
  getDecisionPlanByLoopId,
  getDecisionPlanByRuntimeRunId,
} from '../domain/decisionPlan/decisionPlanStorage'
import type { DecisionPlan } from '../domain/decisionPlan'
import { buildEmployeeBrainDecisionPlan } from '../domain/employeeBrain'
import type { MaxWorkerLoopRecord } from '../domain/maxWorkerLoop'
import { MAX_WORKER_EMPLOYEE_ID } from '../domain/maxWorkerLoop'
import type { RuntimeModelMode } from '../domain/runtime/runtimeModelRouting'

export type MaxDecisionPlanTaskInput = {
  taskText: string
  title?: string | null
  taskId?: string | null
  projectId?: string | null
  workspaceId?: string | null
  modelMode?: string | null
}

export type UseMaxDecisionPlanInput = {
  employeeId?: string
  task?: MaxDecisionPlanTaskInput | null
  loop?: MaxWorkerLoopRecord | null
  runtimeRunId?: string | null
}

function toRequestedModelMode(value: string | null | undefined): RuntimeModelMode | null {
  if (value === 'coding' || value === 'deep' || value === 'fast' || value === 'qa') {
    return value
  }
  return null
}

function buildPlanFromTask(employeeId: string, task: MaxDecisionPlanTaskInput): DecisionPlan {
  return buildEmployeeBrainDecisionPlan({
    task: {
      taskText: task.taskText,
      title: task.title ?? null,
      taskId: task.taskId ?? null,
      projectId: task.projectId ?? null,
      workspaceId: task.workspaceId ?? null,
      requestedModelMode: toRequestedModelMode(task.modelMode),
    },
    profile: employeeId === MAX_WORKER_EMPLOYEE_ID ? undefined : undefined,
  })
}

function resolveDecisionPlan(input: UseMaxDecisionPlanInput): {
  plan: DecisionPlan | null
  isPreview: boolean
  sourceLabel: string | null
} {
  const employeeId = input.employeeId ?? MAX_WORKER_EMPLOYEE_ID

  if (input.loop?.decisionPlan) {
    return {
      plan: input.loop.decisionPlan,
      isPreview: false,
      sourceLabel: 'План из Worker Loop',
    }
  }

  if (input.runtimeRunId) {
    const stored = getDecisionPlanByRuntimeRunId(input.runtimeRunId)
    if (stored) {
      return { plan: stored, isPreview: false, sourceLabel: 'План из Runtime run' }
    }
  }

  if (input.loop?.id) {
    const stored = getDecisionPlanByLoopId(input.loop.id)
    if (stored) {
      return { plan: stored, isPreview: false, sourceLabel: 'План из Worker Loop' }
    }

    if (input.loop.input.taskText.trim()) {
      return {
        plan: buildPlanFromTask(employeeId, {
          taskText: input.loop.input.taskText,
          title: input.loop.input.title,
          taskId: input.loop.id,
          projectId: input.loop.input.projectId,
          workspaceId: input.loop.input.workspaceId,
          modelMode: input.loop.input.modelMode,
        }),
        isPreview: true,
        sourceLabel: 'Предпросмотр по задаче цикла',
      }
    }
  }

  const taskText = input.task?.taskText?.trim()
  if (taskText) {
    return {
      plan: buildPlanFromTask(employeeId, { ...input.task!, taskText }),
      isPreview: true,
      sourceLabel: 'Предпросмотр до запуска',
    }
  }

  return { plan: null, isPreview: false, sourceLabel: null }
}

export function useMaxDecisionPlan(input: UseMaxDecisionPlanInput) {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onSync = () => refresh()
    window.addEventListener(DECISION_PLAN_SYNC_EVENT, onSync)
    return () => window.removeEventListener(DECISION_PLAN_SYNC_EVENT, onSync)
  }, [refresh])

  const resolved = useMemo(() => {
    void tick
    return resolveDecisionPlan(input)
  }, [
    tick,
    input.employeeId,
    input.runtimeRunId,
    input.loop?.id,
    input.loop?.decisionPlan,
    input.loop?.input.taskText,
    input.loop?.input.title,
    input.loop?.input.modelMode,
    input.task?.taskText,
    input.task?.title,
    input.task?.modelMode,
    input.task?.projectId,
    input.task?.workspaceId,
  ])

  const view = useMemo((): MaxDecisionPlanView | null => {
    if (!resolved.plan) return null
    return buildMaxDecisionPlanView(resolved.plan, {
      isPreview: resolved.isPreview,
      sourceLabel: resolved.sourceLabel ?? undefined,
    })
  }, [resolved])

  return {
    plan: resolved.plan,
    view,
    isPreview: resolved.isPreview,
    refresh,
  }
}
