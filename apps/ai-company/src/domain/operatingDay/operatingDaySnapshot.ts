import type { Approval } from '../approval/approval'
import type { CollaborationSession } from '../collaboration/collaborationSession'
import {
  buildCommandCenterSnapshot,
  type CommandCenterEmployeeRow,
  type CommandCenterMorningBrief,
  type CommandCenterRuntimeSummary,
  type CommandCenterSnapshot,
  type CommandCenterTimeOfDay,
} from '../commandCenter'
import type { Report } from '../reports/report'
import type { ProjectRisk } from '../projects/risk'
import type { AiPhotoLabControlRoomSnapshot } from '../projects/aiPhotoLabControlRoom'
import type { SprintSnapshot } from '../sprint/sprintStorage'
import type { WorkdayDashboardEntry } from '../workday/workday'

export type OperatingDayPhaseId =
  | 'morning'
  | 'employees'
  | 'currentWork'
  | 'meetings'
  | 'approvals'
  | 'runtime'
  | 'reports'
  | 'endOfDay'

export type OperatingDayPriority = {
  id: string
  label: string
  detail: string
  href: string | null
}

export type OperatingDayMeeting = {
  id: string
  title: string
  status: CollaborationSession['status']
  participantCount: number
  href: string
  updatedAt: string
}

export type OperatingDayDelivery = {
  id: string
  title: string
  status: string
  assigneeId: string
  href: string | null
}

export type OperatingDayEveningSummary = {
  finishedCount: number
  reportsToday: number
  tasksCompleted: number
  approvalsPending: number
  runtimeCompleted: number
  avgPhaseIndex: number
}

export type OperatingDaySnapshot = {
  dateKey: string
  timeOfDay: CommandCenterTimeOfDay
  brief: CommandCenterMorningBrief
  healthScore: number
  systemHealth: CommandCenterSnapshot['systemHealth']
  priorities: OperatingDayPriority[]
  employeesStarted: WorkdayDashboardEntry[]
  employeesWorking: CommandCenterEmployeeRow[]
  sprint: SprintSnapshot | null
  risks: ProjectRisk[]
  pendingApprovals: Approval[]
  meetings: OperatingDayMeeting[]
  deliveries: OperatingDayDelivery[]
  reports: Report[]
  runtime: CommandCenterRuntimeSummary
  eveningSummary: OperatingDayEveningSummary
}

function isToday(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function buildPriorities(
  commandCenter: CommandCenterSnapshot,
  controlRoom: AiPhotoLabControlRoomSnapshot | null,
): OperatingDayPriority[] {
  const items: OperatingDayPriority[] = []

  if (commandCenter.sprint) {
    items.push({
      id: 'priority-sprint',
      label: commandCenter.sprint.sprint.name,
      detail: commandCenter.sprint.sprint.goal,
      href: '/ops/sprint/sprint-apl-1',
    })
  }

  if (controlRoom) {
    items.push({
      id: 'priority-control-room',
      label: controlRoom.goal,
      detail: `${controlRoom.progress}% MVP`,
      href: '/ops/projects/project-ai-photo-lab/control-room',
    })
  }

  commandCenter.pendingApprovals.slice(0, 3).forEach((approval) => {
    items.push({
      id: `priority-approval-${approval.id}`,
      label: approval.title,
      detail: approval.description ?? approval.actionType,
      href: `/ops/approvals/${encodeURIComponent(approval.id)}`,
    })
  })

  controlRoom?.risks
    .filter((risk) => risk.severity === 'high' || risk.severity === 'critical')
    .slice(0, 2)
    .forEach((risk) => {
      items.push({
        id: `priority-risk-${risk.id}`,
        label: risk.title,
        detail: risk.description,
        href: '/ops/projects/project-ai-photo-lab/control-room',
      })
    })

  return items.slice(0, 6)
}

function buildMeetings(sessions: CollaborationSession[]): OperatingDayMeeting[] {
  return sessions
    .filter((session) => session.status !== 'completed' || isToday(session.updatedAt))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)
    .map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      participantCount: session.participants.length,
      href: `/ops/collaboration/${encodeURIComponent(session.id)}`,
      updatedAt: session.updatedAt,
    }))
}

function buildDeliveries(controlRoom: AiPhotoLabControlRoomSnapshot | null): OperatingDayDelivery[] {
  if (!controlRoom) return []

  const active = [
    ...controlRoom.workNow.currentlyWorking.map(({ task }) => task),
    ...controlRoom.workNow.waitingApproval.map(({ task }) => task),
    ...controlRoom.workNow.blocked,
  ]

  const seen = new Set<string>()
  return active
    .filter((task) => {
      if (seen.has(task.id)) return false
      seen.add(task.id)
      return true
    })
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      assigneeId: task.assigneeId,
      href: `/ops/execution?project=${encodeURIComponent(controlRoom.project.id)}`,
    }))
}

export type BuildOperatingDayInput = {
  commandCenter: CommandCenterSnapshot
  employeesStarted: WorkdayDashboardEntry[]
  employeesFinished: WorkdayDashboardEntry[]
  meetings: CollaborationSession[]
  reportsToday: number
  tasksCompleted: number
  avgPhaseIndex: number
}

export function buildOperatingDaySnapshot(input: BuildOperatingDayInput): OperatingDaySnapshot {
  const { commandCenter, employeesStarted, employeesFinished, meetings, reportsToday, tasksCompleted, avgPhaseIndex } =
    input
  const controlRoom = commandCenter.controlRoom

  return {
    dateKey: new Date().toISOString().slice(0, 10),
    timeOfDay: commandCenter.brief.timeOfDay,
    brief: commandCenter.brief,
    healthScore: commandCenter.healthScore,
    systemHealth: commandCenter.systemHealth,
    priorities: buildPriorities(commandCenter, controlRoom),
    employeesStarted,
    employeesWorking: commandCenter.employeesWorking,
    sprint: commandCenter.sprint,
    risks: controlRoom?.risks ?? [],
    pendingApprovals: commandCenter.pendingApprovals,
    meetings: buildMeetings(meetings),
    deliveries: buildDeliveries(controlRoom),
    reports: commandCenter.reports,
    runtime: commandCenter.runtime,
    eveningSummary: {
      finishedCount: employeesFinished.length,
      reportsToday,
      tasksCompleted,
      approvalsPending: commandCenter.approvalStats.pending,
      runtimeCompleted: commandCenter.runtime.completed,
      avgPhaseIndex,
    },
  }
}

export { buildCommandCenterSnapshot }
