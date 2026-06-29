import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import { ensurePhotoLabHandoffs } from '../domain/handoff/handoffStorage'
import {
  buildAiPhotoLabKickoffSnapshot,
  type AiPhotoLabKickoffSnapshot,
  type KickoffTaskPreset,
} from '../domain/projects/aiPhotoLabKickoff'
import { startTaskRunner } from '../domain/taskRunner'

const REFRESH_KEYS = [
  'ai-company-projects',
  'ai-company-delivery-tasks',
  'ai-company-executions',
  'ai-company-runtime-runs',
  'ai-company-approvals',
  'ai-company-handoffs',
  'ai-company-sprints',
  'ai-company-task-runner-history',
] as const

export function useAiPhotoLabKickoff() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<AiPhotoLabKickoffSnapshot | null>(() => {
    initializeCompanyEngine()
    ensurePhotoLabHandoffs()
    return buildAiPhotoLabKickoffSnapshot()
  })
  const [runningPresetId, setRunningPresetId] = useState<KickoffTaskPreset['id'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    initializeCompanyEngine()
    ensurePhotoLabHandoffs()
    setSnapshot(buildAiPhotoLabKickoffSnapshot())
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
        demoReady: 0,
        demoTotal: 0,
        sprintGoal: '',
        pendingDecisions: 0,
        pendingApprovals: 0,
      }
    }
    return {
      demoReady: snapshot.demoReadiness.readyCount,
      demoTotal: snapshot.demoReadiness.totalCount,
      sprintGoal: snapshot.sprint?.sprint.goal ?? snapshot.controlRoom.goal,
      pendingDecisions: snapshot.ownerDecisions.length,
      pendingApprovals: snapshot.pendingApprovals.length,
    }
  }, [snapshot])

  const runPreset = useCallback(
    async (presetId: KickoffTaskPreset['id']) => {
      if (!snapshot) return null
      const preset = snapshot.taskPresets.find((item) => item.id === presetId)
      if (!preset) return null

      setRunningPresetId(presetId)
      setError(null)
      try {
        const result = await startTaskRunner({
          taskText: preset.taskText,
          title: preset.title,
          mode: preset.mode,
          employeeId: preset.employeeId,
          projectId: snapshot.projectId,
          workspaceId: snapshot.workspaceId,
          priority: 'high',
          expectedOutput: preset.expectedOutput,
          constraints: preset.constraints,
        })
        refresh()
        navigate(`/ops/runtime/live?runId=${encodeURIComponent(result.run.id)}`)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Kickoff task failed'
        setError(message)
        throw err
      } finally {
        setRunningPresetId(null)
      }
    },
    [navigate, refresh, snapshot],
  )

  const openRunTask = useCallback(
    (presetId: KickoffTaskPreset['id']) => {
      if (!snapshot) return
      const preset = snapshot.taskPresets.find((item) => item.id === presetId)
      if (!preset) return
      const params = new URLSearchParams({
        project: snapshot.projectId,
        workspace: snapshot.workspaceId,
        employee: preset.employeeId,
        mode: preset.mode,
        text: preset.taskText,
      })
      navigate(`/ops/run-task?${params.toString()}`)
    },
    [navigate, snapshot],
  )

  return {
    snapshot,
    stats,
    refresh,
    runningPresetId,
    error,
    runPreset,
    openRunTask,
  }
}
