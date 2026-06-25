import { useCallback, useEffect, useState } from 'react'
import type { ExperienceEvent } from '../domain/competencies/experienceEvent'
import {
  addExperienceEvent,
  getEmployeeCompetencySnapshot,
  readCompetencyStorageKey,
} from '../domain/competencies/competencyStorage'

export function useExperience(employeeId: string | undefined) {
  const [events, setEvents] = useState<ExperienceEvent[]>(() =>
    employeeId ? getEmployeeCompetencySnapshot(employeeId).experienceEvents : [],
  )

  const refresh = useCallback(() => {
    if (!employeeId) {
      setEvents([])
      return
    }
    setEvents(getEmployeeCompetencySnapshot(employeeId).experienceEvents)
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

  const add = useCallback(
    (input: Omit<ExperienceEvent, 'id' | 'createdAt'>) => {
      if (!employeeId) return null
      const snapshot = addExperienceEvent(employeeId, input)
      setEvents(snapshot.experienceEvents)
      return snapshot
    },
    [employeeId],
  )

  return { events, add, refresh }
}
