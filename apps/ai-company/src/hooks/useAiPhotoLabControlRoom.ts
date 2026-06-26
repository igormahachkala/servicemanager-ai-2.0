import { useCallback, useEffect, useMemo, useState } from 'react'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import {
  buildAiPhotoLabControlRoom,
  type AiPhotoLabControlRoomSnapshot,
} from '../domain/projects/aiPhotoLabControlRoom'

const REFRESH_KEYS = [
  'ai-company-projects',
  'ai-company-delivery-tasks',
  'ai-company-executions',
  'ai-company-runtime-runs',
  'ai-company-reports',
  'ai-company-approvals',
  'ai-company-handoffs',
  'ai-company-presence',
] as const

export function useAiPhotoLabControlRoom() {
  const [snapshot, setSnapshot] = useState<AiPhotoLabControlRoomSnapshot | null>(() => {
    initializeCompanyEngine()
    return buildAiPhotoLabControlRoom()
  })

  const refresh = useCallback(() => {
    initializeCompanyEngine()
    setSnapshot(buildAiPhotoLabControlRoom())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && (REFRESH_KEYS as readonly string[]).includes(event.key)) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const stats = useMemo(() => {
    if (!snapshot) {
      return {
        tasksTotal: 0,
        tasksInProgress: 0,
        tasksBlocked: 0,
        codexItems: 0,
        demoReady: 0,
        demoTotal: 0,
        pendingDecisions: 0,
      }
    }
    return {
      tasksTotal: snapshot.tasks.length,
      tasksInProgress: snapshot.tasks.filter((item) => item.status === 'in_progress').length,
      tasksBlocked: snapshot.workNow.blocked.length,
      codexItems: snapshot.codexHandoff.length,
      demoReady: snapshot.demoChecklist.filter((item) => item.status === 'done').length,
      demoTotal: snapshot.demoChecklist.length,
      pendingDecisions: snapshot.ownerDecisions.length,
    }
  }, [snapshot])

  return { snapshot, stats, refresh }
}
