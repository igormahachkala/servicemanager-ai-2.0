import { emitEvent } from '../events/eventStorage'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { getDeliveryTasksByProjectId } from '../tasks/taskStorage'
import type { DeliveryTask, DeliveryTaskPriority } from '../tasks/task'
import {
  createSprint,
  deliveryStatusToBoardColumn,
  parseSprint,
  type Sprint,
  type SprintBoardColumn,
  type SprintBurndownPoint,
  type SprintHealth,
  type SprintTaskEntry,
} from './sprint'

export const AI_PHOTO_LAB_SPRINT_1_ID = 'sprint-apl-1'
export const AI_PHOTO_LAB_SPRINT_PATH = `/ops/sprint/${AI_PHOTO_LAB_SPRINT_1_ID}`

export type SprintStats = {
  health: SprintHealth
  velocity: number
  capacityTotal: number
  capacityUsed: number
  capacityRemaining: number
  commitmentPoints: number
  blocked: number
  completed: number
  remaining: number
  progressPercent: number
  daysTotal: number
  daysElapsed: number
}

export type SprintTaskSnapshot = {
  entry: SprintTaskEntry
  task: DeliveryTask
  assigneeCodename: string
}

export type SprintSnapshot = {
  sprint: Sprint
  tasks: SprintTaskSnapshot[]
  stats: SprintStats
  byColumn: Record<SprintBoardColumn, SprintTaskSnapshot[]>
}

const STORAGE_KEY = 'ai-company-sprints'
const SEED_KEY = 'ai-company-sprint-seeded-v1'
export const CHANGE_EVENT = 'ai-company-sprint-change'

const ASSIGNEE_LABELS: Record<string, { codename: string; role: string }> = {
  owner: { codename: 'Igor', role: 'Owner' },
  'ag-ceo': { codename: 'Apex', role: 'AI CEO' },
  'ag-cto': { codename: 'Atlas', role: 'AI CTO' },
  'ag-arch': { codename: 'Daedalus', role: 'AI Architect' },
  'ag-max': { codename: 'MAX', role: 'Senior Developer' },
  'ag-qa': { codename: 'Sentinel', role: 'AI QA' },
  'ag-devops': { codename: 'Helm', role: 'AI DevOps' },
  'ag-coo': { codename: 'Ops', role: 'AI Product Analyst' },
  'ag-asst': { codename: 'Nova', role: 'AI Designer' },
}

const DEFAULT_DOR = [
  'Task has assignee and expected output documented',
  'Dependencies and blockers identified',
  'Acceptance criteria agreed with QA or Architect',
  'No production deploy without Owner approval',
]

const DEFAULT_DOD = [
  'Audit or checklist completed with written output',
  'Findings logged in report or project timeline',
  'QA sign-off for user-facing flows',
  'Codex-only fixes routed through handoff protocol',
  'Owner informed when decision or approval is required',
]

function notifyChange(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function storyPointsForPriority(priority: DeliveryTaskPriority): number {
  if (priority === 'critical') return 8
  if (priority === 'high') return 5
  if (priority === 'medium') return 3
  return 2
}

function nextMondayIso(): string {
  const date = new Date()
  const day = date.getDay()
  const daysToAdd = day === 0 ? 1 : day === 1 ? 7 : (8 - day) % 7 || 7
  date.setDate(date.getDate() + daysToAdd)
  date.setHours(9, 0, 0, 0)
  return date.toISOString()
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function buildBurndown(commitment: number): SprintBurndownPoint[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  return days.map((label, index) => {
    const ideal = Math.max(0, Math.round(commitment - (commitment / (days.length - 1)) * index))
    const remaining =
      index === 0
        ? commitment
        : Math.max(0, Math.round(commitment * (1 - index * 0.09) - (index > 5 ? 2 : 0)))
    return {
      day: `day-${index + 1}`,
      label,
      remaining,
      ideal,
    }
  })
}

function buildPhotoLabSprint1(): Sprint {
  const deliveryTasks = getDeliveryTasksByProjectId(AI_PHOTO_LAB_PROJECT_ID)
  const startDate = nextMondayIso()
  const durationDays = 10
  const endDate = addDays(startDate, 13)

  const tasks: SprintTaskEntry[] = deliveryTasks.map((task, index) => ({
    taskId: task.id,
    storyPoints: storyPointsForPriority(task.priority),
    boardColumn: deliveryStatusToBoardColumn(task.status),
    order: index + 1,
  }))

  const commitmentPoints = tasks.reduce((sum, item) => sum + item.storyPoints, 0)
  const assigneeIds = [...new Set(deliveryTasks.map((item) => item.assigneeId))]

  const capacityMembers = [
    { employeeId: 'ag-ceo', codename: 'Apex', role: 'AI CEO', storyPoints: 8, hours: 16 },
    { employeeId: 'ag-cto', codename: 'Atlas', role: 'AI CTO', storyPoints: 13, hours: 24 },
    { employeeId: 'ag-arch', codename: 'Daedalus', role: 'AI Architect', storyPoints: 10, hours: 20 },
    { employeeId: 'ag-max', codename: 'MAX', role: 'Senior Developer', storyPoints: 13, hours: 32 },
    { employeeId: 'ag-qa', codename: 'Sentinel', role: 'AI QA', storyPoints: 10, hours: 24 },
    { employeeId: 'ag-devops', codename: 'Helm', role: 'AI DevOps', storyPoints: 8, hours: 16 },
    { employeeId: 'ag-coo', codename: 'Ops', role: 'AI Product Analyst', storyPoints: 5, hours: 12 },
    { employeeId: 'ag-asst', codename: 'Nova', role: 'AI Designer', storyPoints: 5, hours: 10 },
  ]

  const totalCapacity = capacityMembers.reduce((sum, item) => sum + item.storyPoints, 0)

  return createSprint({
    id: AI_PHOTO_LAB_SPRINT_1_ID,
    number: 1,
    name: 'Sprint 1 — Working MVP',
    projectId: AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
    goal: 'Working MVP — deliver showcase inspection MVP with audits, QA checklist, deployment plan, and Codex handoff ready for demo.',
    status: 'planned',
    startDate,
    endDate,
    durationDays,
    capacity: {
      totalStoryPoints: totalCapacity,
      totalHours: capacityMembers.reduce((sum, item) => sum + item.hours, 0),
      members: capacityMembers,
    },
    commitment: {
      storyPoints: commitmentPoints,
      taskCount: tasks.length,
    },
    tasks,
    assigneeIds,
    definitionOfReady: DEFAULT_DOR,
    definitionOfDone: DEFAULT_DOD,
    velocity: 42,
    burndown: buildBurndown(commitmentPoints),
    reviewNotes: [
      'Sprint 1 focuses on audit coverage — no Codex implementation until Owner approves handoff backlog.',
      'Demo target: end of sprint aligned with AI Photo Lab project deadline.',
      'Daily sync via collaboration sessions and control room — no task execution in planning V1.',
    ],
  })
}

function seedPhotoLabSprint(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SEED_KEY) === '1') return

  const existing = loadSprints()
  if (existing.some((item) => item.id === AI_PHOTO_LAB_SPRINT_1_ID)) {
    localStorage.setItem(SEED_KEY, '1')
    return
  }

  const sprint = buildPhotoLabSprint1()
  saveSprints([sprint, ...existing])
  localStorage.setItem(SEED_KEY, '1')

  emitEvent({
    type: 'sprint.planned',
    sourceType: 'system',
    sourceId: sprint.id,
    employeeId: 'ag-ceo',
    workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
    reportId: null,
    severity: 'info',
    metadata: {
      sprintId: sprint.id,
      sprintName: sprint.name,
      goal: sprint.goal,
      taskCount: sprint.commitment.taskCount,
      commitmentPoints: sprint.commitment.storyPoints,
    },
  })

  notifyChange()
}

export function initializeSprintEngine(): void {
  seedPhotoLabSprint()
}

export function readSprintStorageKey(): string {
  return STORAGE_KEY
}

export function loadSprints(): Sprint[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseSprint).filter((item): item is Sprint => item !== null)
  } catch {
    return []
  }
}

export function saveSprints(sprints: Sprint[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sprints))
    notifyChange()
  } catch {
    /* noop */
  }
}

export function getSprintById(id: string): Sprint | null {
  return loadSprints().find((item) => item.id === id) ?? null
}

export function getSprintsByProjectId(projectId: string): Sprint[] {
  return loadSprints().filter((item) => item.projectId === projectId)
}

function computeHealth(sprint: Sprint, blocked: number, progressPercent: number): SprintHealth {
  if (blocked >= 2) return 'blocked'
  if (sprint.commitment.storyPoints > sprint.capacity.totalStoryPoints) return 'at_risk'
  if (progressPercent < 15 && sprint.status === 'active') return 'at_risk'
  return 'on_track'
}

export function buildSprintSnapshot(sprint: Sprint): SprintSnapshot {
  const deliveryById = new Map(
    getDeliveryTasksByProjectId(sprint.projectId).map((item) => [item.id, item]),
  )

  const tasks: SprintTaskSnapshot[] = sprint.tasks
    .map((entry) => {
      const task = deliveryById.get(entry.taskId)
      if (!task) return null
      const label = ASSIGNEE_LABELS[task.assigneeId]
      return {
        entry,
        task,
        assigneeCodename: label?.codename ?? task.assigneeId,
      }
    })
    .filter((item): item is SprintTaskSnapshot => item !== null)
    .sort((a, b) => a.entry.order - b.entry.order)

  const completed = tasks.filter((item) => item.entry.boardColumn === 'done').length
  const blocked = tasks.filter((item) => item.entry.boardColumn === 'blocked').length
  const remaining = tasks.length - completed
  const progressPercent =
    tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)

  const capacityUsed = tasks
    .filter((item) => item.entry.boardColumn !== 'ready')
    .reduce((sum, item) => sum + item.entry.storyPoints, 0)

  const startMs = new Date(sprint.startDate).getTime()
  const nowMs = Date.now()
  const daysTotal = sprint.durationDays
  const daysElapsed =
    nowMs < startMs
      ? 0
      : Math.min(daysTotal, Math.ceil((nowMs - startMs) / 86400000))

  const stats: SprintStats = {
    health: computeHealth(sprint, blocked, progressPercent),
    velocity: sprint.velocity,
    capacityTotal: sprint.capacity.totalStoryPoints,
    capacityUsed,
    capacityRemaining: Math.max(0, sprint.capacity.totalStoryPoints - sprint.commitment.storyPoints),
    commitmentPoints: sprint.commitment.storyPoints,
    blocked,
    completed,
    remaining,
    progressPercent,
    daysTotal,
    daysElapsed,
  }

  const byColumn: Record<SprintBoardColumn, SprintTaskSnapshot[]> = {
    ready: [],
    in_sprint: [],
    review: [],
    done: [],
    blocked: [],
  }
  for (const item of tasks) {
    byColumn[item.entry.boardColumn].push(item)
  }

  return {
    sprint: { ...sprint, health: stats.health },
    tasks,
    stats,
    byColumn,
  }
}

export function buildSprintStats(sprints: Sprint[]): { total: number; active: number; planned: number } {
  return {
    total: sprints.length,
    active: sprints.filter((item) => item.status === 'active').length,
    planned: sprints.filter((item) => item.status === 'planned').length,
  }
}
