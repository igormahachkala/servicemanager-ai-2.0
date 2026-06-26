import { useCallback, useEffect, useMemo, useState } from 'react'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import {
  CHANGE_EVENT,
  buildSprintSnapshot,
  buildSprintStats,
  getSprintById,
  loadSprints,
  type SprintSnapshot,
} from '../domain/sprint/sprintStorage'
import type { Sprint } from '../domain/sprint/sprint'

const REFRESH_KEYS = [
  'ai-company-sprints',
  'ai-company-delivery-tasks',
  'ai-company-projects',
] as const

export function useSprint(sprintId?: string) {
  const [sprints, setSprints] = useState<Sprint[]>(() => {
    initializeCompanyEngine()
    return loadSprints()
  })

  const refresh = useCallback(() => {
    initializeCompanyEngine()
    setSprints(loadSprints())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && (REFRESH_KEYS as readonly string[]).includes(event.key)) refresh()
    }
    const onChange = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [refresh])

  const listStats = useMemo(() => buildSprintStats(sprints), [sprints])

  const selected = useMemo(() => {
    const sprint = sprintId ? getSprintById(sprintId) : sprints[0] ?? null
    return sprint ? buildSprintSnapshot(sprint) : null
  }, [sprintId, sprints])

  return {
    sprints,
    selected,
    listStats,
    refresh,
  }
}

export type { SprintSnapshot }
