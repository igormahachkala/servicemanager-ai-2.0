import { useCallback, useEffect, useState } from 'react'
import type { Reputation } from '../domain/competencies/reputation'
import {
  getEmployeeCompetencySnapshot,
  readCompetencyStorageKey,
} from '../domain/competencies/competencyStorage'

export function useReputation(employeeId: string | undefined) {
  const [reputation, setReputation] = useState<Reputation | null>(() =>
    employeeId ? getEmployeeCompetencySnapshot(employeeId).reputation : null,
  )

  const refresh = useCallback(() => {
    if (!employeeId) {
      setReputation(null)
      return
    }
    setReputation(getEmployeeCompetencySnapshot(employeeId).reputation)
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === readCompetencyStorageKey()) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return { reputation, refresh }
}
