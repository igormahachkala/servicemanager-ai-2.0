import { useCallback, useEffect, useMemo, useState } from 'react'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import { loadApprovalStore } from '../domain/approval/approvalStorage'
import type { Approval } from '../domain/approval/approval'
import { loadAllChats } from '../domain/chats/chatStorage'
import type { Chat } from '../domain/chats/chat'
import { ensureSeedEvents, loadEvents } from '../domain/events/eventStorage'
import type { CompanyEvent } from '../domain/events/event'
import { getExecutionQueue } from '../domain/execution'
import type { Execution } from '../domain/execution'
import { listHandoffs } from '../domain/handoff'
import type { Handoff } from '../domain/handoff'
import { getAssignmentsForEmployee } from '../domain/knowledge/knowledgeStorage'
import type { KnowledgeAssignment } from '../domain/knowledge/knowledgeAssignment'
import { ensureSeedNotifications, loadNotifications } from '../domain/notifications/notificationStorage'
import type { Notification } from '../domain/notifications/notification'
import {
  getPresenceByEmployeeId,
  getWorkdayEventsForEmployee,
  initializePresenceEngine,
  type EmployeePresence,
  type WorkdayEvent,
} from '../domain/presence'
import { ensureSeedReports, loadReports } from '../domain/reports/reportStorage'
import type { Report } from '../domain/reports/report'
import { loadRuntimeRuns } from '../domain/runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../domain/runtime/runtimeRun'
import { getOrCreateRuntimeProfile } from '../domain/runtime/runtimeStorage'
import type { RuntimeProfile } from '../domain/runtime/runtimeStorage'
import { loadDeliveryTasks } from '../domain/tasks/taskStorage'
import type { DeliveryTask } from '../domain/tasks/task'
import { resolveEmployee } from '../mission-control/data/conversation'
import { resolveCanonicalEmployeeId } from '../mission-control/data/employeeIdResolver'
import { agents } from '../mission-control/data/mock'
import { loadCustomEmployees } from '../mission-control/data/customEmployees'

const REFRESH_KEYS = [
  'ai-company-delivery-tasks',
  'ai-company-executions',
  'ai-company-runtime-runs',
  'ai-company-reports',
  'ai-company-approvals',
  'ai-company-handoffs',
  'ai-company-knowledge',
  'ai-company-chats',
  'ai-company-events',
  'ai-company-notifications',
  'ai-company-presence',
  'ai-company-workday-events',
] as const

export type WorkspaceEmployee = {
  id: string
  name: string
  codename: string
  role: string
  primaryModel: string
  status: string
}

export type EmployeeWorkspaceSnapshot = {
  employee: WorkspaceEmployee
  presence: EmployeePresence | null
  profile: RuntimeProfile
  tasks: DeliveryTask[]
  currentRun: RuntimeRun | null
  recentRuns: RuntimeRun[]
  executions: Execution[]
  knowledgeAssignments: KnowledgeAssignment[]
  reports: Report[]
  pendingHandoffs: Handoff[]
  chats: Chat[]
  approvals: Approval[]
  notifications: Notification[]
  todayEvents: WorkdayEvent[]
  activityEvents: CompanyEvent[]
}

function chatIncludesEmployee(chat: Chat, employeeId: string): boolean {
  return chat.participants.some(
    (participant) => participant.type === 'employee' && participant.employeeId === employeeId,
  )
}

function resolveWorkspaceEmployee(rawEmployeeId: string): WorkspaceEmployee | null {
  const employeeId = resolveCanonicalEmployeeId(rawEmployeeId)
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)
  if (custom) {
    return {
      id: custom.id,
      name: custom.name,
      codename: custom.codename,
      role: custom.role,
      primaryModel: custom.primaryModel,
      status: custom.status,
    }
  }

  const builtin = resolveEmployee(employeeId)
  if (!builtin) return null
  const agent = agents.find((item) => item.id === employeeId)

  return {
    id: builtin.id,
    name: builtin.name,
    codename: builtin.codename,
    role: builtin.role,
    primaryModel: agent?.model ?? 'Mock Local Model',
    status: 'active',
  }
}

function buildSnapshot(rawEmployeeId: string): EmployeeWorkspaceSnapshot | null {
  initializeCompanyEngine()
  initializePresenceEngine()

  const employeeId = resolveCanonicalEmployeeId(rawEmployeeId)
  const employee = resolveWorkspaceEmployee(rawEmployeeId)
  if (!employee) return null

  const profile = getOrCreateRuntimeProfile(employee.id, employee.primaryModel)

  const tasks = loadDeliveryTasks()
    .filter((item) => item.assigneeId === employeeId)
    .filter((item) => item.status !== 'done')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const runs = loadRuntimeRuns()
    .filter((item) => item.employeeId === employeeId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  const currentRun =
    runs.find((item) => item.status === 'running' || item.status === 'waiting_approval') ?? null

  const executions = getExecutionQueue({ kind: 'employee', employeeId }).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )

  ensureSeedReports()
  const reports = loadReports()
    .filter((item) => item.employeeId === employeeId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)

  const pendingHandoffs = listHandoffs({
    projectId: 'all',
    workspaceId: 'all',
    employeeId,
    target: 'all',
    status: 'all',
  })
    .filter((item) => !['accepted', 'rejected', 'cancelled'].includes(item.status))
    .slice(0, 6)

  const chats = loadAllChats()
    .filter((item) => chatIncludesEmployee(item, employeeId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)

  const approvals = loadApprovalStore()
    .approvals.filter((item) => item.employeeId === employeeId && item.status === 'pending')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)

  ensureSeedNotifications()
  const notifications = loadNotifications()
    .filter((item) => item.employeeId === employeeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  ensureSeedEvents()
  const activityEvents = loadEvents()
    .filter((item) => item.employeeId === employeeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)

  return {
    employee,
    presence: getPresenceByEmployeeId(employeeId),
    profile,
    tasks,
    currentRun,
    recentRuns: runs.slice(0, 6),
    executions: executions.slice(0, 6),
    knowledgeAssignments: getAssignmentsForEmployee(employeeId).slice(0, 6),
    reports,
    pendingHandoffs,
    chats,
    approvals,
    notifications,
    todayEvents: getWorkdayEventsForEmployee(employeeId).slice(0, 8),
    activityEvents,
  }
}

export function useEmployeeWorkspace(employeeId: string | undefined) {
  const [snapshot, setSnapshot] = useState<EmployeeWorkspaceSnapshot | null>(() =>
    employeeId ? buildSnapshot(employeeId) : null,
  )

  const refresh = useCallback(() => {
    if (!employeeId) {
      setSnapshot(null)
      return
    }
    setSnapshot(buildSnapshot(employeeId))
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && (REFRESH_KEYS as readonly string[]).includes(event.key)) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const stats = useMemo(
    () => ({
      openTasks: snapshot?.tasks.length ?? 0,
      pendingApprovals: snapshot?.approvals.length ?? 0,
      pendingHandoffs: snapshot?.pendingHandoffs.length ?? 0,
      unreadNotifications: snapshot?.notifications.filter((item) => !item.read).length ?? 0,
      activeExecutions:
        snapshot?.executions.filter((item) =>
          ['running', 'preparing', 'waiting_approval', 'review'].includes(item.status),
        ).length ?? 0,
    }),
    [snapshot],
  )

  return { snapshot, stats, refresh }
}
