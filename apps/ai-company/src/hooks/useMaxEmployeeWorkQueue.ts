import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EMPLOYEE_WORK_QUEUE_STORAGE_KEY,
  EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
} from '../domain/employeeWorkQueue'
import { buildMaxWorkspaceWorkQueueView } from '../domain/maxWorkspace/maxWorkspaceWorkQueueViewModel'
import {
  runMaxEmployeeWorkQueueAll,
  runMaxEmployeeWorkQueueNextItem,
  seedMaxEmployeeTestWorkItem,
  type MaxWorkQueueRunAllResult,
  type MaxWorkQueueRunResult,
} from '../domain/maxWorkspace/maxWorkspaceWorkQueueRunner'
import { MAX_WORKER_LOOP_SYNC_EVENT } from './useMaxWorkerLoop'

export function useMaxEmployeeWorkQueue() {
  const [tick, setTick] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onSync = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onSync)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onSync)
    const onStorage = (event: StorageEvent) => {
      if (event.key === EMPLOYEE_WORK_QUEUE_STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onSync)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onSync)
      window.removeEventListener('storage', onStorage)
    }
  }, [refresh])

  const view = useMemo(() => {
    void tick
    return buildMaxWorkspaceWorkQueueView()
  }, [tick])

  const addTestTask = useCallback(() => {
    seedMaxEmployeeTestWorkItem()
    refresh()
  }, [refresh])

  const runNext = useCallback(async (): Promise<MaxWorkQueueRunResult> => {
    setIsRunning(true)
    try {
      const result = await runMaxEmployeeWorkQueueNextItem()
      refresh()
      return result
    } finally {
      setIsRunning(false)
    }
  }, [refresh])

  const runAll = useCallback(async (): Promise<MaxWorkQueueRunAllResult> => {
    setIsRunning(true)
    try {
      const result = await runMaxEmployeeWorkQueueAll()
      refresh()
      return result
    } finally {
      setIsRunning(false)
    }
  }, [refresh])

  return {
    view,
    isRunning,
    addTestTask,
    runNext,
    runAll,
    refresh,
  }
}
