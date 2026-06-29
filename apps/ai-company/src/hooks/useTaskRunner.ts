import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  defaultExpectedOutput,
  extractTitleFromTaskText,
  loadTaskRunnerHistory,
  startTaskRunner,
  suggestEmployeeForMode,
  suggestModeForEmployee,
  type TaskRunnerInput,
  type TaskRunnerMode,
  type TaskRunnerRecord,
  type TaskRunnerStartResult,
} from '../domain/taskRunner'
import {
  resolveRuntimeModelMode,
  suggestRuntimeModelMode,
  type RuntimeModelMode,
} from '../domain/runtime/runtimeModelRouting'
import type { DeliveryTaskPriority } from '../domain/tasks/task'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../domain/projects/aiPhotoLabIds'

export type TaskRunnerFormState = {
  taskText: string
  title: string
  mode: TaskRunnerMode
  modelMode: RuntimeModelMode
  employeeId: string
  projectId: string
  workspaceId: string
  priority: DeliveryTaskPriority
  expectedOutput: string
  constraints: string
}

const DEFAULT_FORM: TaskRunnerFormState = {
  taskText: '',
  title: '',
  mode: 'planning',
  modelMode: 'fast',
  employeeId: 'ag-cto',
  projectId: AI_PHOTO_LAB_PROJECT_ID,
  workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
  priority: 'high',
  expectedOutput: defaultExpectedOutput('planning'),
  constraints: 'Local AI Company only — no ServiceManager, no external tools, no deploy.',
}

export function useTaskRunner(initial?: Partial<TaskRunnerFormState>) {
  const [form, setForm] = useState<TaskRunnerFormState>({ ...DEFAULT_FORM, ...initial })
  const [history, setHistory] = useState<TaskRunnerRecord[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<TaskRunnerStartResult | null>(null)

  const refresh = useCallback(() => {
    setHistory(loadTaskRunnerHistory())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-task-runner-history') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const derivedTitle = useMemo(() => {
    if (form.title.trim()) return form.title.trim()
    if (!form.taskText.trim()) return ''
    return extractTitleFromTaskText(form.taskText)
  }, [form.title, form.taskText])

  const patchForm = useCallback((patch: Partial<TaskRunnerFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
  }, [])

  const setMode = useCallback((mode: TaskRunnerMode) => {
    const employeeId = suggestEmployeeForMode(mode)
    setForm((current) => ({
      ...current,
      mode,
      employeeId,
      modelMode: suggestRuntimeModelMode(employeeId),
      expectedOutput: current.expectedOutput.trim()
        ? current.expectedOutput
        : defaultExpectedOutput(mode),
    }))
  }, [])

  const setModelMode = useCallback((modelMode: RuntimeModelMode) => {
    setForm((current) => ({
      ...current,
      modelMode: resolveRuntimeModelMode(current.employeeId, modelMode),
    }))
  }, [])

  const setEmployeeId = useCallback((employeeId: string) => {
    setForm((current) => ({
      ...current,
      employeeId,
      mode: current.mode === DEFAULT_FORM.mode ? suggestModeForEmployee(employeeId) : current.mode,
      modelMode: suggestRuntimeModelMode(employeeId),
    }))
  }, [])

  const start = useCallback(async (): Promise<TaskRunnerStartResult> => {
    setRunning(true)
    setError(null)
    try {
      const input: TaskRunnerInput = {
        taskText: form.taskText,
        title: form.title.trim() || undefined,
        mode: form.mode,
        modelMode: form.modelMode,
        employeeId: form.employeeId,
        projectId: form.projectId,
        workspaceId: form.workspaceId,
        priority: form.priority,
        expectedOutput: form.expectedOutput,
        constraints: form.constraints,
      }
      const result = await startTaskRunner(input)
      setLastResult(result)
      refresh()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task run failed'
      setError(message)
      throw err
    } finally {
      setRunning(false)
    }
  }, [form, refresh])

  return {
    form,
    patchForm,
    setMode,
    setModelMode,
    setEmployeeId,
    derivedTitle,
    history,
    refresh,
    running,
    error,
    lastResult,
    start,
  }
}

export type { TaskRunnerRecord, TaskRunnerStartResult, TaskRunnerMode }
