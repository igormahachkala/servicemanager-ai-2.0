import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildMaxWorkspaceView } from '../domain/maxWorkspace'
import {
  CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT,
  CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT,
} from '../domain/cursorAutomation'
import {
  buildMaxWorkerLoopPanelView,
  loadMaxWorkerLoopRecords,
  MAX_WORKER_EMPLOYEE_ID,
  rebuildMaxWorkerLoopSnapshotFromRun,
  type MaxWorkerLoopRecord,
  type MaxWorkerLoopSnapshot,
} from '../domain/maxWorkerLoop'
import { getRuntimeRunById } from '../domain/runtime/runtimeOrchestrator'
import { getOrCreateRuntimeProfile } from '../domain/runtime/runtimeStorage'
import { agents } from '../mission-control/data/mock'
import { MAX_WORKER_LOOP_SYNC_EVENT } from './useMaxWorkerLoop'

const REFRESH_KEYS = [
  'ai-company-max-worker-loops',
  'ai-company-runtime-runs',
  'ai-company-reports',
  'ai-company-cursor-automation-owner-approvals',
  'ai-company-cursor-automation-submit-runs',
] as const

function resolveMaxPrimaryModel(): string {
  return agents.find((item) => item.id === MAX_WORKER_EMPLOYEE_ID)?.model ?? 'Qwen Coder'
}

export function useMaxEmployeeWorkspace() {
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
      if (event.key && (REFRESH_KEYS as readonly string[]).includes(event.key)) {
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
    return loadMaxWorkerLoopRecords()[0] ?? null
  }, [tick])

  useEffect(() => {
    if (!loop || (loop.status !== 'running' && loop.status !== 'queued')) return undefined
    const id = window.setInterval(refresh, 800)
    return () => window.clearInterval(id)
  }, [loop?.status, loop?.id, refresh])

  const snapshot = useMemo((): MaxWorkerLoopSnapshot | null => {
    if (!loop?.runtimeRunId || loop.status !== 'completed') return null
    return rebuildMaxWorkerLoopSnapshotFromRun(loop, loop.runtimeRunId)
  }, [loop])

  const runtimeRun = useMemo(() => {
    void tick
    if (!loop?.runtimeRunId) return null
    return getRuntimeRunById(loop.runtimeRunId)
  }, [loop?.runtimeRunId, tick])

  const profile = useMemo(
    () => getOrCreateRuntimeProfile(MAX_WORKER_EMPLOYEE_ID, resolveMaxPrimaryModel()),
    [tick],
  )

  const panelView = useMemo(
    () => (loop ? buildMaxWorkerLoopPanelView(loop, snapshot) : null),
    [loop, snapshot],
  )

  const view = useMemo(
    () =>
      buildMaxWorkspaceView({
        loop,
        snapshot,
        runtimeRun,
        profile,
        panelView,
      }),
    [loop, snapshot, runtimeRun, profile, panelView],
  )

  return {
    loop,
    snapshot,
    panelView,
    view,
    refresh,
    isRunning: loop?.status === 'running' || loop?.status === 'queued',
  }
}
