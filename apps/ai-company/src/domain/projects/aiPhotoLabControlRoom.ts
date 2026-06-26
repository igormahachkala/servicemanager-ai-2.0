import { loadExecutions } from '../execution/executionEngine'
import type { Execution } from '../execution/execution'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { getDeliveryTasksByProjectId } from '../tasks/taskStorage'
import type { DeliveryTask } from '../tasks/task'
import { loadReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import { loadApprovalStore } from '../approval/approvalStorage'
import type { Approval } from '../approval/approval'
import { getPresenceByEmployeeId } from '../presence/presence'
import type { EmployeePresence } from '../presence/presence'
import { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID } from './aiPhotoLabIds'
import { getProjectById } from './project'
import type { Project } from './project'
import type { ProjectRisk } from './risk'

export const AI_PHOTO_LAB_CONTROL_ROOM_PATH = `/ops/projects/${AI_PHOTO_LAB_PROJECT_ID}/control-room`

export type ControlRoomHealth = 'on_track' | 'at_risk' | 'critical'
export type ControlRoomRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type CodexHandoffCategory =
  | 'complex_code'
  | 'bug_fix'
  | 'production_deploy'
  | 'pdf_report'
  | 'ollama_integration'
  | 'ui_implementation'

export type CodexHandoffItem = {
  id: string
  category: CodexHandoffCategory
  title: string
  description: string
  taskId: string | null
  priority: DeliveryTask['priority']
  rationale: string
}

export type DemoChecklistKey =
  | 'local_run'
  | 'production_health'
  | 'photo_upload'
  | 'ai_analysis'
  | 'visual_zones'
  | 'manual_zone_edit'
  | 'inspection_chat'
  | 'report_history'
  | 'mobile_view'
  | 'deployment_checklist'

export type DemoChecklistItem = {
  key: DemoChecklistKey
  taskId: string | null
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
}

export type TeamMemberSnapshot = {
  id: string
  codename: string
  role: string
  kind: 'owner' | 'employee' | 'codex'
  presence: EmployeePresence | null
  currentTask: DeliveryTask | null
  executionStatus: Execution['status'] | null
}

export type OwnerDecision = {
  id: string
  title: string
  description: string
  kind: 'approval' | 'review' | 'decision'
  priority: 'low' | 'medium' | 'high' | 'critical'
  href: string | null
}

export type WorkNowBucket = {
  currentlyWorking: Array<{ task: DeliveryTask; execution: Execution | null }>
  waitingApproval: Array<{ task: DeliveryTask; execution: Execution | null }>
  blocked: DeliveryTask[]
  doneToday: Array<{ task: DeliveryTask; execution: Execution | null }>
}

export type AiPhotoLabControlRoomSnapshot = {
  project: Project
  goal: string
  deadline: string | null
  progress: number
  health: ControlRoomHealth
  riskLevel: ControlRoomRiskLevel
  team: TeamMemberSnapshot[]
  workNow: WorkNowBucket
  tasks: DeliveryTask[]
  codexHandoff: CodexHandoffItem[]
  demoChecklist: DemoChecklistItem[]
  reports: Report[]
  risks: ProjectRisk[]
  runtimeRuns: RuntimeRun[]
  pendingApprovals: Approval[]
  ownerDecisions: OwnerDecision[]
}

const GOAL =
  'Deliver a working MVP for AI-powered showcase inspection — upload, vision analysis, visual zones, inspection chat, reports, and production demo at vitrina.sma-assistants.ru.'

const TEAM_ROSTER: Array<{ id: string; codename: string; role: string; kind: TeamMemberSnapshot['kind'] }> = [
  { id: 'owner', codename: 'Igor', role: 'Owner', kind: 'owner' },
  { id: 'ag-cto', codename: 'Atlas', role: 'AI CTO', kind: 'employee' },
  { id: 'ag-max', codename: 'MAX', role: 'Senior Developer', kind: 'employee' },
  { id: 'ag-qa', codename: 'Sentinel', role: 'AI QA', kind: 'employee' },
  { id: 'ag-devops', codename: 'Helm', role: 'AI DevOps', kind: 'employee' },
  { id: 'ag-coo', codename: 'Ops', role: 'AI Product Analyst', kind: 'employee' },
  { id: 'ag-asst', codename: 'Nova', role: 'AI Designer', kind: 'employee' },
  { id: 'codex', codename: 'Codex', role: 'Coding Agent', kind: 'codex' },
]

const CODEX_HANDOFF_SPECS: Array<{
  id: string
  category: CodexHandoffCategory
  title: string
  description: string
  taskIds: string[]
  rationale: string
}> = [
  {
    id: 'codex-complex-code',
    category: 'complex_code',
    title: 'Complex code changes from audit findings',
    description: 'Refactors and cross-module fixes after architecture and code audits.',
    taskIds: ['task-apl-005', 'task-apl-006', 'task-apl-013'],
    rationale: 'Requires repo access and multi-file changes in ~/projects/ai-photo-lab.',
  },
  {
    id: 'codex-bug-fixes',
    category: 'bug_fix',
    title: 'Bug fixes from QA and audit regressions',
    description: 'Targeted fixes surfaced by Sentinel during MVP checklist runs.',
    taskIds: ['task-apl-008', 'task-apl-010'],
    rationale: 'Owner directive — digital employees audit; Codex implements fixes.',
  },
  {
    id: 'codex-production-deploy',
    category: 'production_deploy',
    title: 'Production deployment to /opt/ai-photo-lab',
    description: 'Deploy build to vitrina.sma-assistants.ru after Owner sign-off.',
    taskIds: ['task-apl-002', 'task-apl-011'],
    rationale: 'Production deploy is Codex-only per delivery policy.',
  },
  {
    id: 'codex-pdf-report',
    category: 'pdf_report',
    title: 'PDF / report engine implementation',
    description: 'Report generation, history retention, and export pipeline.',
    taskIds: ['task-apl-009'],
    rationale: 'Report engine touches backend PDF stack — Codex scope.',
  },
  {
    id: 'codex-ollama',
    category: 'ollama_integration',
    title: 'Ollama / qwen2.5vl:7b integration tuning',
    description: 'Vision model routing, latency optimization, prompt hardening.',
    taskIds: ['task-apl-005'],
    rationale: 'Model integration requires direct code changes in ai-photo-lab repo.',
  },
  {
    id: 'codex-ui',
    category: 'ui_implementation',
    title: 'UI implementation from design audit',
    description: 'Upload UX, zone editor, mobile layout polish.',
    taskIds: ['task-apl-004', 'task-apl-007'],
    rationale: 'Frontend implementation handed off after Nova/MAX audit.',
  },
]

const DEMO_CHECKLIST_MAP: Array<{ key: DemoChecklistKey; taskId: string | null }> = [
  { key: 'local_run', taskId: 'task-apl-003' },
  { key: 'production_health', taskId: 'task-apl-002' },
  { key: 'photo_upload', taskId: 'task-apl-004' },
  { key: 'ai_analysis', taskId: 'task-apl-005' },
  { key: 'visual_zones', taskId: 'task-apl-006' },
  { key: 'manual_zone_edit', taskId: 'task-apl-007' },
  { key: 'inspection_chat', taskId: 'task-apl-008' },
  { key: 'report_history', taskId: 'task-apl-009' },
  { key: 'mobile_view', taskId: null },
  { key: 'deployment_checklist', taskId: 'task-apl-011' },
]

const REPORT_IDS = ['report-apl-readiness', 'report-apl-risk', 'report-apl-delivery-plan']

function taskToDemoStatus(task: DeliveryTask | null): DemoChecklistItem['status'] {
  if (!task) return 'pending'
  if (task.status === 'done') return 'done'
  if (task.status === 'blocked') return 'blocked'
  if (task.status === 'in_progress' || task.status === 'review') return 'in_progress'
  return 'pending'
}

function maxRiskLevel(risks: ProjectRisk[]): ControlRoomRiskLevel {
  const open = risks.filter((item) => item.status === 'open')
  if (open.some((item) => item.severity === 'critical')) return 'critical'
  if (open.some((item) => item.severity === 'high')) return 'high'
  if (open.some((item) => item.severity === 'medium')) return 'medium'
  return 'low'
}

function computeHealth(
  progress: number,
  riskLevel: ControlRoomRiskLevel,
  blockedCount: number,
): ControlRoomHealth {
  if (riskLevel === 'critical' || blockedCount >= 2) return 'critical'
  if (riskLevel === 'high' || progress < 25) return 'at_risk'
  return 'on_track'
}

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function buildCodexHandoff(tasks: DeliveryTask[]): CodexHandoffItem[] {
  const byId = new Map(tasks.map((item) => [item.id, item]))
  return CODEX_HANDOFF_SPECS.map((spec) => {
    const linked = spec.taskIds.map((id) => byId.get(id)).filter(Boolean) as DeliveryTask[]
    const priority =
      linked.reduce<DeliveryTask['priority']>((best, task) => {
        const order = ['low', 'medium', 'high', 'critical'] as const
        return order.indexOf(task.priority) > order.indexOf(best) ? task.priority : best
      }, 'medium') ?? 'medium'
    return {
      id: spec.id,
      category: spec.category,
      title: spec.title,
      description: spec.description,
      taskId: spec.taskIds[0] ?? null,
      priority,
      rationale: spec.rationale,
    }
  })
}

function buildTeamSnapshot(
  tasks: DeliveryTask[],
  executions: Execution[],
): TeamMemberSnapshot[] {
  const execByEmployee = new Map<string, Execution>()
  for (const execution of executions) {
    if (!execByEmployee.has(execution.employeeId)) {
      execByEmployee.set(execution.employeeId, execution)
    }
  }

  return TEAM_ROSTER.map((member) => {
    const execution = member.kind === 'employee' ? execByEmployee.get(member.id) ?? null : null
    const task = execution ? tasks.find((item) => item.id === execution.taskId) ?? null : null
    return {
      ...member,
      presence: member.kind === 'employee' ? getPresenceByEmployeeId(member.id) : null,
      currentTask: task,
      executionStatus: execution?.status ?? null,
    }
  })
}

function buildWorkNow(tasks: DeliveryTask[], executions: Execution[]): WorkNowBucket {
  const execByTask = new Map(executions.map((item) => [item.taskId, item]))
  const wrap = (task: DeliveryTask) => ({ task, execution: execByTask.get(task.id) ?? null })

  return {
    currentlyWorking: tasks
      .filter((task) => {
        const exec = execByTask.get(task.id)
        return task.status === 'in_progress' || exec?.status === 'running' || exec?.status === 'preparing'
      })
      .map(wrap),
    waitingApproval: tasks
      .filter((task) => {
        const exec = execByTask.get(task.id)
        return task.status === 'review' || exec?.status === 'waiting_approval'
      })
      .map(wrap),
    blocked: tasks.filter((task) => task.status === 'blocked'),
    doneToday: tasks
      .filter((task) => {
        const exec = execByTask.get(task.id)
        return task.status === 'done' || (exec?.status === 'completed' && isToday(exec.finishedAt))
      })
      .map(wrap),
  }
}

function buildOwnerDecisions(
  tasks: DeliveryTask[],
  executions: Execution[],
  approvals: Approval[],
): OwnerDecision[] {
  const decisions: OwnerDecision[] = []

  for (const approval of approvals) {
    if (approval.status !== 'pending') continue
    if (approval.workspaceId !== AI_PHOTO_LAB_WORKSPACE_ID && approval.actionType !== 'production_deploy') {
      continue
    }
    decisions.push({
      id: `decision-approval-${approval.id}`,
      title: approval.title,
      description: approval.description,
      kind: 'approval',
      priority: approval.priority,
      href: `/ops/approvals/${encodeURIComponent(approval.id)}`,
    })
  }

  const deployTask = tasks.find((item) => item.id === 'task-apl-011')
  const deployExec = executions.find((item) => item.taskId === 'task-apl-011')
  if (deployTask && deployExec?.status === 'waiting_approval') {
    decisions.push({
      id: 'decision-deploy-checklist',
      title: 'Approve deployment checklist for /opt/ai-photo-lab',
      description: 'Helm prepared deploy steps — Owner sign-off required before Codex production deploy.',
      kind: 'approval',
      priority: 'critical',
      href: `/ops/execution?project=${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`,
    })
  }

  const codexTask = tasks.find((item) => item.id === 'task-apl-013')
  if (codexTask?.status === 'review') {
    decisions.push({
      id: 'decision-codex-backlog',
      title: 'Approve Codex task backlog',
      description: 'Atlas compiled Codex-only engineering tasks — confirm handoff list before implementation.',
      kind: 'review',
      priority: 'high',
      href: `/ops/projects/${encodeURIComponent(AI_PHOTO_LAB_PROJECT_ID)}`,
    })
  }

  const stabilization = tasks.find((item) => item.id === 'task-apl-001')
  if (stabilization?.status === 'in_progress') {
    decisions.push({
      id: 'decision-stabilization-plan',
      title: 'Review MVP stabilization plan',
      description: 'Apex drafted cross-functional plan with owners, dates, and Codex routing.',
      kind: 'decision',
      priority: 'high',
      href: `/ops/reports/report-apl-delivery-plan`,
    })
  }

  return decisions
}

export function buildAiPhotoLabControlRoom(): AiPhotoLabControlRoomSnapshot | null {
  const project = getProjectById(AI_PHOTO_LAB_PROJECT_ID)
  if (!project) return null

  const tasks = getDeliveryTasksByProjectId(AI_PHOTO_LAB_PROJECT_ID)
  const executions = loadExecutions().filter((item) => item.projectId === AI_PHOTO_LAB_PROJECT_ID)
  const runtimeRuns = loadRuntimeRuns().filter((item) => item.workspaceId === AI_PHOTO_LAB_WORKSPACE_ID)
  const reports = loadReports().filter((item) => REPORT_IDS.includes(item.id))
  const pendingApprovals = loadApprovalStore().approvals.filter(
    (item) =>
      item.status === 'pending' &&
      (item.workspaceId === AI_PHOTO_LAB_WORKSPACE_ID || item.actionType === 'production_deploy'),
  )

  const taskById = new Map(tasks.map((item) => [item.id, item]))
  const demoChecklist: DemoChecklistItem[] = DEMO_CHECKLIST_MAP.map((item) => ({
    key: item.key,
    taskId: item.taskId,
    status: taskToDemoStatus(item.taskId ? taskById.get(item.taskId) ?? null : null),
  }))

  const risks = project.risks ?? []
  const riskLevel = maxRiskLevel(risks)
  const workNow = buildWorkNow(tasks, executions)

  return {
    project,
    goal: GOAL,
    deadline: project.deadline,
    progress: project.progress,
    health: computeHealth(project.progress, riskLevel, workNow.blocked.length),
    riskLevel,
    team: buildTeamSnapshot(tasks, executions),
    workNow,
    tasks,
    codexHandoff: buildCodexHandoff(tasks),
    demoChecklist,
    reports,
    risks,
    runtimeRuns,
    pendingApprovals,
    ownerDecisions: buildOwnerDecisions(tasks, executions, pendingApprovals),
  }
}
