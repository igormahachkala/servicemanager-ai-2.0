import { useMemo } from 'react'
import { loadCollaborationSessions } from '../domain/collaboration/collaborationStorage'
import { buildOperatingDaySnapshot } from '../domain/operatingDay'
import { useCommandCenter } from './useCommandCenter'
import { useWorkday } from './useWorkday'

export function useOperatingDay() {
  const { snapshot: commandCenter } = useCommandCenter()
  const { dashboard } = useWorkday()

  const snapshot = useMemo(
    () =>
      buildOperatingDaySnapshot({
        commandCenter,
        employeesStarted: dashboard.started,
        employeesFinished: dashboard.finished,
        meetings: loadCollaborationSessions(),
        reportsToday: dashboard.summary.reportsToday,
        tasksCompleted: dashboard.summary.tasksInProgress,
        avgPhaseIndex: dashboard.summary.avgPhasesCompleted,
      }),
    [commandCenter, dashboard],
  )

  return { snapshot, dashboard }
}
