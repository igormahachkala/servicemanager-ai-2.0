import { loadApprovalStore } from '../approval/approvalStorage'
import { getChatById, loadAllChats } from '../chats/chatStorage'
import { loadProjects } from '../projects/project'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import { loadReports } from '../reports/reportStorage'
import { agents, tasks } from '../../mission-control/data/mock'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import {
  getPresenceByEmployeeId,
  upsertPresence,
  type EmployeePresence,
  type PresenceStatus,
  type UpsertPresenceInput,
} from './presence'
import { appendWorkdayEvent, loadWorkdayEvents } from './workdayEvent'

const ROUTE_CONTEXT_KEY = 'ai-company-presence-route-context'

type RoutePresenceHint = {
  pathname: string
  employeeIds: string[]
  status: PresenceStatus
  activity: string
  projectId?: string | null
  workspaceId?: string | null
  taskId?: string | null
  runId?: string | null
  at: string
}

type PresenceDraft = UpsertPresenceInput & { priority: number }

const STATUS_PRIORITY: Record<PresenceStatus, number> = {
  waiting_approval: 100,
  working: 90,
  in_discussion: 80,
  reviewing: 70,
  busy: 60,
  learning: 50,
  break: 40,
  available: 30,
  offline: 10,
}

function listEmployeeIds(): string[] {
  const ids = new Set<string>()
  agents.forEach((agent) => ids.add(agent.id))
  loadCustomEmployees().forEach((employee) => ids.add(employee.id))
  return [...ids]
}

function resolveEmployeeIdByCodename(name: string): string | null {
  const normalized = name.trim().toLowerCase()
  const agent = agents.find(
    (item) =>
      item.codename.toLowerCase() === normalized ||
      item.codename.toLowerCase().startsWith(normalized),
  )
  return agent?.id ?? null
}

function readRouteContext(): RoutePresenceHint | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(ROUTE_CONTEXT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const hint = parsed as RoutePresenceHint
    if (Date.now() - new Date(hint.at).getTime() > 5 * 60 * 1000) return null
    return hint
  } catch {
    return null
  }
}

function writeRouteContext(hint: RoutePresenceHint): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ROUTE_CONTEXT_KEY, JSON.stringify(hint))
  } catch {
    /* noop */
  }
}

function addDraft(
  map: Map<string, PresenceDraft>,
  draft: PresenceDraft,
): void {
  const current = map.get(draft.employeeId)
  if (!current || draft.priority > current.priority) {
    map.set(draft.employeeId, draft)
  }
}

function expectedFinishFromMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function recordTransition(previous: EmployeePresence | null, next: EmployeePresence): void {
  if (!previous || previous.status === next.status) return

  const type =
    next.status === 'waiting_approval'
      ? 'approval_wait'
      : next.status === 'in_discussion'
        ? 'discussion'
        : next.status === 'reviewing'
          ? 'review'
          : next.status === 'learning'
            ? 'learning'
            : next.status === 'break'
              ? 'break'
              : previous.status !== 'offline' && next.status === 'offline'
                ? 'work_finished'
                : 'work_started'

  appendWorkdayEvent({
    employeeId: next.employeeId,
    type,
    label: next.activity,
    startedAt: next.startedAt,
    currentProjectId: next.currentProjectId,
    currentTaskId: next.currentTaskId,
  })
}

function buildDefaultOffline(employeeId: string): PresenceDraft {
  const agent = agents.find((item) => item.id === employeeId)
  const custom = loadCustomEmployees().find((item) => item.id === employeeId)

  if (custom?.status === 'disabled' || custom?.status === 'planned') {
    return {
      employeeId,
      status: 'offline',
      activity: 'Not activated',
      priority: STATUS_PRIORITY.offline,
    }
  }

  if (agent?.lifecycle === 'planned') {
    return {
      employeeId,
      status: 'offline',
      activity: agent.lastActivity,
      priority: STATUS_PRIORITY.offline,
    }
  }

  if (agent?.status === 'idle') {
    return {
      employeeId,
      status: 'available',
      activity: 'Ready for assignment',
      priority: STATUS_PRIORITY.available,
    }
  }

  return {
    employeeId,
    status: 'offline',
    activity: agent?.lastActivity ?? 'Offline',
    priority: STATUS_PRIORITY.offline,
  }
}

export function applyRoutePresenceContext(pathname: string): void {
  const hints: RoutePresenceHint = {
    pathname,
    employeeIds: [],
    status: 'available',
    activity: 'Owner reviewing operations',
    at: new Date().toISOString(),
  }

  if (pathname === '/ops' || pathname === '/ops/') {
    writeRouteContext({ ...hints, activity: 'Owner on executive dashboard' })
    return
  }

  if (pathname.startsWith('/ops/chats/') && pathname !== '/ops/chats/new') {
    const chatId = decodeURIComponent(pathname.replace('/ops/chats/', ''))
    const chat = getChatById(chatId)
    if (chat) {
      writeRouteContext({
        pathname,
        employeeIds: chat.participants
          .filter((item) => item.type === 'employee' && item.employeeId)
          .map((item) => item.employeeId as string),
        status: 'in_discussion',
        activity: `Discussion: ${chat.title}`,
        at: new Date().toISOString(),
      })
    }
    return
  }

  if (pathname.startsWith('/ops/projects/') && pathname !== '/ops/projects/new') {
    const projectId = pathname.replace('/ops/projects/', '')
    const project = loadProjects().find((item) => item.id === projectId)
    if (project) {
      writeRouteContext({
        pathname,
        employeeIds: project.team.map((member) => member.employeeId),
        status: 'working',
        activity: `Project delivery: ${project.title}`,
        projectId: project.id,
        workspaceId: project.workspaceId,
        at: new Date().toISOString(),
      })
    }
    return
  }

  if (pathname === '/ops/tasks') {
    writeRouteContext({
      pathname,
      employeeIds: tasks
        .filter((item) => item.status === 'running')
        .map((item) => resolveEmployeeIdByCodename(item.assignee))
        .filter((item): item is string => Boolean(item)),
      status: 'working',
      activity: 'Task queue review',
      at: new Date().toISOString(),
    })
    return
  }

  if (pathname.startsWith('/ops/runtime') || pathname.startsWith('/ops/runs')) {
    const activeRuns = loadRuntimeRuns().filter(
      (run) => run.status === 'running' || run.status === 'preparing_context' || run.status === 'queued',
    )
    writeRouteContext({
      pathname,
      employeeIds: activeRuns.map((run) => run.employeeId),
      status: 'working',
      activity: 'Runtime execution',
      at: new Date().toISOString(),
      runId: activeRuns[0]?.id ?? null,
    })
  }
}

export function syncPresenceFromPlatform(): EmployeePresence[] {
  const drafts = new Map<string, PresenceDraft>()
  const employeeIds = listEmployeeIds()

  employeeIds.forEach((employeeId) => {
    addDraft(drafts, buildDefaultOffline(employeeId))
  })

  tasks
    .filter((task) => task.status === 'running')
    .forEach((task) => {
      const employeeId = resolveEmployeeIdByCodename(task.assignee)
      if (!employeeId) return
      addDraft(drafts, {
        employeeId,
        status: 'working',
        currentTaskId: task.id,
        activity: task.title,
        expectedFinish: expectedFinishFromMinutes(task.slaMinutes),
        priority: STATUS_PRIORITY.working,
      })
    })

  loadRuntimeRuns().forEach((run) => {
    if (run.status === 'waiting_approval') {
      addDraft(drafts, {
        employeeId: run.employeeId,
        status: 'waiting_approval',
        currentRunId: run.id,
        currentWorkspaceId: run.workspaceId,
        currentTaskId: run.taskId,
        activity: 'Waiting for Owner approval',
        priority: STATUS_PRIORITY.waiting_approval,
      })
      return
    }

    if (run.status === 'running' || run.status === 'preparing_context' || run.status === 'queued') {
      addDraft(drafts, {
        employeeId: run.employeeId,
        status: 'working',
        currentRunId: run.id,
        currentWorkspaceId: run.workspaceId,
        currentTaskId: run.taskId,
        activity: 'Runtime pipeline in progress',
        expectedFinish: expectedFinishFromMinutes(30),
        priority: STATUS_PRIORITY.working,
      })
    }
  })

  loadApprovalStore().approvals
    .filter((item) => item.status === 'pending')
    .forEach((approval) => {
      addDraft(drafts, {
        employeeId: approval.employeeId,
        status: 'waiting_approval',
        currentWorkspaceId: approval.workspaceId,
        activity: approval.title,
        priority: STATUS_PRIORITY.waiting_approval,
      })
    })

  const recentChatCutoff = Date.now() - 45 * 60 * 1000
  loadAllChats()
    .filter((chat) => new Date(chat.updatedAt).getTime() >= recentChatCutoff)
    .forEach((chat) => {
      chat.participants
        .filter((participant) => participant.type === 'employee' && participant.employeeId)
        .forEach((participant) => {
          addDraft(drafts, {
            employeeId: participant.employeeId as string,
            status: 'in_discussion',
            activity: chat.title,
            priority: STATUS_PRIORITY.in_discussion,
          })
        })
    })

  loadProjects()
    .filter((project) => project.status === 'active')
    .forEach((project) => {
      project.team.forEach((member) => {
        addDraft(drafts, {
          employeeId: member.employeeId,
          status: 'working',
          currentProjectId: project.id,
          currentWorkspaceId: project.workspaceId,
          activity: project.title,
          priority: STATUS_PRIORITY.busy,
        })
      })
    })

  loadReports()
    .slice(0, 8)
    .forEach((report) => {
      if (!report.employeeId) return
      const createdAt = new Date(report.updatedAt).getTime()
      if (Date.now() - createdAt > 2 * 60 * 60 * 1000) return
      addDraft(drafts, {
        employeeId: report.employeeId,
        status: 'reviewing',
        activity: report.title,
        priority: STATUS_PRIORITY.reviewing,
      })
    })

  agents.forEach((agent) => {
    if (agent.lifecycle !== 'active') return
    if (agent.status === 'busy' && agent.currentTaskId) {
      addDraft(drafts, {
        employeeId: agent.id,
        status: 'busy',
        currentTaskId: agent.currentTaskId,
        activity: agent.lastActivity,
        priority: STATUS_PRIORITY.busy,
      })
    }
  })

  const routeHint = readRouteContext()
  if (routeHint) {
    routeHint.employeeIds.forEach((employeeId) => {
      addDraft(drafts, {
        employeeId,
        status: routeHint.status,
        activity: routeHint.activity,
        currentProjectId: routeHint.projectId ?? null,
        currentWorkspaceId: routeHint.workspaceId ?? null,
        currentTaskId: routeHint.taskId ?? null,
        currentRunId: routeHint.runId ?? null,
        priority: STATUS_PRIORITY[routeHint.status],
      })
    })
  }

  const results: EmployeePresence[] = []
  employeeIds.forEach((employeeId) => {
    const draft = drafts.get(employeeId) ?? buildDefaultOffline(employeeId)
    const previous = getPresenceByEmployeeId(employeeId)
    const next = upsertPresence({
      employeeId: draft.employeeId,
      status: draft.status,
      currentProjectId: draft.currentProjectId ?? null,
      currentWorkspaceId: draft.currentWorkspaceId ?? null,
      currentTaskId: draft.currentTaskId ?? null,
      currentRunId: draft.currentRunId ?? null,
      activity: draft.activity,
      expectedFinish: draft.expectedFinish ?? null,
    })
    recordTransition(previous, next)
    results.push(next)
  })

  return results
}

export function ensureSeedWorkdayEvents(): void {
  if (loadWorkdayEvents().length > 0) return

  appendWorkdayEvent({
    employeeId: 'ag-max',
    type: 'work_started',
    label: 'Polish standalone AI Company V1',
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    currentTaskId: 'TSK-V1-002',
    currentProjectId: 'project-ai-photo-lab',
  })
  appendWorkdayEvent({
    employeeId: 'ag-cto',
    type: 'work_started',
    label: 'V1 employee roster and tools registry',
    startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    currentTaskId: 'TSK-V1-001',
    currentProjectId: null,
  })
  appendWorkdayEvent({
    employeeId: 'ag-max',
    type: 'review',
    label: 'Reviewed project delivery docs',
    startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    currentProjectId: 'project-ai-photo-lab',
    currentTaskId: null,
  })
}

export function initializePresenceEngine(): EmployeePresence[] {
  ensureSeedWorkdayEvents()
  return syncPresenceFromPlatform()
}
