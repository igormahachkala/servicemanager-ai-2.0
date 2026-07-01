import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildEmployeeTimeline,
  filterEmployeeTimelineByPeriod,
  summarizeEmployeeTimeline,
  type EmployeeTimelineEntry,
  type EmployeeTimelinePeriod,
  type EmployeeTimelineSummary,
} from '../domain/employeeTimeline'
import { resolveCanonicalEmployeeId } from '../mission-control/data/employeeIdResolver'

const STORAGE_KEYS = [
  'ai-company-events',
  'ai-company-runtime-runs',
  'ai-company-task-results',
  'ai-company-handoffs',
  'ai-company-memory-evolution',
  'ai-company-approvals',
] as const

export function useEmployeeTimeline(employeeId: string) {
  const canonicalId = useMemo(() => resolveCanonicalEmployeeId(employeeId), [employeeId])
  const [period, setPeriod] = useState<EmployeeTimelinePeriod>('week')
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => {
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && (STORAGE_KEYS as readonly string[]).includes(event.key)) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const allEntries = useMemo(() => {
    void revision
    return buildEmployeeTimeline(canonicalId)
  }, [canonicalId, revision])

  const entries = useMemo(
    () => filterEmployeeTimelineByPeriod(allEntries, period),
    [allEntries, period],
  )

  const summary = useMemo<EmployeeTimelineSummary>(
    () => summarizeEmployeeTimeline(allEntries),
    [allEntries],
  )

  return {
    entries,
    allEntries,
    summary,
    period,
    setPeriod,
    refresh,
  }
}

export type { EmployeeTimelineEntry, EmployeeTimelinePeriod, EmployeeTimelineSummary }
