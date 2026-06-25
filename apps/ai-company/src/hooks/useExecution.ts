import { useCallback, useEffect, useMemo, useState } from 'react'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import {
  cancelExecution,
  completeExecution,
  computeExecutionStats,
  enqueueTask,
  getExecutionById,
  getExecutionQueue,
  loadExecutions,
  retryExecution,
  type Execution,
  type ExecutionQueueScope,
  type ExecutionStats,
} from '../domain/execution'

export function useExecution(initialScope: ExecutionQueueScope = { kind: 'company' }) {
  const [scope, setScope] = useState<ExecutionQueueScope>(initialScope)
  const [executions, setExecutions] = useState<Execution[]>(() => {
    initializeCompanyEngine()
    return loadExecutions()
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    initializeCompanyEngine()
    setExecutions(loadExecutions())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-executions' ||
        event.key === 'ai-company-delivery-tasks' ||
        event.key === 'ai-company-executions-seeded'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const queue = useMemo(() => getExecutionQueue(scope), [executions, scope])
  const stats = useMemo(() => computeExecutionStats(scope), [executions, scope])

  const nextTasks = useMemo(
    () => queue.filter((item) => item.status === 'queued').slice(0, 8),
    [queue],
  )

  const runningNow = useMemo(
    () =>
      queue.filter(
        (item) =>
          item.status === 'running' ||
          item.status === 'preparing' ||
          item.status === 'waiting_approval' ||
          item.status === 'review',
      ),
    [queue],
  )

  const selected = useMemo(
    () => (selectedId ? getExecutionById(selectedId) : null),
    [selectedId, executions],
  )

  const enqueue = useCallback(
    (taskId: string) => {
      const created = enqueueTask(taskId)
      refresh()
      if (created) setSelectedId(created.id)
      return created
    },
    [refresh],
  )

  const cancel = useCallback(
    (id: string) => {
      const updated = cancelExecution(id)
      refresh()
      return updated
    },
    [refresh],
  )

  const retry = useCallback(
    (id: string) => {
      const updated = retryExecution(id)
      refresh()
      return updated
    },
    [refresh],
  )

  const complete = useCallback(
    (id: string) => {
      const updated = completeExecution(id)
      refresh()
      return updated
    },
    [refresh],
  )

  return {
    executions,
    queue,
    stats,
    nextTasks,
    runningNow,
    scope,
    setScope,
    selected,
    selectedId,
    setSelectedId,
    refresh,
    enqueueTask: enqueue,
    cancelExecution: cancel,
    retryExecution: retry,
    completeExecution: complete,
    getById: getExecutionById,
  }
}

export type { Execution, ExecutionQueueScope, ExecutionStats }
