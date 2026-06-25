import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeRunHistoryStats,
  ensureSeedRunHistory,
  filterRunHistory,
  getRunHistoryById,
  getRunHistoryByReportId,
  getRunHistoryForEmployee,
  loadRunHistory,
  searchRunHistory,
  type RunHistory,
  type RunHistoryFilter,
  type RunHistoryStats,
} from '../domain/run/runStorage'

export function useRunHistory(options?: { employeeId?: string }) {
  const [runs, setRuns] = useState(() => ensureSeedRunHistory())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RunHistoryFilter>({
    status: 'all',
    employeeId: options?.employeeId ?? 'all',
    workspaceId: 'all',
  })

  const refresh = useCallback(() => {
    ensureSeedRunHistory()
    setRuns(loadRunHistory())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-run-history' || event.key === 'ai-company-runtime-runs') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  useEffect(() => {
    if (options?.employeeId) {
      setFilter((current) => ({ ...current, employeeId: options.employeeId as string }))
    }
  }, [options?.employeeId])

  const scoped = useMemo(() => {
    if (options?.employeeId) {
      return getRunHistoryForEmployee(options.employeeId, runs)
    }
    return runs
  }, [runs, options?.employeeId])

  const filtered = useMemo(() => {
    const searched = searchRunHistory(scoped, query)
    return filterRunHistory(searched, filter)
  }, [scoped, query, filter])

  const stats = useMemo(() => computeRunHistoryStats(scoped), [scoped])

  return {
    runs: scoped,
    filtered,
    stats,
    query,
    setQuery,
    filter,
    setFilter,
    refresh,
    getById: (id: string) => getRunHistoryById(id, runs),
    getByReportId: (reportId: string) => getRunHistoryByReportId(reportId, runs),
    getForEmployee: (employeeId: string) => getRunHistoryForEmployee(employeeId, runs),
  }
}

export type { RunHistory, RunHistoryFilter, RunHistoryStats }
