import type { Approval } from '../approval/approval'
import type { ApprovalStats } from '../approval/approvalStorage'
import type { CanvasSummary } from '../canvas/canvas'
import type { CompanyEvent } from '../events/event'
import type { EmployeePresence } from '../presence/presence'
import type { AiPhotoLabControlRoomSnapshot } from '../projects/aiPhotoLabControlRoom'
import { buildAiPhotoLabControlRoom } from '../projects/aiPhotoLabControlRoom'
import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { Notification } from '../notifications/notification'
import {
  AI_PHOTO_LAB_SPRINT_1_ID,
  buildSprintSnapshot,
  getSprintById,
  type SprintSnapshot,
} from '../sprint/sprintStorage'
import { computeExecutionStats } from '../execution/executionEngine'
import { computeToolExecutionStats, listToolExecutions, type ToolExecution } from '../toolExecution'
import type { FeedEvent } from '../../mission-control/data/types'
import { recentAlerts, systemHealth } from '../../mission-control/data/mock'

export type CommandCenterTimeOfDay = 'morning' | 'afternoon' | 'evening'

export type CommandCenterEmployeeRow = {
  employeeId: string
  codename: string
  status: EmployeePresence['status']
  activity: string
  kind: 'working' | 'waiting'
}

export type CommandCenterChartPoint = {
  id: 'productivity' | 'capacity' | 'execution' | 'approvals'
  value: number
  max: number
}

export type CommandCenterMorningBrief = {
  timeOfDay: CommandCenterTimeOfDay
  employeesWorking: number
  employeesWaiting: number
  pendingApprovals: number
  criticalAlerts: number
  sprintHealth: SprintSnapshot['stats']['health'] | null
  controlRoomHealth: AiPhotoLabControlRoomSnapshot['health'] | null
  controlRoomProgress: number | null
  unreadNotifications: number
}

export type CommandCenterRuntimeSummary = {
  total: number
  completed: number
  waitingApproval: number
  failed: number
  recentRuns: RuntimeRun[]
}

export type CommandCenterToolUsageSummary = {
  total: number
  completed: number
  failed: number
  pendingApproval: number
  recent: ToolExecution[]
}

export type CommandCenterSnapshot = {
  brief: CommandCenterMorningBrief
  healthScore: number
  systemHealth: typeof systemHealth
  employeesWorking: CommandCenterEmployeeRow[]
  employeesWaiting: CommandCenterEmployeeRow[]
  sprint: SprintSnapshot | null
  controlRoom: AiPhotoLabControlRoomSnapshot | null
  pendingApprovals: Approval[]
  approvalStats: ApprovalStats
  criticalAlerts: FeedEvent[]
  runtime: CommandCenterRuntimeSummary
  toolUsage: CommandCenterToolUsageSummary
  reports: Report[]
  timeline: CompanyEvent[]
  notifications: Notification[]
  canvas: CanvasSummary | null
  charts: CommandCenterChartPoint[]
}

const CODENAMES: Record<string, string> = {
  owner: 'Igor',
  'ag-ceo': 'Apex',
  'ag-cto': 'Atlas',
  'ag-arch': 'Daedalus',
  'ag-max': 'MAX',
  'ag-qa': 'Sentinel',
  'ag-devops': 'Helm',
  'ag-coo': 'Ops',
  'ag-asst': 'Nova',
}

function timeOfDay(): CommandCenterTimeOfDay {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function codenameFor(employeeId: string): string {
  return CODENAMES[employeeId] ?? employeeId
}

function mapPresenceRows(
  items: EmployeePresence[],
  kind: CommandCenterEmployeeRow['kind'],
): CommandCenterEmployeeRow[] {
  return items.map((item) => ({
    employeeId: item.employeeId,
    codename: codenameFor(item.employeeId),
    status: item.status,
    activity: item.activity,
    kind,
  }))
}

function computeHealthScore(): number {
  const upCount = systemHealth.filter((item) => item.status === 'up').length
  const base = systemHealth.length > 0 ? Math.round((upCount / systemHealth.length) * 100) : 100
  const alerts = recentAlerts()
  const penalty = alerts.filter((item) => item.severity === 'error').length * 8
  return Math.max(0, Math.min(100, base - penalty))
}

function buildCharts(
  sprint: SprintSnapshot | null,
  approvalStats: ApprovalStats,
  executionStats: ReturnType<typeof computeExecutionStats>,
): CommandCenterChartPoint[] {
  const capacityMax = sprint?.stats.capacityTotal ?? 13
  const capacityValue = sprint?.stats.capacityUsed ?? 0
  const approvalTotal = Math.max(approvalStats.total, 1)
  const executionMax = Math.max(
    executionStats.runningNow + executionStats.currentQueue,
    1,
  )

  return [
    {
      id: 'productivity',
      value: executionStats.completedToday,
      max: Math.max(executionStats.completedToday, 8),
    },
    {
      id: 'capacity',
      value: capacityValue,
      max: Math.max(capacityMax, 1),
    },
    {
      id: 'execution',
      value: executionStats.runningNow,
      max: executionMax,
    },
    {
      id: 'approvals',
      value: approvalStats.approved,
      max: approvalTotal,
    },
  ]
}

export type BuildCommandCenterInput = {
  nowWorking: EmployeePresence[]
  waiting: EmployeePresence[]
  pendingApprovals: Approval[]
  approvalStats: ApprovalStats
  runtimeRuns: RuntimeRun[]
  reports: Report[]
  timeline: CompanyEvent[]
  notifications: Notification[]
  canvasSummary: CanvasSummary | null
}

export function buildCommandCenterSnapshot(input: BuildCommandCenterInput): CommandCenterSnapshot {
  const sprintRecord = getSprintById(AI_PHOTO_LAB_SPRINT_1_ID)
  const sprint = sprintRecord ? buildSprintSnapshot(sprintRecord) : null
  const controlRoom = buildAiPhotoLabControlRoom()
  const criticalAlerts = recentAlerts()
  const executionStats = computeExecutionStats({ kind: 'company' })
  const toolExecutions = listToolExecutions()
  const toolStats = computeToolExecutionStats(toolExecutions)

  const employeesWorking = mapPresenceRows(input.nowWorking, 'working')
  const employeesWaiting = mapPresenceRows(input.waiting, 'waiting')

  const brief: CommandCenterMorningBrief = {
    timeOfDay: timeOfDay(),
    employeesWorking: employeesWorking.length,
    employeesWaiting: employeesWaiting.length,
    pendingApprovals: input.approvalStats.pending,
    criticalAlerts: criticalAlerts.length,
    sprintHealth: sprint?.stats.health ?? null,
    controlRoomHealth: controlRoom?.health ?? null,
    controlRoomProgress: controlRoom?.progress ?? null,
    unreadNotifications: input.notifications.length,
  }

  return {
    brief,
    healthScore: computeHealthScore(),
    systemHealth,
    employeesWorking,
    employeesWaiting,
    sprint,
    controlRoom,
    pendingApprovals: input.pendingApprovals.slice(0, 5),
    approvalStats: input.approvalStats,
    criticalAlerts,
    runtime: {
      total: input.runtimeRuns.length,
      completed: input.runtimeRuns.filter((item) => item.status === 'completed').length,
      waitingApproval: input.runtimeRuns.filter((item) => item.status === 'waiting_approval').length,
      failed: input.runtimeRuns.filter((item) => item.status === 'failed').length,
      recentRuns: [...input.runtimeRuns]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 5),
    },
    toolUsage: {
      total: toolStats.total,
      completed: toolStats.completed,
      failed: toolStats.failed,
      pendingApproval: toolStats.waitingApproval,
      recent: toolExecutions.slice(0, 5),
    },
    reports: input.reports.slice(0, 5),
    timeline: input.timeline.slice(0, 8),
    notifications: input.notifications.slice(0, 6),
    canvas: input.canvasSummary,
    charts: buildCharts(sprint, input.approvalStats, executionStats),
  }
}
