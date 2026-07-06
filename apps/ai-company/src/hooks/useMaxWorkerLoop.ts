import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getMaxWorkerLoopById,
  getMaxWorkerLoopByRunId,
  loadMaxWorkerLoopRecords,
  rebuildMaxWorkerLoopSnapshotFromRun,
  type MaxWorkerLoopRecord,
  type MaxWorkerLoopSnapshot,
} from '../domain/maxWorkerLoop'
import {
  CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT,
  CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT,
} from '../domain/cursorAutomation'

export const MAX_WORKER_LOOP_SYNC_EVENT = 'ai-company-max-worker-loop-sync'

type Options = {
  loopId?: string | null
  runtimeRunId?: string | null
}

export function useMaxWorkerLoop(options: Options = {}) {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onSync = () => refresh()
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onSync)
    window.addEventListener(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, onSync)
    window.addEventListener(CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT, onSync)
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-max-worker-loops' ||
        event.key === 'ai-company-cursor-automation-owner-approvals' ||
        event.key === 'ai-company-cursor-automation-submit-runs'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onSync)
      window.removeEventListener(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, onSync)
      window.removeEventListener(CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT, onSync)
      window.removeEventListener('storage', onStorage)
    }
  }, [refresh])

  const loop = useMemo((): MaxWorkerLoopRecord | null => {
    void tick
    if (options.loopId) return getMaxWorkerLoopById(options.loopId)
    if (options.runtimeRunId) return getMaxWorkerLoopByRunId(options.runtimeRunId)
    return null
  }, [options.loopId, options.runtimeRunId, tick])

  useEffect(() => {
    if (!loop || (loop.status !== 'running' && loop.status !== 'queued')) return undefined
    const id = window.setInterval(refresh, 500)
    return () => window.clearInterval(id)
  }, [loop?.status, loop?.id, refresh])

  const snapshot = useMemo((): MaxWorkerLoopSnapshot | null => {
    if (!loop?.runtimeRunId || loop.status !== 'completed') return null
    return rebuildMaxWorkerLoopSnapshotFromRun(loop, loop.runtimeRunId)
  }, [loop])

  const latestForMax = useMemo((): MaxWorkerLoopRecord | null => {
    void tick
    return loadMaxWorkerLoopRecords()[0] ?? null
  }, [tick])

  return {
    loop,
    snapshot,
    latestForMax,
    refresh,
    isRunning: loop?.status === 'running' || loop?.status === 'queued',
  }
}
