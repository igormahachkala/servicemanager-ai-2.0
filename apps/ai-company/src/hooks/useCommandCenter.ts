import { useMemo } from 'react'
import { buildCanvasGraph, getCanvasSummary } from '../domain/canvas'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import { buildCommandCenterSnapshot } from '../domain/commandCenter'
import { useApprovals } from './useApprovals'
import { useEvents } from './useEvents'
import { useNotifications } from './useNotifications'
import { usePresence } from './usePresence'
import { useReports } from './useReports'
import { useRuntime } from './useRuntime'

export function useCommandCenter() {
  const { nowWorking, waiting } = usePresence()
  const { approvals, stats: approvalStats } = useApprovals()
  const { runs } = useRuntime()
  const { reports } = useReports()
  const { grouped } = useEvents()
  const { unread, unreadCount, markRead } = useNotifications()

  const pendingApprovals = useMemo(
    () => approvals.filter((item) => item.status === 'pending'),
    [approvals],
  )

  const timeline = useMemo(
    () =>
      grouped
        .flatMap((group) => group.events)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [grouped],
  )

  const canvasSummary = useMemo(() => {
    const graph = buildCanvasGraph({ mode: 'project', projectId: AI_PHOTO_LAB_PROJECT_ID })
    return getCanvasSummary(graph)
  }, [])

  const snapshot = useMemo(
    () =>
      buildCommandCenterSnapshot({
        nowWorking,
        waiting,
        pendingApprovals,
        approvalStats,
        runtimeRuns: runs,
        reports,
        timeline,
        notifications: unread,
        canvasSummary,
      }),
    [
      approvalStats,
      canvasSummary,
      nowWorking,
      pendingApprovals,
      reports,
      runs,
      timeline,
      unread,
      waiting,
    ],
  )

  return { snapshot, unreadCount, markRead }
}
