import { useCallback, useEffect, useState } from 'react'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import {
  getDeliveryTasksByProjectId,
  loadDeliveryTasks,
  type DeliveryTask,
} from '../domain/tasks'

export function useProjectTasks(projectId: string | undefined) {
  const [tasks, setTasks] = useState<DeliveryTask[]>(() => {
    initializeCompanyEngine()
    return projectId ? getDeliveryTasksByProjectId(projectId) : []
  })

  const refresh = useCallback(() => {
    initializeCompanyEngine()
    setTasks(projectId ? getDeliveryTasksByProjectId(projectId) : loadDeliveryTasks())
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-delivery-tasks') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return { tasks, refresh }
}
