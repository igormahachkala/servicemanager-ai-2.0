import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computeEvolutionStats,
  getEvolutionByRunId,
  getEvolutionForEmployee,
  getTodayEvolutionSummary,
  loadEvolutionRecords,
  type MemoryEvolutionRecord,
} from '../domain/memoryEvolution'

const EVOLUTION_SYNC_EVENT = 'ai-company-memory-evolution-sync'

export function dispatchMemoryEvolutionSync(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVOLUTION_SYNC_EVENT))
  }
}

export function useMemoryEvolution(options?: { employeeId?: string; runId?: string }) {
  const employeeId = options?.employeeId
  const runId = options?.runId

  const [records, setRecords] = useState<MemoryEvolutionRecord[]>(() =>
    employeeId ? getEvolutionForEmployee(employeeId) : loadEvolutionRecords(),
  )

  const refresh = useCallback(() => {
    setRecords(employeeId ? getEvolutionForEmployee(employeeId) : loadEvolutionRecords())
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onSync = () => refresh()
    window.addEventListener(EVOLUTION_SYNC_EVENT, onSync)
    return () => window.removeEventListener(EVOLUTION_SYNC_EVENT, onSync)
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-memory-evolution' ||
        event.key === 'ai-company-employee-memory' ||
        event.key === 'ai-company-knowledge'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const runEvolution = useMemo(
    () => (runId ? getEvolutionByRunId(runId) : null),
    [runId, records],
  )

  const today = useMemo(
    () => (employeeId ? getTodayEvolutionSummary(employeeId) : null),
    [employeeId, records],
  )

  const stats = useMemo(() => computeEvolutionStats(employeeId), [employeeId, records])

  return { records, runEvolution, today, stats, refresh }
}
