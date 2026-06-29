import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  TASK_RESULT_STATUSES,
  approveTaskResult,
  archiveTaskResult,
  computeTaskResultStats,
  createFollowUpTaskFromResult,
  filterTaskResults,
  getTaskResultById,
  initializeTaskResultEngine,
  loadTaskResults,
  rejectTaskResult,
  requestChangesOnTaskResult,
  searchTaskResults,
  sendTaskResultToCodex,
  sendTaskResultToQa,
  type TaskResult,
  type TaskResultFilter,
  type TaskResultStatus,
} from '../domain/taskResults'

export function useTaskResults(initialFilter?: Partial<TaskResultFilter>) {
  const [results, setResults] = useState<TaskResult[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TaskResultFilter>({
    status: initialFilter?.status ?? 'all',
    employeeId: initialFilter?.employeeId ?? 'all',
    workspaceId: initialFilter?.workspaceId ?? 'all',
    projectId: initialFilter?.projectId ?? 'all',
  })

  const refresh = useCallback(() => {
    initializeTaskResultEngine()
    setResults(loadTaskResults())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-task-results') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => {
    const byFilter = filterTaskResults(results, filter)
    return searchTaskResults(byFilter, query)
  }, [results, filter, query])

  const stats = useMemo(() => computeTaskResultStats(results), [results])

  const getById = useCallback((id: string) => getTaskResultById(id), [results])

  const actions = useMemo(
    () => ({
      approve: (id: string, comment?: string) => {
        const updated = approveTaskResult(id, { comment })
        refresh()
        return updated
      },
      requestChanges: (id: string, comment?: string) => {
        const updated = requestChangesOnTaskResult(id, { comment })
        refresh()
        return updated
      },
      reject: (id: string, comment?: string) => {
        const updated = rejectTaskResult(id, { comment })
        refresh()
        return updated
      },
      archive: (id: string, comment?: string) => {
        const updated = archiveTaskResult(id, comment)
        refresh()
        return updated
      },
      createFollowUp: (id: string, title?: string) => {
        const updated = createFollowUpTaskFromResult(id, title)
        refresh()
        return updated
      },
      sendToQa: (id: string, comment?: string) => {
        const updated = sendTaskResultToQa(id, comment)
        refresh()
        return updated
      },
      sendToCodex: (id: string, comment?: string) => {
        const updated = sendTaskResultToCodex(id, comment)
        refresh()
        return updated
      },
    }),
    [refresh],
  )

  const statuses: Array<TaskResultStatus | 'all'> = ['all', ...TASK_RESULT_STATUSES]

  return {
    results,
    filtered,
    stats,
    query,
    setQuery,
    filter,
    setFilter,
    refresh,
    getById,
    statuses,
    ...actions,
  }
}

export type { TaskResult, TaskResultFilter, TaskResultStatus }
