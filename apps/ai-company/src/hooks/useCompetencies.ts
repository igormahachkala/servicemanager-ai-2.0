import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Competency } from '../domain/competencies/competency'
import type { Certification } from '../domain/competencies/certification'
import type { LearningPath } from '../domain/competencies/learningPath'
import type { Skill } from '../domain/competencies/skill'
import {
  buildCompetencyStats,
  getEmployeeCompetencySnapshot,
  readCompetencyStorageKey,
  type CompetencyStats,
  type EmployeeCompetencySnapshot,
} from '../domain/competencies/competencyStorage'

export function useCompetencies(employeeId: string | undefined) {
  const [snapshot, setSnapshot] = useState<EmployeeCompetencySnapshot | null>(() =>
    employeeId ? getEmployeeCompetencySnapshot(employeeId) : null,
  )

  const refresh = useCallback(() => {
    if (!employeeId) {
      setSnapshot(null)
      return
    }
    setSnapshot(getEmployeeCompetencySnapshot(employeeId))
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

  const stats = useMemo<CompetencyStats | null>(
    () => (snapshot ? buildCompetencyStats(snapshot) : null),
    [snapshot],
  )

  return {
    skills: (snapshot?.skills ?? []) as Skill[],
    competencies: (snapshot?.competencies ?? []) as Competency[],
    certifications: (snapshot?.certifications ?? []) as Certification[],
    learningPath: (snapshot?.learningPath ?? {
      plannedSkills: [],
      completedSkills: [],
      recommendedSkills: [],
    }) as LearningPath,
    stats,
    refresh,
  }
}
