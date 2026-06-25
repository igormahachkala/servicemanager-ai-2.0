import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  TOOL_EXECUTION_PROVIDERS,
  TOOL_EXECUTION_STATUSES,
  approveToolRequest,
  cancelToolRequest,
  computeToolExecutionStats,
  filterToolExecutions,
  initializeToolExecutionEngine,
  listToolExecutions,
  rejectToolRequest,
  submitToolRequest,
  type ToolExecution,
  type ToolExecutionFilter,
  type ToolExecutionProvider,
  type ToolExecutionStatus,
  type ToolRequest,
} from '../domain/toolExecution'

export function useToolExecution() {
  const [executions, setExecutions] = useState<ToolExecution[]>([])
  const [filter, setFilter] = useState<ToolExecutionFilter>({
    employeeId: 'all',
    provider: 'all',
    status: 'all',
    approval: 'all',
  })

  const refresh = useCallback(() => {
    initializeToolExecutionEngine()
    setExecutions(listToolExecutions())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-tool-executions') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const filtered = useMemo(() => filterToolExecutions(executions, filter), [executions, filter])
  const stats = useMemo(() => computeToolExecutionStats(executions), [executions])

  const submit = useCallback(
    (request: ToolRequest) => {
      const created = submitToolRequest(request)
      refresh()
      return created
    },
    [refresh],
  )

  const approve = useCallback(
    (executionId: string) => {
      const updated = approveToolRequest(executionId)
      refresh()
      return updated
    },
    [refresh],
  )

  const reject = useCallback(
    (executionId: string, reason: string) => {
      const updated = rejectToolRequest(executionId, 'owner', reason)
      refresh()
      return updated
    },
    [refresh],
  )

  const cancel = useCallback(
    (executionId: string) => {
      const updated = cancelToolRequest(executionId)
      refresh()
      return updated
    },
    [refresh],
  )

  const providers: Array<ToolExecutionProvider | 'all'> = ['all', ...TOOL_EXECUTION_PROVIDERS]
  const statuses: Array<ToolExecutionStatus | 'all'> = ['all', ...TOOL_EXECUTION_STATUSES]
  const employeeIds = useMemo(
    () => ['all', ...new Set(executions.map((item) => item.request.employeeId))],
    [executions],
  )

  return {
    executions,
    filtered,
    stats,
    filter,
    setFilter,
    refresh,
    submit,
    approve,
    reject,
    cancel,
    providers,
    statuses,
    employeeIds,
  }
}
